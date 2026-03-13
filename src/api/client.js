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
    const res = await fetch(url, { ...opts, headers });
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
    const res = await fetch(`${this.baseUrl}/api/companies`, {
      method: 'GET',
      headers: { Origin: this.origin },
    });

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
            `  Set PAPERCLIP_EMAIL and PAPERCLIP_PASSWORD env vars,\n` +
            `  or pass --api-email and --api-password.`,
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

    throw new Error(`Paperclip API unreachable (${res.status})`);
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

  async createAgent(companyId, { name, role, title, reportsTo, adapterConfig }) {
    return this._fetch(`/api/companies/${companyId}/agents`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        role,
        title: title || null,
        reportsTo: reportsTo || null,
        adapterType: 'claude_local',
        adapterConfig: {
          dangerouslySkipPermissions: true,
          ...(adapterConfig || {}),
        },
      }),
    });
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

  async createGoal(companyId, { title, description, level, parentId }) {
    return this._fetch(`/api/companies/${companyId}/goals`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: description || null,
        level: level || 'company',
        status: 'active',
        ...(parentId ? { parentId } : {}),
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
