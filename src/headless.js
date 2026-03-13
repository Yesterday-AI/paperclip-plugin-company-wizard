import { join, basename } from 'node:path';
import { loadPresets, loadModules, loadRoles, loadGoals } from './logic/load-templates.js';
import { resolveCapabilities, buildAllRoles } from './logic/resolve.js';
import { assembleCompany } from './logic/assemble.js';
import { PaperclipClient } from './api/client.js';
import { provisionCompany } from './api/provision.js';

/**
 * Run Clipper in headless (non-interactive) mode.
 *
 * @param {object} opts
 * @param {string} opts.name - Company name
 * @param {string} opts.goal - Goal title
 * @param {string|null} opts.goalDescription - Goal description
 * @param {string} opts.preset - Preset name
 * @param {string|null} opts.projectName - Project name (defaults to company name)
 * @param {string|null} opts.projectDescription - Project description
 * @param {string|null} opts.repo - GitHub repo URL
 * @param {string[]} opts.modules - Extra modules (on top of preset)
 * @param {string[]} opts.roles - Extra roles (on top of preset)
 * @param {string|null} opts.goalTemplate - Goal template name (from templates/goals/)
 * @param {string} opts.outputDir - Output directory
 * @param {string} opts.templatesDir - Templates directory
 * @param {boolean} opts.dryRun - Show summary and exit without writing files
 * @param {boolean} opts.apiEnabled - Provision via API
 * @param {string} opts.apiBaseUrl - API base URL
 * @param {string|null} opts.model - LLM model
 * @param {boolean} opts.startCeo - Start CEO heartbeat
 */
export async function runHeadless(opts) {
  const log = (msg) => console.log(msg);

  // Load templates
  const [presets, modules, allAvailableRoles, goalTemplates] = await Promise.all([
    loadPresets(opts.templatesDir),
    loadModules(opts.templatesDir),
    loadRoles(opts.templatesDir),
    loadGoals(opts.templatesDir),
  ]);

  // Resolve preset
  let presetModules = [];
  let presetRoles = [];

  if (opts.preset && opts.preset !== 'custom') {
    const preset = presets.find((p) => p.name === opts.preset);
    if (!preset) {
      const names = presets.map((p) => p.name).join(', ');
      console.error(`Error: unknown preset "${opts.preset}". Available: ${names}`);
      process.exit(1);
    }
    presetModules = preset.modules || [];
    presetRoles = preset.roles || [];
  }

  // Merge preset + CLI selections (deduplicated)
  const selectedModules = [...new Set([...presetModules, ...opts.modules])];
  const selectedRoles = [...new Set([...presetRoles, ...opts.roles])];

  // Validate module names
  const moduleNames = new Set(modules.map((m) => m.name));
  for (const mod of selectedModules) {
    if (!moduleNames.has(mod)) {
      const names = [...moduleNames].join(', ');
      console.error(`Error: unknown module "${mod}". Available: ${names}`);
      process.exit(1);
    }
  }

  // Validate role names
  const roleNames = new Set(allAvailableRoles.filter((r) => !r.base).map((r) => r.name));
  for (const role of selectedRoles) {
    if (!roleNames.has(role)) {
      const names = [...roleNames].join(', ');
      console.error(`Error: unknown role "${role}". Available: ${names}`);
      process.exit(1);
    }
  }

  // Resolve goal template
  let selectedGoalTemplate = null;
  if (opts.goalTemplate) {
    selectedGoalTemplate = goalTemplates.find((g) => g.name === opts.goalTemplate);
    if (!selectedGoalTemplate) {
      const names = goalTemplates.map((g) => g.name).join(', ');
      console.error(
        `Error: unknown goal template "${opts.goalTemplate}". Available: ${names || '(none)'}`,
      );
      process.exit(1);
    }
  }

  // Build derived state
  const allRolesSet = buildAllRoles(allAvailableRoles, selectedRoles);
  const capabilities = resolveCapabilities(modules, selectedModules, allRolesSet);

  const rolesData = new Map();
  for (const r of allAvailableRoles) {
    rolesData.set(r.name, r);
  }

  const project = {
    name: opts.projectName || opts.name,
    description: opts.projectDescription || null,
    repoUrl: opts.repo || null,
  };

  const goal = {
    title: opts.goal || '',
    description: opts.goalDescription || null,
  };

  // Print summary
  log('');
  log(`  Company:  ${opts.name}`);
  if (goal.title) log(`  Goal:     ${goal.title}`);
  log(`  Project:  ${project.name}`);
  if (project.repoUrl) log(`  Repo:     ${project.repoUrl}`);
  log(`  Preset:   ${opts.preset || 'custom'}`);
  log(`  Modules:  ${selectedModules.join(', ') || '(none)'}`);
  const baseRoleNames = allAvailableRoles.filter((r) => r.base).map((r) => r.name);
  log(`  Roles:    ${[...baseRoleNames, ...selectedRoles].join(', ')}`);
  if (selectedGoalTemplate) {
    log(
      `  Starter:  ${selectedGoalTemplate.title} (${selectedGoalTemplate.issues?.length || 0} issues)`,
    );
  }
  if (capabilities.length) {
    log(`  Capabilities:`);
    for (const cap of capabilities) {
      log(`    ${cap.skill}: ${cap.primary}`);
    }
  }
  log('');

  if (opts.dryRun) {
    log('Dry run — no files written.');
    return;
  }

  // Assemble
  log('Assembling workspace...');
  const assemblyResult = await assembleCompany({
    companyName: opts.name,
    goal,
    project,
    moduleNames: selectedModules,
    extraRoleNames: selectedRoles,
    goalTemplate: selectedGoalTemplate,
    outputDir: opts.outputDir,
    templatesDir: opts.templatesDir,
    onProgress: (line) => log(`  ${line}`),
  });
  log(`Workspace assembled: ${assemblyResult.companyDir}`);

  // Provision via API
  if (opts.apiEnabled) {
    log('');
    log('Provisioning via Paperclip API...');
    const client = new PaperclipClient(opts.apiBaseUrl, {
      email: opts.apiEmail,
      password: opts.apiPassword,
    });
    await client.connect();

    const provisionResult = await provisionCompany({
      client,
      companyName: opts.name,
      companyDir: assemblyResult.companyDir,
      goal,
      projectName: project.name,
      projectDescription: project.description,
      repoUrl: project.repoUrl,
      allRoles: assemblyResult.allRoles,
      rolesData,
      initialTasks: assemblyResult.initialTasks,
      goalTemplate: assemblyResult.goalTemplate,
      model: opts.model,
      remoteCompanyDir: opts.apiWorkspaceRoot
        ? join(opts.apiWorkspaceRoot, basename(assemblyResult.companyDir))
        : null,
      startCeo: opts.startCeo,
      onProgress: (line) => log(`  ${line}`),
    });

    log('');
    log('Provisioned:');
    log(`  Company:  ${provisionResult.companyId}`);
    if (provisionResult.goalId) log(`  Goal:     ${provisionResult.goalId}`);
    if (provisionResult.goalTemplateId) log(`  Starter:  ${provisionResult.goalTemplateId}`);
    log(`  Project:  ${provisionResult.projectId}`);
    log(`  Workspace: ${provisionResult.projectCwd}`);
    for (const [role, id] of provisionResult.agentIds) {
      log(`  Agent:    ${role} (${id})`);
    }
    if (provisionResult.issueIds.length) {
      log(`  Issues:   ${provisionResult.issueIds.length} created`);
    }
    if (provisionResult.goalTemplateErrors?.length) {
      log(
        `  Warnings: ${provisionResult.goalTemplateErrors.length} goal template issue(s) failed:`,
      );
      for (const e of provisionResult.goalTemplateErrors) {
        log(`    ! ${e.title}: ${e.error}`);
      }
    }
    if (provisionResult.ceoStarted) {
      log(`  CEO heartbeat started`);
    }
  }

  log('');
  log(`Done. Workspace: ${assemblyResult.companyDir}`);
  if (!opts.apiEnabled) {
    log('Follow BOOTSTRAP.md to set up in the Paperclip UI, or re-run with --api.');
  }
}
