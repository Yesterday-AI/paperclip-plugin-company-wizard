const BASE_ROLE_MAP = {
  ceo: 'ceo',
  engineer: 'engineer',
};

/**
 * Minimal Paperclip API client using native fetch.
 * Supports both local_trusted (no auth) and authenticated instances.
 *
 * Usage:
 *   const client = new PaperclipClient('http://localhost:3100', { email, password });
 *   await client.connect(); // auto-detects auth requirement, signs in if needed
 */
export class PaperclipClient {
  constructor(baseUrl = 'http://localhost:3100', credentials = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.origin = new URL(this.baseUrl).origin;
    this.credentials = credentials; // { email, password } — optional
    this.sessionCookie = null;
    this.boardUserId = null; // resolved during connect()
  }

  async _fetch(path, opts = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = { 'Content-Type': 'application/json', Origin: this.origin, ...opts.headers };
    if (this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
    }
    let res;
    try {
      res = await fetch(url, { ...opts, headers });
    } catch (err) {
      throw new Error(
        `${opts.method || 'GET'} ${path} — network error: ${err.message}. Is Paperclip running at ${this.baseUrl}?`,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${body}`);
    }
    return res.json();
  }

  /**
   * Connect to the Paperclip instance.
   * Pings the API — if auth is required and credentials are available, signs in.
   * For local_trusted instances this is a no-op beyond the connectivity check.
   */
  async connect() {
    let res;
    try {
      res = await fetch(`${this.baseUrl}/api/companies`, {
        method: 'GET',
        headers: { Origin: this.origin },
      });
    } catch (err) {
      // Network error (connection refused, DNS failure, wrong port, etc.)
      throw new Error(
        `Could not reach Paperclip at ${this.baseUrl} (${err.message}).\n` +
          `  If your instance runs on a different port, set paperclipUrl in plugin settings.`,
      );
    }

    // local_trusted — no auth needed
    if (res.ok) {
      this.boardUserId = 'local-board';
      return;
    }

    // Auth required
    if (res.status === 401 || res.status === 403) {
      const { email, password } = this.credentials;
      if (!email || !password) {
        throw new Error(
          `Paperclip instance requires authentication.\n` +
            `  Configure paperclipEmail and paperclipPassword in plugin settings.`,
        );
      }
      await this._signIn(email, password);
      // Fetch the authenticated user's ID for assigneeUserId support
      try {
        const session = await this._fetch('/api/auth/get-session');
        this.boardUserId = session?.user?.id || null;
      } catch {
        // Non-critical — user assignment will fall back to unassigned
      }
      return;
    }

    throw new Error(
      `Paperclip API at ${this.baseUrl} returned unexpected status ${res.status}.\n` +
        `  Check that paperclipUrl in plugin settings points to the correct instance.`,
    );
  }

  /**
   * Authenticate via Better Auth email/password sign-in.
   * Captures the session cookie for subsequent requests.
   */
  async _signIn(email, password) {
    const res = await fetch(`${this.baseUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: this.origin },
      body: JSON.stringify({ email, password }),
      redirect: 'manual',
    });

    if (!res.ok && res.status !== 302) {
      const body = await res.text().catch(() => '');
      throw new Error(`Authentication failed (${res.status}): ${body}`);
    }

    // Capture set-cookie header(s)
    const setCookie = res.headers.getSetCookie?.() || [];
    if (setCookie.length === 0) {
      // Fallback: some runtimes use get('set-cookie')
      const raw = res.headers.get('set-cookie');
      if (raw) setCookie.push(...raw.split(/,(?=\s*\w+=)/));
    }

    this.sessionCookie = setCookie
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

    if (!this.sessionCookie) {
      throw new Error('Authentication succeeded but no session cookie received.');
    }
  }

  async ping() {
    try {
      const headers = { Origin: this.origin };
      if (this.sessionCookie) headers['Cookie'] = this.sessionCookie;
      const res = await fetch(`${this.baseUrl}/api/companies`, {
        method: 'GET',
        headers,
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async createCompany({ name, description }) {
    return this._fetch('/api/companies', {
      method: 'POST',
      body: JSON.stringify({ name, description: description || null }),
    });
  }

  async updateCompany(companyId, updates) {
    return this._fetch(`/api/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteCompany(companyId) {
    return this._fetch(`/api/companies/${companyId}`, { method: 'DELETE' });
  }

  async getCompany(companyId) {
    return this._fetch(`/api/companies/${companyId}`, { method: 'GET' });
  }

  async listAgents(companyId) {
    return this._fetch(`/api/companies/${companyId}/agents`, { method: 'GET' });
  }

  async getAgent(agentId) {
    return this._fetch(`/api/agents/${agentId}`, { method: 'GET' });
  }

  async createAgent(
    companyId,
    { name, role, title, reportsTo, adapterType, adapterConfig, runtimeConfig, permissions },
  ) {
    const payload = {
      name,
      role,
      title: title || null,
      reportsTo: reportsTo || null,
      adapterType: adapterType || 'claude_local',
      adapterConfig: adapterConfig || {},
      ...(runtimeConfig ? { runtimeConfig } : {}),
      ...(permissions ? { permissions } : {}),
    };

    try {
      return await this._fetch(`/api/companies/${companyId}/agents`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const requiresApproval =
        message.includes('Direct agent creation requires board approval') ||
        message.includes('/agent-hires');
      if (!requiresApproval) throw err;

      const hireResult = await this._fetch(`/api/companies/${companyId}/agent-hires`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const hiredAgent = hireResult?.agent || null;
      const approvalId = hireResult?.approval?.id || null;
      if (!hiredAgent) {
        throw new Error('Agent hire endpoint returned no agent.');
      }

      if (approvalId) {
        try {
          await this._fetch(`/api/approvals/${approvalId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ decisionNote: 'Auto-approved by Company Wizard provisioning' }),
          });
          try {
            return await this._fetch(`/api/agents/${hiredAgent.id}`, { method: 'GET' });
          } catch {
            return hiredAgent;
          }
        } catch (approveErr) {
          return {
            ...hiredAgent,
            _pendingApprovalId: approvalId,
            _approvalAutoApproveError:
              approveErr instanceof Error ? approveErr.message : String(approveErr),
          };
        }
      }

      return hiredAgent;
    }
  }

  async createProject(companyId, { name, description, goalIds, workspace }) {
    return this._fetch(`/api/companies/${companyId}/projects`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: description || null,
        ...(goalIds?.length ? { goalIds } : {}),
        workspace: workspace || undefined,
      }),
    });
  }

  async createGoal(companyId, { title, description, level, parentId, status, ownerAgentId }) {
    return this._fetch(`/api/companies/${companyId}/goals`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: description || null,
        level: level || 'company',
        status: status || 'active',
        ...(parentId ? { parentId } : {}),
        ...(ownerAgentId ? { ownerAgentId } : {}),
      }),
    });
  }

  async createIssue(
    companyId,
    { title, description, priority, projectId, goalId, assigneeAgentId, assigneeUserId },
  ) {
    return this._fetch(`/api/companies/${companyId}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: description || null,
        priority: priority || 'medium',
        projectId: projectId || undefined,
        goalId: goalId || undefined,
        assigneeAgentId: assigneeAgentId || undefined,
        assigneeUserId: assigneeUserId || undefined,
      }),
    });
  }

  async createRoutine(
    companyId,
    {
      title,
      description,
      assigneeAgentId,
      projectId,
      priority,
      status,
      concurrencyPolicy,
      catchUpPolicy,
    },
  ) {
    return this._fetch(`/api/companies/${companyId}/routines`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: description || null,
        assigneeAgentId: assigneeAgentId || undefined,
        projectId: projectId || undefined,
        priority: priority || 'medium',
        status: status || 'active',
        concurrencyPolicy: concurrencyPolicy || 'skip_if_active',
        catchUpPolicy: catchUpPolicy || 'skip_missed',
      }),
    });
  }

  async createRoutineTrigger(routineId, { kind, cronExpression, timezone }) {
    return this._fetch(`/api/routines/${routineId}/triggers`, {
      method: 'POST',
      body: JSON.stringify({
        kind: kind || 'schedule',
        ...(cronExpression ? { cronExpression } : {}),
        ...(timezone ? { timezone } : {}),
      }),
    });
  }

  async triggerHeartbeat(agentId, { issueId } = {}) {
    return this._fetch(`/api/agents/${agentId}/wakeup`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'on_demand',
        triggerDetail: 'manual',
        ...(issueId ? { payload: { issueId } } : {}),
      }),
    });
  }

  /**
   * Resolve a clipper role name to a Paperclip API role enum.
   * Uses role.json's paperclipRole field, falls back to 'general'.
   */
  static resolveRole(clipperRole, roleData) {
    // Check base roles first
    if (BASE_ROLE_MAP[clipperRole]) return BASE_ROLE_MAP[clipperRole];
    // Check role.json data
    if (roleData?.paperclipRole) return roleData.paperclipRole;
    return 'general';
  }
}
