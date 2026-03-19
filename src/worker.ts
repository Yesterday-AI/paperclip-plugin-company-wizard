import { definePlugin, runWorker } from '@paperclipai/plugin-sdk';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
// @ts-ignore — plain JS modules, bundled by esbuild
import { assembleCompany, toPascalCase } from './logic/assemble.js';
// @ts-ignore
import { PaperclipClient } from './api/client.js';
// @ts-ignore
import { loadPresets, loadModules, collectGoals } from './logic/load-templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Template loader ---

const DEFAULT_TEMPLATES_REPO_URL =
  'https://github.com/Yesterday-AI/paperclipper/tree/main/templates';
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
  const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.*)/);
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

function generateBootstrapDescription({
  companyName,
  generatedFilesPath,
  userCwd,
  goal,
}: {
  companyName: string;
  generatedFilesPath: string;
  userCwd: string;
  goal: { title?: string; description?: string };
}): string {
  const lines: string[] = [];
  lines.push(`# Bootstrap ${companyName}`);
  lines.push('');
  lines.push(
    'Your company has been created. Your agent personas, skills, and documentation have been generated.',
  );
  lines.push(`Generated files are at: \`${generatedFilesPath}\``);
  lines.push('');

  if (goal?.title) {
    lines.push('## Company goal');
    lines.push(`**${goal.title}**`);
    if (goal.description) lines.push(goal.description);
    lines.push('');
  }

  lines.push('## Step 1: Set up your workspace');
  lines.push('');
  lines.push(
    `Copy your persona files from \`${generatedFilesPath}/agents/ceo/\` to your permanent workspace.`,
  );
  if (userCwd) {
    lines.push(`Your working directory is already configured as: \`${userCwd}\``);
  } else {
    lines.push('Choose a permanent directory for your workspace and copy the files there.');
  }
  lines.push('Then register your instructions file so future heartbeats load your identity:');
  lines.push('```');
  lines.push('PATCH /api/agents/me/instructions-path');
  lines.push(`{"path": "${userCwd ? userCwd + '/AGENTS.md' : '{your-workspace}/AGENTS.md'}"}`);
  lines.push('```');
  lines.push('');

  lines.push('## Step 2: Follow your AGENTS.md');
  lines.push('');
  lines.push('Once your workspace is set up, your `AGENTS.md` contains everything you need:');
  lines.push(
    'your identity, skills, heartbeat checklist, and instructions for bootstrapping the company.',
  );
  lines.push('Follow it to create the goal, project, hire your team, and kick off the roadmap.');
  lines.push('');

  lines.push('## Done');
  lines.push('');
  lines.push('Mark this task done once your workspace is set up and your first heartbeat has run.');
  return lines.join('\n');
}

// --- Plugin definition ---

const plugin = definePlugin({
  async setup(ctx) {
    ctx.data.register('templates', async () => {
      const cfg = ((await ctx.config.get()) ?? {}) as Record<string, string>;
      return loadTemplates(await ensureTemplatesDir(cfg));
    });

    // Preview action — assembles files to a temp dir and returns their contents.
    // Used by the UI review step to show/edit generated MD files before provisioning.
    ctx.actions.register('preview-files', async (params) => {
      const cfg = ((await ctx.config.get()) ?? {}) as Record<string, string>;

      const companyName =
        typeof params.companyName === 'string' && params.companyName.trim()
          ? params.companyName.trim()
          : 'Preview';

      const templatesDir = await ensureTemplatesDir(cfg);
      const tmpDir = path.join(os.tmpdir(), `clipper-preview-${Date.now()}`);

      // Resolve the companies dir so BOOTSTRAP.md shows correct paths in preview.
      const companiesDir = resolveCompaniesDir(cfg);

      try {
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

        const result = await assembleCompany({
          companyName,
          goal: (params.goal as any) || {},
          project: {},
          moduleNames: (params.selectedModules as string[]) ?? [],
          extraRoleNames: (params.selectedRoles as string[]) ?? [],
          goals,
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
      } finally {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          /* */
        }
      }
    });

    // Provisioning action — assembles files, then creates company/agent/issue.
    // Uses the plugin SDK host services where available (issues, goals),
    // falls back to PaperclipClient HTTP for operations the SDK doesn't support
    // yet (company creation, agent creation).
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
    ctx.actions.register('ai-chat', async (params) => {
      const cfg = ((await ctx.config.get()) ?? {}) as Record<string, string>;
      const apiKey = cfg.anthropicApiKey || '';
      if (!apiKey) {
        throw new Error(
          'Anthropic API key not configured. Add it in plugin settings (anthropicApiKey).',
        );
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
          max_tokens: 1024,
          ...(params.system ? { system: params.system } : {}),
          messages: params.messages,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${err}`);
      }

      const data = (await response.json()) as { content?: { text: string }[] };
      return { text: data.content?.[0]?.text || '' };
    });

    ctx.actions.register('start-provision', async (params) => {
      const cfg = ((await ctx.config.get()) ?? {}) as Record<string, string>;
      const paperclipUrl =
        cfg.paperclipUrl || process.env.PAPERCLIP_PUBLIC_URL || 'http://localhost:3100';
      const paperclipEmail = cfg.paperclipEmail || '';
      const paperclipPassword = cfg.paperclipPassword || '';

      const companyName = typeof params.companyName === 'string' ? params.companyName : '';
      if (!companyName) throw new Error('companyName is required');

      const logs: string[] = [];
      const log = (msg: string) => {
        logs.push(msg);
        ctx.logger.info(msg);
      };

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

      const assembleResult = await assembleCompany({
        companyName,
        goal: (params.goal as any) || {},
        project: {},
        moduleNames: (params.selectedModules as string[]) ?? [],
        extraRoleNames: (params.selectedRoles as string[]) ?? [],
        goals,
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

      // Step 5: Create company (SDK: companies.read only → HTTP client)
      log('Creating company...');
      const company = await client.createCompany({ name: companyName });
      const companyId = company.id;
      log(`✓ Company "${companyName}" created`);

      // Step 6: Create CEO agent (SDK: agents.read only → HTTP client)
      const userCeoAdapter = (params.ceoAdapter as any) || {};
      const adapterType =
        typeof userCeoAdapter.type === 'string' ? userCeoAdapter.type.trim() : 'claude_local';
      const userCwd = typeof userCeoAdapter.cwd === 'string' ? userCeoAdapter.cwd.trim() : '';
      const userModel = typeof userCeoAdapter.model === 'string' ? userCeoAdapter.model.trim() : '';

      // CEO starts without an instructionsFilePath — the bootstrap task guides them
      // to copy their persona files to their permanent workspace and set it themselves.
      // Use the user-specified cwd if provided; otherwise leave it unset so the agent
      // runs from whatever directory the adapter defaults to.
      const adapterConfig: Record<string, unknown> = {
        // Module-derived adapter overrides (e.g. chrome: true from website-relaunch)
        ...(assembleResult.roleAdapterOverrides?.get('ceo') ?? {}),
        cwd: userCwd || companyDir,
        instructionsFilePath: path.join(companyDir, 'agents', 'ceo', 'AGENTS.md'),
        ...(userModel ? { model: userModel } : {}),
      };

      // Adapter-specific permission bypass flags
      if (adapterType === 'claude_local') {
        adapterConfig.dangerouslySkipPermissions = true;
      } else if (adapterType === 'codex_local') {
        adapterConfig.dangerouslyBypassApprovalsAndSandbox = true;
      }

      log('Creating CEO agent...');
      const ceoAgent = await client.createAgent(companyId, {
        name: 'CEO',
        role: 'ceo',
        title: 'CEO',
        reportsTo: null,
        adapterType,
        adapterConfig,
        permissions: { canCreateAgents: true },
      });
      const ceoAgentId = ceoAgent.id;
      log(`✓ CEO agent created (${ceoAgentId})`);

      // Step 7: Create bootstrap issue (SDK: ctx.issues.create ✓)
      const goalData = (params.goal as any) || {};
      const bootstrapDescription = generateBootstrapDescription({
        companyName,
        generatedFilesPath: companyDir,
        userCwd,
        goal: goalData,
      });

      log('Creating bootstrap task for CEO...');
      const bootstrapIssue = await ctx.issues.create({
        companyId,
        title: `Bootstrap ${companyName}`,
        description: bootstrapDescription,
        assigneeAgentId: ceoAgentId,
      });
      await ctx.issues.update(bootstrapIssue.id, { status: 'todo' }, companyId);
      log(`✓ Bootstrap task created: ${(bootstrapIssue as any).identifier || bootstrapIssue.id}`);

      log('');
      log('Provisioning complete!');
      log('The CEO will set up the team on its first heartbeat.');

      return {
        companyId,
        issuePrefix: company.issuePrefix,
        paperclipUrl,
        agentIds: { ceo: ceoAgentId },
        issueIds: [bootstrapIssue.id],
        logs,
      };
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
