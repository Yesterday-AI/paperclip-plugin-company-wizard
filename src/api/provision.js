import { join } from 'node:path';
import { PaperclipClient } from './client.js';
import { formatRoleName } from '../logic/resolve.js';
import { toPascalCase } from '../logic/assemble.js';

/**
 * Provision a company in Paperclip via the API.
 *
 * Creates (in order):
 *   1. Company
 *   2. Company-level goal
 *   3. Project with local workspace (cwd → company dir)
 *   4. Agents (with per-role adapter config from role.json)
 *   5. Initial issues (linked to goal + project)
 *
 * @param {object} opts
 * @param {PaperclipClient} opts.client
 * @param {string} opts.companyName
 * @param {string} opts.companyDir - absolute path to assembled workspace
 * @param {object} opts.goal - { title, description }
 * @param {string} opts.projectName - display name for the project
 * @param {string|null} opts.projectDescription - project description
 * @param {string|null} opts.repoUrl - GitHub repository URL
 * @param {Set<string>} opts.allRoles
 * @param {Map<string, object>} opts.rolesData - role name → role.json data
 * @param {Array} opts.initialTasks
 * @param {object|null} opts.goalTemplate - Selected goal template (issues to provision under a separate goal)
 * @param {string|null} opts.model - LLM model fallback (overridden by role.json adapter.model)
 * @param {string|null} opts.remoteCompanyDir - override companyDir for API paths (Docker mount path)
 * @param {boolean} opts.startCeo - trigger CEO heartbeat after provisioning
 * @param {(line: string) => void} opts.onProgress
 */
export async function provisionCompany({
  client,
  companyName,
  companyDir,
  goal,
  projectName,
  projectDescription = null,
  repoUrl = null,
  allRoles,
  rolesData = new Map(),
  initialTasks = [],
  goalTemplate = null,
  model = null,
  remoteCompanyDir = null,
  startCeo = false,
  onProgress = () => {},
}) {
  // API paths: use remoteCompanyDir (Docker) if set, otherwise local companyDir
  const apiCompanyDir = remoteCompanyDir || companyDir;
  // 1. Create company
  onProgress('Creating company...');
  const company = await client.createCompany({ name: companyName });
  const companyId = company.id;
  onProgress(`✓ Company "${companyName}" created`);

  // 2. Create company goal
  let goalId = null;
  if (goal?.title) {
    onProgress(`Creating goal: ${goal.title}...`);
    const g = await client.createGoal(companyId, {
      title: goal.title,
      description: goal.description,
      level: 'company',
    });
    goalId = g.id;
    onProgress(`✓ Goal created: ${goal.title}`);
  }

  // 3. Create project with workspace
  const projectCwd = join(apiCompanyDir, 'projects', toPascalCase(projectName));
  onProgress(`Creating project "${projectName}"...`);
  const project = await client.createProject(companyId, {
    name: projectName,
    description: projectDescription || (goal?.title ? `Goal: ${goal.title}` : null),
    workspace: {
      cwd: projectCwd,
      ...(repoUrl ? { repoUrl } : {}),
      isPrimary: true,
    },
  });
  const projectId = project.id;
  onProgress(`✓ Project "${projectName}" created`);
  onProgress(`  workspace: ${projectCwd}`);
  if (repoUrl) {
    onProgress(`  repo: ${repoUrl}`);
  }

  // 4. Create agents (CEO first, then others with reportsTo)
  const agentIds = new Map();

  // Sort roles: CEO first so other agents can reference its ID via reportsTo
  const sortedRoles = [...allRoles].sort((a, b) => (a === 'ceo' ? -1 : b === 'ceo' ? 1 : 0));

  for (const role of sortedRoles) {
    const roleData = rolesData.get(role);
    const paperclipRole = PaperclipClient.resolveRole(role, roleData);
    const title = formatRoleName(role);

    // Role-specific adapter config from role.json, CLI --model as fallback
    const roleAdapter = roleData?.adapter || {};
    const agentModel = roleAdapter.model || model;

    // Resolve reportsTo from role.json role name → agent UUID
    const reportsToRole = roleData?.reportsTo || null;
    const reportsToAgentId = reportsToRole ? agentIds.get(reportsToRole) || null : null;

    onProgress(`Creating ${title} agent...`);
    const agent = await client.createAgent(companyId, {
      name: title,
      role: paperclipRole,
      title,
      reportsTo: reportsToAgentId,
      adapterConfig: {
        cwd: apiCompanyDir,
        instructionsFilePath: join(apiCompanyDir, `agents/${role}/AGENTS.md`),
        ...(agentModel ? { model: agentModel } : {}),
        ...Object.fromEntries(Object.entries(roleAdapter).filter(([k]) => k !== 'model')),
      },
    });
    agentIds.set(role, agent.id);
    onProgress(`✓ ${title} agent created`);
  }

  // 5. Create initial issues (linked to goal + project, assigned to agents)
  const issueIds = [];
  let firstCeoIssueId = null;
  for (const task of initialTasks) {
    const assigneeAgentId = agentIds.get(task.assignTo) || null;
    onProgress(`Creating issue: ${task.title}...`);
    const issue = await client.createIssue(companyId, {
      title: task.title,
      description: task.description,
      projectId,
      goalId,
      assigneeAgentId,
    });
    issueIds.push(issue.id);
    if (task.assignTo === 'ceo' && !firstCeoIssueId) {
      firstCeoIssueId = issue.id;
    }
    const assignLabel = assigneeAgentId ? ` → ${task.assignTo}` : '';
    onProgress(`✓ Issue created: ${task.title}${assignLabel}`);
  }

  // 6. Create goal template goal and issues (if selected)
  // Issues are left unassigned — auto-assign handles assignment.
  let goalTemplateId = null;
  const goalTemplateErrors = [];
  if (goalTemplate) {
    onProgress(`Creating starter goal: ${goalTemplate.title}...`);
    const tg = await client.createGoal(companyId, {
      title: goalTemplate.title,
      description: goalTemplate.description,
      level: 'company',
    });
    goalTemplateId = tg.id;
    onProgress(`✓ Starter goal created: ${goalTemplate.title}`);

    if (goalTemplate.issues?.length) {
      for (const issue of goalTemplate.issues) {
        try {
          onProgress(`Creating issue: ${issue.title}...`);
          const created = await client.createIssue(companyId, {
            title: issue.title,
            description: issue.description,
            priority: issue.priority,
            projectId,
            goalId: goalTemplateId,
          });
          issueIds.push(created.id);
          onProgress(`✓ Issue created: ${issue.title}`);
        } catch (err) {
          goalTemplateErrors.push({ title: issue.title, error: err.message });
          onProgress(`! Failed to create issue: ${issue.title} — ${err.message}`);
        }
      }
    }
  }

  // 7. Optionally start CEO heartbeat (with issue context for workspace resolution)
  let ceoStarted = false;
  if (startCeo) {
    const ceoAgentId = agentIds.get('ceo');
    if (ceoAgentId) {
      onProgress('Starting CEO heartbeat...');
      try {
        await client.triggerHeartbeat(ceoAgentId, {
          issueId: firstCeoIssueId,
        });
        ceoStarted = true;
        onProgress('✓ CEO heartbeat started');
      } catch (err) {
        onProgress(`! Could not start CEO heartbeat: ${err.message}`);
      }
    }
  }

  return {
    companyId,
    goalId,
    goalTemplateId,
    projectId,
    projectCwd,
    agentIds,
    issueIds,
    goalTemplateErrors,
    ceoStarted,
  };
}
