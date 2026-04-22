import { definePlugin, runWorker } from '@paperclipai/plugin-sdk';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-ignore — plain JS modules, bundled by esbuild
import { assembleCompany, toPascalCase } from './logic/assemble.js';
// @ts-ignore
import { PaperclipClient } from './api/client.js';
// @ts-ignore
import { collectGoals, loadModules, loadPresets } from './logic/load-templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Template loader ---

const DEFAULT_TEMPLATES_REPO_URL =
  'https://github.com/Yesterday-AI/paperclip-plugin-company-wizard/tree/main/templates';
const BUNDLED_TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates');

/** Recursively copy a directory (sync). */
function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * Download a GitHub subdirectory into destDir using git sparse-checkout.
 * Expects a URL in the form: https://github.com/{owner}/{repo}/tree/{branch}/{subpath}
 */
function downloadTemplatesFromGithub(destDir: string, githubUrl: string): void {
  // Branch is captured as the first path segment after /tree/; subpath takes the rest.
  // Branch names with slashes (e.g. feature/my-branch) are not supported in tree URLs —
  // use a tag or a branch without slashes, or pin to a commit SHA instead.
  const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/);
  if (!match) {
    throw new Error(
      `Unsupported templates URL: ${githubUrl}. Expected https://github.com/{owner}/{repo}/tree/{branch}/{path}`,
    );
  }
  const [, owner, repo, branch, subpath] = match;
  const cloneUrl = `https://github.com/${owner}/${repo}.git`;
  const tmpDir = path.join(os.tmpdir(), `plugin-templates-dl-${Date.now()}`);
  try {
    execFileSync(
      'git',
      [
        'clone',
        '--depth',
        '1',
        '--filter=blob:none',
        '--sparse',
        '--branch',
        branch,
        cloneUrl,
        tmpDir,
      ],
      { stdio: 'pipe' },
    );
    execFileSync('git', ['sparse-checkout', 'set', subpath], { cwd: tmpDir, stdio: 'pipe' });
    const srcDir = path.join(tmpDir, subpath);
    if (!fs.existsSync(srcDir)) throw new Error(`Path '${subpath}' not found in ${cloneUrl}`);
    copyDirSync(srcDir, destDir);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* */
    }
  }
}

/**
 * Resolve (and if needed, create) the templates directory.
 * Resolution order:
 *  1. cfg.templatesPath if set → use it; auto-download if missing.
 *  2. Default: ~/.paperclip/plugin-templates → auto-download if missing.
 *  3. Bundled templates (dist/../templates) as last resort.
 */
async function ensureTemplatesDir(cfg: Record<string, string>): Promise<string> {
  const repoUrl = cfg.templatesRepoUrl || DEFAULT_TEMPLATES_REPO_URL;

  if (cfg.templatesPath) {
    if (fs.existsSync(cfg.templatesPath)) return cfg.templatesPath;
    downloadTemplatesFromGithub(cfg.templatesPath, repoUrl);
    return cfg.templatesPath;
  }

  const defaultDir = path.join(os.homedir(), '.paperclip', 'plugin-templates');

  if (fs.existsSync(defaultDir)) return defaultDir;

  try {
    downloadTemplatesFromGithub(defaultDir, repoUrl);
    return defaultDir;
  } catch {
    if (fs.existsSync(BUNDLED_TEMPLATES_DIR)) return BUNDLED_TEMPLATES_DIR;
    throw new Error(
      'Templates not found and download failed. Configure templatesPath or templatesRepoUrl in plugin settings.',
    );
  }
}

function loadJsonFiles(dir: string, filename: string) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((d) => {
      try {
        return fs.statSync(path.join(dir, d)).isDirectory();
      } catch {
        return false;
      }
    })
    .map((d) => {
      const fp = path.join(dir, d, filename);
      if (!fs.existsSync(fp)) return null;
      try {
        return JSON.parse(fs.readFileSync(fp, 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function loadTemplates(templatesDir: string) {
  const presets = loadJsonFiles(path.join(templatesDir, 'presets'), 'preset.meta.json');
  const modules = loadJsonFiles(path.join(templatesDir, 'modules'), 'module.meta.json');
  const roles = loadJsonFiles(path.join(templatesDir, 'roles'), 'role.meta.json').map(
    (r: Record<string, unknown>) => {
      if (r.base) return { ...r, _base: true };
      return r;
    },
  );
  return { presets, modules, roles };
}

// --- Helpers ---

function resolveCompaniesDir(cfg: Record<string, string>): string {
  if (cfg.companiesDir) return cfg.companiesDir;
  return path.join(os.homedir(), '.paperclip', 'instances', 'default', 'companies');
}

function formatRoleName(role: string): string {
  return role
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// --- Plugin definition ---

const plugin = definePlugin({
  async setup(ctx) {
    ctx.data.register('templates', async () => {
      const cfg = ((await ctx.config.get()) ?? {}) as Record<string, string>;
      return loadTemplates(await ensureTemplatesDir(cfg));
    });

    // Refresh templates — delete cached dir so next load re-downloads from GitHub.
    ctx.actions.register('refresh-templates', async () => {
      try {
        const cfg = ((await ctx.config.get()) ?? {}) as Record<string, string>;
        const repoUrl = cfg.templatesRepoUrl || DEFAULT_TEMPLATES_REPO_URL;
        const targetDir =
          cfg.templatesPath || path.join(os.homedir(), '.paperclip', 'plugin-templates');

        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
        downloadTemplatesFromGithub(targetDir, repoUrl);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    });

    // Preview action — assembles files to a temp dir and returns their contents.
    // Used by the UI review step to show/edit generated MD files before provisioning.
    ctx.actions.register('preview-files', async (params) => {
      let tmpDir: string | undefined;
      try {
        const cfg = ((await ctx.config.get()) ?? {}) as Record<string, string>;

        const companyName =
          typeof params.companyName === 'string' && params.companyName.trim()
            ? params.companyName.trim()
            : 'Preview';

        const templatesDir = await ensureTemplatesDir(cfg);
        tmpDir = path.join(os.tmpdir(), `clipper-preview-${Date.now()}`);

        // Resolve the companies dir so BOOTSTRAP.md shows correct paths in preview.
        const companiesDir = resolveCompaniesDir(cfg);

        const [presets, allModules] = await Promise.all([
          loadPresets(templatesDir),
          loadModules(templatesDir),
        ]);
        const selectedPreset = presets.find((p: any) => p.name === params.presetName) || null;
        const goals = collectGoals(
          selectedPreset,
          allModules,
          new Set((params.selectedModules as string[]) ?? []),
        );

        // Normalize goals/projects for preview (same logic as start-provision)
        const previewGoals: any[] = Array.isArray(params.goals)
          ? (params.goals as any[])
          : params.goal
            ? [params.goal]
            : [];
        const previewProjects: any[] = Array.isArray(params.projects)
          ? (params.projects as any[])
          : [];

        const result = await assembleCompany({
          companyName,
          userGoals: previewGoals,
          userProjects: previewProjects,
          moduleNames: (params.selectedModules as string[]) ?? [],
          extraRoleNames: (params.selectedRoles as string[]) ?? [],
          inlineGoals: goals,
          outputDir: tmpDir,
          templatesDir,
        });

        // Collect all .md files from the assembled company dir.
        // For BOOTSTRAP.md, replace the tmp path with the realistic host workspace path
        // so the preview shows where files will actually live after provisioning.
        const previewCompanyDir = path.join(companiesDir, toPascalCase(companyName));
        const files: Record<string, string> = {};

        function collectMdFiles(dir: string, base: string) {
          if (!fs.existsSync(dir)) return;
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const rel = base ? `${base}/${entry.name}` : entry.name;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              collectMdFiles(full, rel);
            } else if (entry.name.endsWith('.md')) {
              let content = fs.readFileSync(full, 'utf-8');
              if (entry.name === 'BOOTSTRAP.md') {
                content = content.replaceAll(result.companyDir, previewCompanyDir);
              }
              files[rel] = content;
            }
          }
        }

        collectMdFiles(result.companyDir, '');
        return { files };
      } catch (err) {
        return { files: {}, error: err instanceof Error ? err.message : String(err) };
      } finally {
        if (tmpDir) {
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch {
            /* */
          }
        }
      }
    });

    // Auth check action — called by the summary step to surface credential issues early.
    ctx.actions.register('check-auth', async () => {
      const cfg = ((await ctx.config.get()) ?? {}) as Record<string, string>;
      const paperclipUrl =
        cfg.paperclipUrl || process.env.PAPERCLIP_PUBLIC_URL || 'http://localhost:3100';
      try {
        const client = new PaperclipClient(paperclipUrl, {
          email: cfg.paperclipEmail || '',
          password: cfg.paperclipPassword || '',
        });
        await client.connect();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    });

    // AI chat action — proxies messages to the Anthropic API using the configured key.
    // Keeps the API key server-side; the UI never touches it directly.
    // Returns { text, error? } — never throws, so the plugin host doesn't swallow the message in a 502.
    ctx.actions.register('ai-chat', async (params) => {
      try {
        const cfg = ((await ctx.config.get()) ?? {}) as Record<string, string>;
        const apiKey = cfg.anthropicApiKey || '';
        if (!apiKey) {
          return {
            text: '',
            error: 'Anthropic API key not configured. Add it in plugin settings (anthropicApiKey).',
          };
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
            ...(params.system ? { system: params.system } : {}),
            messages: params.messages,
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          return { text: '', error: `Anthropic API error (${response.status}): ${body}` };
        }

        const data = (await response.json()) as { content?: { text: string }[] };
        return { text: data.content?.[0]?.text || '' };
      } catch (err) {
        return { text: '', error: err instanceof Error ? err.message : String(err) };
      }
    });

    // Lightweight config check — UI calls this on mount to show a warning before the user types.
    ctx.actions.register('check-ai-config', async () => {
      try {
        const cfg = ((await ctx.config.get()) ?? {}) as Record<string, string>;
        if (!cfg.anthropicApiKey) {
          return {
            ok: false,
            error: 'Anthropic API key not configured. Add it in plugin settings (anthropicApiKey).',
          };
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    });

    // Provisioning action — assembles files, then creates company/agent/issue.
    // Uses the plugin SDK host services where available (issues, goals),
    // falls back to PaperclipClient HTTP for operations the SDK doesn't support
    // yet (company creation, agent creation).
    // Returns { ..., logs } on success or { error, logs } on failure — never throws.
    ctx.actions.register('start-provision', async (params) => {
      const logs: string[] = [];
      const log = (msg: string) => {
        logs.push(msg);
        ctx.logger.info(msg);
      };

      try {
        const cfg = ((await ctx.config.get()) ?? {}) as Record<string, string>;
        const paperclipUrl =
          cfg.paperclipUrl || process.env.PAPERCLIP_PUBLIC_URL || 'http://localhost:3100';
        const paperclipEmail = cfg.paperclipEmail || '';
        const paperclipPassword = cfg.paperclipPassword || '';
        const rawDisableBoardApproval = (cfg as Record<string, unknown>)
          .disableBoardApprovalOnNewCompanies;
        const disableBoardApprovalOnNewCompanies =
          rawDisableBoardApproval === true ||
          (typeof rawDisableBoardApproval === 'string' &&
            rawDisableBoardApproval.toLowerCase() === 'true');

        const companyName = typeof params.companyName === 'string' ? params.companyName.trim() : '';
        const existingCompanyId =
          typeof params.existingCompanyId === 'string' && params.existingCompanyId.trim()
            ? params.existingCompanyId.trim()
            : '';
        if (!companyName) return { error: 'companyName is required', logs };

        const templatesDir = await ensureTemplatesDir(cfg);

        // Step 1: Collect inline goals
        const [presets, allModules] = await Promise.all([
          loadPresets(templatesDir),
          loadModules(templatesDir),
        ]);
        const selectedPreset = presets.find((p: any) => p.name === params.presetName) || null;
        const goals = collectGoals(
          selectedPreset,
          allModules,
          new Set((params.selectedModules as string[]) ?? []),
        );

        // Step 2: Assemble files on disk
        const outputDir = resolveCompaniesDir(cfg);

        fs.mkdirSync(outputDir, { recursive: true });
        log('Assembling company workspace...');

        const companyDescription =
          typeof params.companyDescription === 'string' ? params.companyDescription.trim() : '';

        // Normalize goals: support both old single-goal and new array format
        const userGoals: any[] = Array.isArray(params.goals)
          ? (params.goals as any[])
          : params.goal
            ? [params.goal]
            : [];
        const userProjects: any[] = Array.isArray(params.projects)
          ? (params.projects as any[])
          : [];

        const assembleResult = await assembleCompany({
          companyName,
          companyDescription,
          userGoals,
          userProjects,
          moduleNames: (params.selectedModules as string[]) ?? [],
          extraRoleNames: (params.selectedRoles as string[]) ?? [],
          inlineGoals: goals,
          outputDir,
          templatesDir,
          onProgress: log,
        });

        const { companyDir } = assembleResult;

        // Apply file overrides from UI edits
        const fileOverrides = (params.fileOverrides as Record<string, string>) ?? {};
        for (const [relPath, content] of Object.entries(fileOverrides)) {
          const absPath = path.resolve(companyDir, relPath);
          if (!absPath.startsWith(companyDir + path.sep) && absPath !== companyDir) {
            log(`⚠ Skipped override outside company dir: ${relPath}`);
            continue;
          }
          if (fs.existsSync(absPath)) {
            fs.writeFileSync(absPath, content, 'utf-8');
            log(`✎ Override: ${relPath}`);
          }
        }

        log('');
        log(`✓ Generated files: ${companyDir}`);

        // Step 3: Connect to Paperclip API
        // The SDK doesn't support company/agent creation yet, so we use PaperclipClient
        // for those. It auto-detects auth mode (no-op for local_trusted).
        log('Connecting to Paperclip API...');
        const client = new PaperclipClient(paperclipUrl, {
          email: paperclipEmail,
          password: paperclipPassword,
        });
        await client.connect();
        log('Connected.');
        log('');

        // Step 5: Resolve target company (create new, or reuse existing)
        let company: any;
        let companyId: string;
        let createdCompany = false;

        if (existingCompanyId) {
          log(`Using existing company: ${existingCompanyId}`);
          company = await client.getCompany(existingCompanyId);
          companyId = company.id;
          log(`✓ Target company "${company.name}" selected`);
          log('Keeping company hire policy as configured (board approvals may be required).');
        } else {
          log('Creating company...');
          company = await client.createCompany({
            name: companyName,
            description: companyDescription || undefined,
          });
          companyId = company.id;
          createdCompany = true;
          log(`✓ Company "${companyName}" created`);

          if (disableBoardApprovalOnNewCompanies) {
            // Optional compatibility mode: disable mandatory board-approval hiring on new companies.
            // Useful when users want legacy fully-autonomous bootstrap behavior.
            try {
              await client.updateCompany(companyId, { requireBoardApprovalForNewAgents: false });
              log('✓ Disabled board-approval hiring policy for this new company');
            } catch (err) {
              log(
                `⚠ Could not disable board-approval hiring for new agents: ${err instanceof Error ? err.message : String(err)}`,
              );
              log('  Continuing — agent creation will use an approval-aware fallback if required.');
            }
          } else {
            log('Keeping company hire policy as configured (board approvals may be required).');
          }
        }

        // Steps 6-7 are wrapped so we can delete only newly-created companies on partial failure.
        let ceoAgentId: string;
        let bootstrapIssue: { id: string; identifier?: string };
        try {
          // Step 6: Resolve or create CEO agent
          const userCeoAdapter = (params.ceoAdapter as any) || {};
          const adapterType =
            typeof userCeoAdapter.type === 'string' ? userCeoAdapter.type.trim() : 'claude_local';
          const userCwd = typeof userCeoAdapter.cwd === 'string' ? userCeoAdapter.cwd.trim() : '';
          const userModel =
            typeof userCeoAdapter.model === 'string' ? userCeoAdapter.model.trim() : '';

          const adapterConfig: Record<string, unknown> = {
            ...(assembleResult.roleAdapterOverrides?.get('ceo') ?? {}),
            cwd: userCwd || companyDir,
            instructionsFilePath: path.join(companyDir, 'agents', 'ceo', 'AGENTS.md'),
            model: userModel || 'claude-opus-4-6',
          };

          if (adapterType === 'claude_local') {
            adapterConfig.dangerouslySkipPermissions = true;
          } else if (adapterType === 'codex_local') {
            adapterConfig.dangerouslyBypassApprovalsAndSandbox = true;
          }

          const logPendingApproval = (agent: any) => {
            if (!agent?._pendingApprovalId) return;
            log(
              `⚠ CEO hire is pending approval: ${agent._pendingApprovalId}. Approve it in the board before the bootstrap heartbeat can run.`,
            );
            if (agent._approvalAutoApproveError) {
              log(`  Auto-approve failed: ${agent._approvalAutoApproveError}`);
            }
          };

          if (existingCompanyId) {
            log('Looking for an existing CEO agent...');
            const agents = await client.listAgents(companyId);
            const existingCeo = Array.isArray(agents)
              ? agents.find((agent: any) => agent?.role === 'ceo' && agent?.status !== 'terminated')
              : null;

            if (existingCeo?.id) {
              ceoAgentId = existingCeo.id;
              log(`✓ Reusing existing CEO agent (${ceoAgentId})`);
            } else {
              log('No active CEO found — creating CEO agent...');
              const ceoAgent = await client.createAgent(companyId, {
                name: 'CEO',
                role: 'ceo',
                title: 'CEO',
                reportsTo: null,
                adapterType,
                adapterConfig,
                runtimeConfig: {
                  heartbeat: { enabled: true, intervalSec: 3600 },
                },
                permissions: { canCreateAgents: true },
              });
              ceoAgentId = ceoAgent.id;
              log(`✓ CEO agent created (${ceoAgentId})`);
              logPendingApproval(ceoAgent);
            }
          } else {
            log('Creating CEO agent...');
            const ceoAgent = await client.createAgent(companyId, {
              name: 'CEO',
              role: 'ceo',
              title: 'CEO',
              reportsTo: null,
              adapterType,
              adapterConfig,
              runtimeConfig: {
                heartbeat: { enabled: true, intervalSec: 3600 },
              },
              permissions: { canCreateAgents: true },
            });
            ceoAgentId = ceoAgent.id;
            log(`✓ CEO agent created (${ceoAgentId})`);
            logPendingApproval(ceoAgent);
          }

          // Step 7: Create bootstrap issue (SDK: ctx.issues.create ✓)
          // BOOTSTRAP.md IS the bootstrap issue — read it directly.
          const bootstrapDescription = fs.readFileSync(
            path.join(companyDir, 'BOOTSTRAP.md'),
            'utf-8',
          );

          log('Creating bootstrap task for CEO...');
          const issue = await ctx.issues.create({
            companyId,
            title: `Bootstrap ${company.name || companyName}`,
            description: bootstrapDescription,
            assigneeAgentId: ceoAgentId,
          });
          await ctx.issues.update(issue.id, { status: 'todo' }, companyId);
          bootstrapIssue = issue as { id: string; identifier?: string };
          log(`✓ Bootstrap task created: ${bootstrapIssue.identifier || bootstrapIssue.id}`);
        } catch (err) {
          log(`✗ Provisioning failed: ${err instanceof Error ? err.message : String(err)}`);
          if (createdCompany) {
            log(`Cleaning up — deleting partially created company (${companyId})...`);
            try {
              await client.deleteCompany(companyId);
              log('✓ Company deleted.');
            } catch (cleanupErr) {
              log(
                `⚠ Could not delete company ${companyId}: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`,
              );
              log(`  Delete it manually in the Paperclip UI to clean up.`);
            }
          } else {
            log('Skipping cleanup because provisioning targeted an existing company.');
          }
          throw err;
        }

        log('');
        log('Provisioning complete!');
        log(
          existingCompanyId
            ? 'Bootstrap task created in existing company. Trigger the CEO heartbeat to continue setup.'
            : 'The CEO agent is ready. Trigger its first heartbeat to hire the rest of the team and create the initial backlog.',
        );

        return {
          companyId,
          issuePrefix: company.issuePrefix,
          paperclipUrl,
          agentIds: { ceo: ceoAgentId! },
          issueIds: [bootstrapIssue!.id],
          logs,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Only log if it wasn't already logged by the inner compensation catch
        if (!logs.some((l) => l.includes('Provisioning failed'))) {
          log(`✗ ${message}`);
        }
        return { error: message, logs };
      }
    });
  },

  async onHealth() {
    return { status: 'ok', message: 'Company Wizard plugin is running' };
  },

  // Called by the "Test Configuration" button in the plugin settings UI.
  async onValidateConfig(config: Record<string, unknown>) {
    const paperclipUrl =
      (config.paperclipUrl as string) ||
      process.env.PAPERCLIP_PUBLIC_URL ||
      'http://localhost:3100';
    try {
      const client = new PaperclipClient(paperclipUrl, {
        email: (config.paperclipEmail as string) || '',
        password: (config.paperclipPassword as string) || '',
      });
      await client.connect();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
