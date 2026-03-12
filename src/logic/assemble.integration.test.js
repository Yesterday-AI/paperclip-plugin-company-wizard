import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { assembleCompany } from './assemble.js';

const REAL_TEMPLATES_DIR = resolve(import.meta.dirname, '..', '..', 'templates');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

describe('assembleCompany integration (real templates)', () => {
  let outputDir;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'assemble-integration-'));
    outputDir = join(tmpDir, 'output');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('assembles quality preset with all expected role directories and files', async () => {
    // Quality preset: roles = product-owner, code-reviewer; modules = github-repo, pr-review, backlog, auto-assign, stall-detection
    const { companyDir, allRoles, initialTasks } = await assembleCompany({
      companyName: 'Integration Test Co',
      goal: { title: 'Ship the MVP', description: 'Build and launch a working product' },
      project: { name: 'test-app', repoUrl: 'https://github.com/test/test-app' },
      moduleNames: ['github-repo', 'pr-review', 'backlog', 'auto-assign', 'stall-detection'],
      extraRoleNames: ['product-owner', 'code-reviewer'],
      outputDir,
      templatesDir: REAL_TEMPLATES_DIR,
    });

    // --- Verify company directory ---
    assert.ok(companyDir.endsWith('IntegrationTestCo'), `expected PascalCase dir, got ${companyDir}`);
    assert.ok(await exists(companyDir), 'company directory should exist');

    // --- Verify all expected roles ---
    const expectedRoles = ['ceo', 'engineer', 'product-owner', 'code-reviewer'];
    assert.deepEqual(allRoles, new Set(expectedRoles));

    for (const role of expectedRoles) {
      const roleDir = join(companyDir, 'agents', role);
      assert.ok(await exists(roleDir), `agents/${role}/ should exist`);

      // Every role must have these core files
      for (const file of ['AGENTS.md', 'HEARTBEAT.md', 'SOUL.md', 'TOOLS.md']) {
        assert.ok(
          await exists(join(roleDir, file)),
          `agents/${role}/${file} should exist`,
        );
      }

      // AGENTS.md should not be empty
      const agentsMd = await readFile(join(roleDir, 'AGENTS.md'), 'utf-8');
      assert.ok(agentsMd.length > 10, `agents/${role}/AGENTS.md should have content`);
    }

    // --- Verify shared docs ---
    const docsDir = join(companyDir, 'docs');
    assert.ok(await exists(docsDir), 'docs/ should exist');
    assert.ok(
      await exists(join(docsDir, 'git-workflow.md')),
      'docs/git-workflow.md should exist (from github-repo module)',
    );

    // --- Verify shared doc references in AGENTS.md ---
    for (const role of expectedRoles) {
      const agentsMd = await readFile(join(companyDir, 'agents', role, 'AGENTS.md'), 'utf-8');
      assert.ok(
        agentsMd.includes('docs/git-workflow.md'),
        `${role} AGENTS.md should reference shared doc git-workflow.md`,
      );
    }

    // --- Verify BOOTSTRAP.md ---
    const bootstrap = await readFile(join(companyDir, 'BOOTSTRAP.md'), 'utf-8');
    assert.ok(bootstrap.includes('# Bootstrap: Integration Test Co'));
    assert.ok(bootstrap.includes('**Ship the MVP**'), 'BOOTSTRAP.md should include goal title');
    assert.ok(bootstrap.includes('Build and launch a working product'), 'should include goal description');
    assert.ok(bootstrap.includes('test-app'), 'should include project name');
    assert.ok(bootstrap.includes('https://github.com/test/test-app'), 'should include repo URL');
    assert.ok(bootstrap.includes('instructionsFilePath'), 'should have agent setup instructions');
    for (const role of expectedRoles) {
      assert.ok(bootstrap.includes(`agents/${role}/AGENTS.md`), `BOOTSTRAP.md should reference ${role}`);
    }

    // --- Verify initial tasks ---
    assert.ok(initialTasks.length > 0, 'should have initial tasks from modules');
    const taskTitles = initialTasks.map((t) => t.title);
    assert.ok(taskTitles.includes('Initialize GitHub repository'), 'should have github-repo task');
    assert.ok(
      taskTitles.includes('Create roadmap and generate initial backlog'),
      'should have backlog task',
    );

    // --- Verify initial tasks have resolved assignees (no unresolved capability:* references) ---
    for (const task of initialTasks) {
      assert.ok(
        !task.assignTo.startsWith('capability:'),
        `task "${task.title}" should have resolved assignee, got ${task.assignTo}`,
      );
    }
  });

  it('resolves capability ownership correctly across modules', async () => {
    const { companyDir } = await assembleCompany({
      companyName: 'CapResolution',
      moduleNames: ['backlog', 'auto-assign'],
      extraRoleNames: ['product-owner'],
      outputDir,
      templatesDir: REAL_TEMPLATES_DIR,
    });

    // product-owner is first in owners[] for both backlog-health and auto-assign
    // → product-owner should be primary, ceo should be fallback

    const poSkillsDir = join(companyDir, 'agents', 'product-owner', 'skills');
    const ceoSkillsDir = join(companyDir, 'agents', 'ceo', 'skills');

    assert.ok(await exists(poSkillsDir), 'product-owner should have skills/');
    assert.ok(await exists(ceoSkillsDir), 'ceo should have skills/');

    const poSkills = await readdir(poSkillsDir);
    const ceoSkills = await readdir(ceoSkillsDir);

    // product-owner gets primary skills
    assert.ok(poSkills.includes('auto-assign.md'), 'PO should have primary auto-assign.md');
    assert.ok(poSkills.includes('backlog-health.md'), 'PO should have primary backlog-health.md');

    // ceo gets fallback skills
    assert.ok(ceoSkills.includes('auto-assign.fallback.md'), 'CEO should have fallback auto-assign');
    assert.ok(ceoSkills.includes('backlog-health.fallback.md'), 'CEO should have fallback backlog-health');

    // ceo should NOT have the primary versions of capability skills
    assert.ok(!ceoSkills.includes('auto-assign.md'), 'CEO should not have primary auto-assign');
    assert.ok(!ceoSkills.includes('backlog-health.md'), 'CEO should not have primary backlog-health');

    // AGENTS.md should reference the installed skills
    const poAgentsMd = await readFile(join(companyDir, 'agents', 'product-owner', 'AGENTS.md'), 'utf-8');
    assert.ok(poAgentsMd.includes('auto-assign.md'), 'PO AGENTS.md should reference auto-assign');
    assert.ok(poAgentsMd.includes('backlog-health.md'), 'PO AGENTS.md should reference backlog-health');

    const ceoAgentsMd = await readFile(join(companyDir, 'agents', 'ceo', 'AGENTS.md'), 'utf-8');
    assert.ok(
      ceoAgentsMd.includes('auto-assign.fallback.md'),
      'CEO AGENTS.md should reference fallback auto-assign',
    );
  });

  it('falls back capability ownership to ceo when product-owner is absent', async () => {
    const { companyDir, initialTasks } = await assembleCompany({
      companyName: 'FallbackCo',
      moduleNames: ['backlog', 'auto-assign'],
      extraRoleNames: [],
      outputDir,
      templatesDir: REAL_TEMPLATES_DIR,
    });

    // Without product-owner, ceo is next in owners[] → ceo becomes primary
    const ceoSkillsDir = join(companyDir, 'agents', 'ceo', 'skills');
    assert.ok(await exists(ceoSkillsDir), 'ceo should have skills/');

    const ceoSkills = await readdir(ceoSkillsDir);
    assert.ok(ceoSkills.includes('auto-assign.md'), 'CEO should have primary auto-assign when PO absent');
    assert.ok(ceoSkills.includes('backlog-health.md'), 'CEO should have primary backlog-health when PO absent');

    // Backlog task should resolve to ceo
    const backlogTask = initialTasks.find((t) => t.title === 'Create roadmap and generate initial backlog');
    assert.ok(backlogTask, 'should have backlog task');
    assert.equal(backlogTask.assignTo, 'ceo', 'backlog task should fall back to ceo');
  });

  it('skips gated modules when required roles are absent', async () => {
    const progress = [];
    const { companyDir } = await assembleCompany({
      companyName: 'GatedInteg',
      moduleNames: ['pr-review'],
      extraRoleNames: [],
      outputDir,
      templatesDir: REAL_TEMPLATES_DIR,
      onProgress: (line) => progress.push(line),
    });

    // pr-review requires code-reviewer|product-owner|ui-designer|ux-researcher|qa|devops
    // None present → should be skipped
    assert.ok(
      progress.some((p) => p.includes('pr-review') && p.includes('○')),
      'pr-review should be skipped when no activating roles present',
    );
  });

  it('injects skill references into AGENTS.md with correct paths', async () => {
    const { companyDir } = await assembleCompany({
      companyName: 'SkillRefCo',
      moduleNames: ['github-repo'],
      extraRoleNames: [],
      outputDir,
      templatesDir: REAL_TEMPLATES_DIR,
    });

    // github-repo has agent-specific skill for engineer
    const engAgentsMd = await readFile(join(companyDir, 'agents', 'engineer', 'AGENTS.md'), 'utf-8');
    assert.ok(
      engAgentsMd.includes('$AGENT_HOME/skills/git-workflow.md'),
      'engineer AGENTS.md should have $AGENT_HOME skill reference for git-workflow',
    );

    // Skill file should exist at the referenced location
    assert.ok(
      await exists(join(companyDir, 'agents', 'engineer', 'skills', 'git-workflow.md')),
      'engineer skills/git-workflow.md should exist',
    );
  });

  it('generates complete output for minimal config (base roles only, no modules)', async () => {
    const { companyDir, allRoles, initialTasks } = await assembleCompany({
      companyName: 'MinimalCo',
      moduleNames: [],
      extraRoleNames: [],
      outputDir,
      templatesDir: REAL_TEMPLATES_DIR,
    });

    // Only base roles
    assert.deepEqual(allRoles, new Set(['ceo', 'engineer']));
    assert.equal(initialTasks.length, 0, 'no modules = no tasks');

    // Core files still present
    for (const role of ['ceo', 'engineer']) {
      for (const file of ['AGENTS.md', 'HEARTBEAT.md', 'SOUL.md', 'TOOLS.md']) {
        assert.ok(await exists(join(companyDir, 'agents', role, file)), `${role}/${file} should exist`);
      }
    }

    // BOOTSTRAP.md still generated
    assert.ok(await exists(join(companyDir, 'BOOTSTRAP.md')));
  });

  it('heartbeat sections are injected into HEARTBEAT.md when modules provide them', async () => {
    const { companyDir } = await assembleCompany({
      companyName: 'HeartbeatInteg',
      moduleNames: ['backlog', 'auto-assign', 'stall-detection'],
      extraRoleNames: ['product-owner'],
      outputDir,
      templatesDir: REAL_TEMPLATES_DIR,
    });

    // Check that HEARTBEAT.md files still have the marker comment (preserved for future injections)
    const ceoHeartbeat = await readFile(join(companyDir, 'agents', 'ceo', 'HEARTBEAT.md'), 'utf-8');
    assert.ok(
      ceoHeartbeat.includes('<!-- Module'),
      'CEO HEARTBEAT.md should preserve module marker comment',
    );

    // Heartbeat should not be empty
    assert.ok(ceoHeartbeat.length > 50, 'CEO HEARTBEAT.md should have substantial content');
  });

  it('no meta.json files leak into the output', async () => {
    const { companyDir } = await assembleCompany({
      companyName: 'NoMetaCo',
      moduleNames: ['github-repo', 'backlog', 'auto-assign'],
      extraRoleNames: ['product-owner'],
      outputDir,
      templatesDir: REAL_TEMPLATES_DIR,
    });

    // Recursively check no .meta.json files in the output
    async function findMetaFiles(dir) {
      const entries = await readdir(dir, { withFileTypes: true });
      const found = [];
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          found.push(...(await findMetaFiles(fullPath)));
        } else if (entry.name.endsWith('.meta.json')) {
          found.push(fullPath);
        }
      }
      return found;
    }

    const metaFiles = await findMetaFiles(companyDir);
    assert.equal(metaFiles.length, 0, `no .meta.json should leak into output, found: ${metaFiles.join(', ')}`);
  });
});
