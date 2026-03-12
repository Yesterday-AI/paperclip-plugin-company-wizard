import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * @typedef {Object} GoalMilestone
 * @property {string} id - Unique identifier (kebab-case), referenced by issues.
 * @property {string} title
 * @property {string} [description]
 * @property {string} [completionCriteria]
 */

/**
 * @typedef {Object} GoalIssue
 * @property {string} title
 * @property {string} [description]
 * @property {'critical'|'high'|'medium'|'low'} [priority]
 * @property {string} [milestone] - ID of the milestone this issue belongs to.
 * @property {string} [assignTo] - Role name or 'capability:<skill>'.
 */

/**
 * @typedef {Object} GoalTemplate
 * @property {string} title
 * @property {string} description
 * @property {GoalMilestone[]} [milestones]
 * @property {GoalIssue[]} [issues]
 */

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p) {
  if (!(await exists(p))) return null;
  return JSON.parse(await readFile(p, 'utf-8'));
}

export async function loadPresets(templatesDir) {
  const presetsDir = join(templatesDir, 'presets');
  const presets = [];
  if (!(await exists(presetsDir))) return presets;
  const dirs = await readdir(presetsDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const presetFile = join(presetsDir, dir.name, 'preset.meta.json');
    if (await exists(presetFile)) {
      presets.push(JSON.parse(await readFile(presetFile, 'utf-8')));
    }
  }
  return presets;
}

export async function loadModules(templatesDir) {
  const modulesDir = join(templatesDir, 'modules');
  const modules = [];
  if (!(await exists(modulesDir))) return modules;
  const dirs = await readdir(modulesDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const moduleJson = await readJson(join(modulesDir, dir.name, 'module.meta.json'));
    const readmePath = join(modulesDir, dir.name, 'README.md');
    let description = '';
    if (await exists(readmePath)) {
      const content = await readFile(readmePath, 'utf-8');
      const descLine = content.split('\n').find((l) => l.length > 0 && !l.startsWith('#'));
      description = descLine?.trim() || '';
    }
    modules.push({ name: dir.name, description, ...(moduleJson || {}) });
  }
  return modules;
}

export async function loadRoles(templatesDir) {
  const rolesDir = join(templatesDir, 'roles');
  const roles = [];
  if (!(await exists(rolesDir))) return roles;

  const dirs = await readdir(rolesDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const roleJson = await readJson(join(rolesDir, dir.name, 'role.meta.json'));
    if (roleJson) {
      roles.push(roleJson);
    }
  }

  return roles;
}

const VALID_PRIORITIES = new Set(['critical', 'high', 'medium', 'low']);
const MILESTONE_ID_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Validate a goal template object against the schema rules.
 * Throws on invalid data.
 * @param {GoalTemplate} goal
 * @param {string} sourceName - filename/dir name for error context
 */
function validateGoalTemplate(goal, sourceName) {
  if (!goal.title || typeof goal.title !== 'string') {
    throw new Error(`Goal template "${sourceName}": missing or invalid "title"`);
  }
  if (!goal.description || typeof goal.description !== 'string') {
    throw new Error(`Goal template "${sourceName}": missing or invalid "description"`);
  }

  const milestoneIds = new Set();

  if (goal.milestones) {
    if (!Array.isArray(goal.milestones)) {
      throw new Error(`Goal template "${sourceName}": "milestones" must be an array`);
    }
    for (const m of goal.milestones) {
      if (!m.id || typeof m.id !== 'string' || !MILESTONE_ID_RE.test(m.id)) {
        throw new Error(
          `Goal template "${sourceName}": milestone "id" must be kebab-case (got "${m.id}")`,
        );
      }
      if (milestoneIds.has(m.id)) {
        throw new Error(`Goal template "${sourceName}": duplicate milestone id "${m.id}"`);
      }
      milestoneIds.add(m.id);
      if (!m.title || typeof m.title !== 'string') {
        throw new Error(`Goal template "${sourceName}": milestone "${m.id}" missing "title"`);
      }
    }
  }

  if (goal.issues) {
    if (!Array.isArray(goal.issues)) {
      throw new Error(`Goal template "${sourceName}": "issues" must be an array`);
    }
    for (let i = 0; i < goal.issues.length; i++) {
      const issue = goal.issues[i];
      if (!issue.title || typeof issue.title !== 'string') {
        throw new Error(`Goal template "${sourceName}": issue[${i}] missing "title"`);
      }
      if (issue.priority && !VALID_PRIORITIES.has(issue.priority)) {
        throw new Error(
          `Goal template "${sourceName}": issue[${i}] invalid priority "${issue.priority}"`,
        );
      }
      if (issue.milestone && !milestoneIds.has(issue.milestone)) {
        throw new Error(
          `Goal template "${sourceName}": issue[${i}] references unknown milestone "${issue.milestone}"`,
        );
      }
    }
  }
}

/**
 * Load and validate goal templates from the templates directory.
 * Convention: goals/<name>/goal.meta.json
 * @param {string} templatesDir
 * @returns {Promise<GoalTemplate[]>}
 */
export async function loadGoals(templatesDir) {
  const goalsDir = join(templatesDir, 'goals');
  const goals = [];
  if (!(await exists(goalsDir))) return goals;

  const dirs = await readdir(goalsDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const goalJson = await readJson(join(goalsDir, dir.name, 'goal.meta.json'));
    if (!goalJson) continue;
    validateGoalTemplate(goalJson, dir.name);
    goals.push({ name: dir.name, ...goalJson });
  }

  return goals;
}

export { validateGoalTemplate };
