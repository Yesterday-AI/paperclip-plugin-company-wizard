import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * @typedef {Object} GoalMilestone
 * @property {string} id - Unique identifier (kebab-case), referenced by issues.
 * @property {string} title
 * @property {string} [description]
 * @property {string} [completionCriteria]
 * @property {boolean} [project] - If true, creates a dedicated project for this milestone.
 */

/**
 * @typedef {Object} GoalIssue
 * @property {string} title
 * @property {string} [description]
 * @property {'critical'|'high'|'medium'|'low'} [priority]
 * @property {string} [milestone] - ID of the milestone this issue belongs to.
 * @property {string} [assignTo] - Role name, 'capability:<skill>', or 'user' (unassigned, for human pickup).
 */

/**
 * @typedef {Object} InlineGoal
 * @property {string} title
 * @property {string} description
 * @property {boolean} [project] - If true, creates a dedicated project for this goal. Default: true.
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
      const preset = JSON.parse(await readFile(presetFile, 'utf-8'));
      // Validate inline goals if present
      if (preset.goals) {
        for (const goal of preset.goals) {
          validateGoal(goal, `preset "${preset.name}"`);
        }
      }
      presets.push(preset);
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
    const mod = { name: dir.name, description, ...(moduleJson || {}) };
    // Validate inline goal if present
    if (mod.goal) {
      validateGoal(mod.goal, `module "${mod.name}"`);
    }
    modules.push(mod);
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
 * Validate an inline goal object (from module or preset).
 * Throws on invalid data.
 * @param {InlineGoal} goal
 * @param {string} sourceName - context for error messages (e.g. 'module "ci-cd"')
 */
function validateGoal(goal, sourceName) {
  if (!goal.title || typeof goal.title !== 'string') {
    throw new Error(`Goal in ${sourceName}: missing or invalid "title"`);
  }
  if (!goal.description || typeof goal.description !== 'string') {
    throw new Error(`Goal in ${sourceName}: missing or invalid "description"`);
  }

  const milestoneIds = new Set();

  if (goal.milestones) {
    if (!Array.isArray(goal.milestones)) {
      throw new Error(`Goal in ${sourceName}: "milestones" must be an array`);
    }
    for (const m of goal.milestones) {
      if (!m.id || typeof m.id !== 'string' || !MILESTONE_ID_RE.test(m.id)) {
        throw new Error(`Goal in ${sourceName}: milestone "id" must be kebab-case (got "${m.id}")`);
      }
      if (milestoneIds.has(m.id)) {
        throw new Error(`Goal in ${sourceName}: duplicate milestone id "${m.id}"`);
      }
      milestoneIds.add(m.id);
      if (!m.title || typeof m.title !== 'string') {
        throw new Error(`Goal in ${sourceName}: milestone "${m.id}" missing "title"`);
      }
    }
  }

  if (goal.issues) {
    if (!Array.isArray(goal.issues)) {
      throw new Error(`Goal in ${sourceName}: "issues" must be an array`);
    }
    for (let i = 0; i < goal.issues.length; i++) {
      const issue = goal.issues[i];
      if (!issue.title || typeof issue.title !== 'string') {
        throw new Error(`Goal in ${sourceName}: issue[${i}] missing "title"`);
      }
      if (issue.priority && !VALID_PRIORITIES.has(issue.priority)) {
        throw new Error(`Goal in ${sourceName}: issue[${i}] invalid priority "${issue.priority}"`);
      }
      if (issue.milestone && !milestoneIds.has(issue.milestone)) {
        throw new Error(
          `Goal in ${sourceName}: issue[${i}] references unknown milestone "${issue.milestone}"`,
        );
      }
    }
  }
}

/**
 * Collect all active goals from selected preset and modules.
 *
 * Sources (in order):
 *   1. Preset `goals[]` — inline goals from the selected preset
 *   2. Module `goal` — inline goal from each selected module that has one
 *
 * When a module has a `goal`, its `tasks` are skipped from initialTasks
 * (the goal's issues are the comprehensive version).
 *
 * @param {object|null} preset - The selected preset object
 * @param {object[]} modules - All loaded modules
 * @param {Set<string>} selectedModules - Names of selected modules
 * @returns {InlineGoal[]}
 */
export function collectGoals(preset, modules, selectedModules) {
  const goals = [];

  // 1. Preset goals
  if (preset?.goals) {
    for (const goal of preset.goals) {
      goals.push({ ...goal, _source: `preset:${preset.name}` });
    }
  }

  // 2. Module goals (only from selected modules)
  for (const mod of modules) {
    if (!selectedModules.has(mod.name)) continue;
    if (!mod.goal) continue;
    goals.push({ ...mod.goal, _source: `module:${mod.name}`, _module: mod.name });
  }

  return goals;
}

/**
 * Return the set of module names that have an active goal.
 * Used to skip their tasks from initialTasks during assembly.
 * @param {InlineGoal[]} goals - from collectGoals()
 * @returns {Set<string>}
 */
export function modulesWithActiveGoals(goals) {
  const names = new Set();
  for (const g of goals) {
    if (g._module) names.add(g._module);
  }
  return names;
}

export { validateGoal, validateGoal as validateGoalTemplate };
