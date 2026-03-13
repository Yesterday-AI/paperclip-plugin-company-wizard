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
 *   5. Initial issues — module tasks (modules with active goals are already excluded)
 *   6. For each inline goal: sub-goal, optional project(s), milestones, issues
 *      with hierarchical project resolution (milestone project → goal project → main project)
 *
 * @param {object} opts
 * @param {import('./client.js').PaperclipClient} opts.client
 * @param {string} opts.companyName
 * @param {string} opts.companyDir - absolute path to assembled workspace
 * @param {object} opts.goal - { title, description }
 * @param {string} opts.projectName - display name for the project
 * @param {string|null} opts.projectDescription - project description
 * @param {string|null} opts.repoUrl - GitHub repository URL
 * @param {Set<string>} opts.allRoles
 * @param {Map<string, object>} opts.rolesData - role name → role.json data
 * @param {Array} opts.initialTasks - Module tasks (already filtered: modules with goals excluded)
 * @param {Array} opts.goals - Inline goals from preset and/or modules (from collectGoals)
 * @param {Map<string, object>} opts.roleAdapterOverrides - role name → adapter overrides from modules
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
  goals = [],
  roleAdapterOverrides = new Map(),
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

  // 3. Create project with workspace (linked to company goal)
  const projectCwd = join(apiCompanyDir, 'projects', toPascalCase(projectName));
  onProgress(`Creating project "${projectName}"...`);
  const project = await client.createProject(companyId, {
    name: projectName,
    description: projectDescription || (goal?.title ? `Goal: ${goal.title}` : null),
    goalIds: goalId ? [goalId] : [],
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
    const moduleOverrides = roleAdapterOverrides.get(role) || {};
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
        ...moduleOverrides,
      },
    });
    agentIds.set(role, agent.id);
    onProgress(`✓ ${title} agent created`);
  }

  // 5. Create initial issues (module tasks — modules with goals already excluded by caller)
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

  // 6. Create inline goals (from preset and/or modules)
  const goalErrors = [];
  const goalResults = [];
  for (const inlineGoal of goals) {
    const result = await provisionInlineGoal({
      client,
      companyId,
      parentGoalId: goalId,
      mainProjectId: projectId,
      inlineGoal,
      agentIds,
      apiCompanyDir,
      onProgress,
    });
    goalResults.push(result);
    issueIds.push(...result.issueIds);
    goalErrors.push(...result.errors);
    if (!firstCeoIssueId) {
      firstCeoIssueId = result.firstCeoIssueId;
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
    issuePrefix: company.issuePrefix,
    goalId,
    goalResults,
    projectId,
    projectCwd,
    agentIds,
    issueIds,
    goalErrors,
    ceoStarted,
  };
}

/**
 * Provision a single inline goal: sub-goal, optional project, milestones, issues.
 * Issues resolve to the nearest ancestor project:
 *   milestone project → goal project → main project.
 */
async function provisionInlineGoal({
  client,
  companyId,
  parentGoalId,
  mainProjectId,
  inlineGoal,
  agentIds,
  apiCompanyDir,
  onProgress,
}) {
  const errors = [];
  const issueIds = [];
  let firstCeoIssueId = null;

  // Create sub-goal under the company goal
  onProgress(`Creating goal: ${inlineGoal.title}...`);
  const tg = await client.createGoal(companyId, {
    title: inlineGoal.title,
    description: inlineGoal.description,
    level: 'company',
    parentId: parentGoalId,
  });
  const inlineGoalId = tg.id;
  onProgress(`✓ Goal created: ${inlineGoal.title}`);

  // Create goal-level project if project !== false (default: true)
  const wantsProject = inlineGoal.project !== false;
  let goalProjectId = null;
  if (wantsProject) {
    const goalProjectCwd = join(apiCompanyDir, 'projects', toPascalCase(inlineGoal.title));
    onProgress(`Creating project "${inlineGoal.title}"...`);
    const gp = await client.createProject(companyId, {
      name: inlineGoal.title,
      description: inlineGoal.description,
      goalIds: [inlineGoalId],
      workspace: {
        cwd: goalProjectCwd,
        isPrimary: true,
      },
    });
    goalProjectId = gp.id;
    onProgress(`✓ Project "${inlineGoal.title}" created`);
  }

  // Create milestones as sub-goals, with optional milestone-level projects
  const milestoneIds = new Map(); // milestone id → API goal UUID
  const milestoneProjectIds = new Map(); // milestone id → project UUID (if milestone has project)
  if (inlineGoal.milestones?.length) {
    for (const milestone of inlineGoal.milestones) {
      try {
        onProgress(`Creating milestone: ${milestone.title}...`);
        const mg = await client.createGoal(companyId, {
          title: milestone.title,
          description: milestone.description,
          level: 'task',
          parentId: inlineGoalId,
        });
        milestoneIds.set(milestone.id, mg.id);
        onProgress(`✓ Milestone created: ${milestone.title}`);

        // Milestone-level project
        if (milestone.project) {
          const msCwd = join(apiCompanyDir, 'projects', toPascalCase(milestone.title));
          onProgress(`Creating project "${milestone.title}"...`);
          const mp = await client.createProject(companyId, {
            name: milestone.title,
            description: milestone.description,
            goalIds: [mg.id],
            workspace: { cwd: msCwd, isPrimary: true },
          });
          milestoneProjectIds.set(milestone.id, mp.id);
          onProgress(`✓ Project "${milestone.title}" created`);
        }
      } catch (err) {
        errors.push({ title: milestone.title, error: err.message });
        onProgress(`! Failed to create milestone: ${milestone.title} — ${err.message}`);
      }
    }
  }

  // Create issues with hierarchical project resolution:
  //   milestone project → goal project → main project
  if (inlineGoal.issues?.length) {
    for (const issue of inlineGoal.issues) {
      try {
        const issueGoalId = (issue.milestone && milestoneIds.get(issue.milestone)) || inlineGoalId;

        // Resolve project: walk up — milestone project → goal project → main project
        let issueProjectId;
        if (issue.milestone && milestoneProjectIds.has(issue.milestone)) {
          issueProjectId = milestoneProjectIds.get(issue.milestone);
        } else if (goalProjectId) {
          issueProjectId = goalProjectId;
        } else {
          issueProjectId = mainProjectId;
        }

        const isUserTask = issue.assignTo === 'user';
        const assigneeAgentId =
          issue.assignTo && !isUserTask ? agentIds.get(issue.assignTo) || null : null;
        const assigneeUserId = isUserTask ? client.boardUserId || null : null;
        onProgress(`Creating issue: ${issue.title}...`);
        const created = await client.createIssue(companyId, {
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          projectId: issueProjectId,
          goalId: issueGoalId,
          assigneeAgentId,
          assigneeUserId,
        });
        issueIds.push(created.id);
        if (issue.assignTo === 'ceo' && !firstCeoIssueId) {
          firstCeoIssueId = created.id;
        }
        const assignLabel = isUserTask
          ? ' → board (human)'
          : assigneeAgentId
            ? ` → ${issue.assignTo}`
            : '';
        onProgress(`✓ Issue created: ${issue.title}${assignLabel}`);
      } catch (err) {
        errors.push({ title: issue.title, error: err.message });
        onProgress(`! Failed to create issue: ${issue.title} — ${err.message}`);
      }
    }
  }

  return {
    goalId: inlineGoalId,
    goalProjectId,
    milestoneIds,
    milestoneProjectIds,
    issueIds,
    errors,
    firstCeoIssueId,
  };
}
