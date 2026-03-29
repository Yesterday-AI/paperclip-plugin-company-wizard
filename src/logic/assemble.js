import {
  access,
  appendFile,
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
// modulesWithActiveGoals removed — goals no longer contain issues

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src, dest, { skipExt } = {}) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (skipExt && entry.name.endsWith(skipExt)) continue;
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, { skipExt });
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

async function appendToFile(filePath, content) {
  if (await exists(filePath)) {
    await appendFile(filePath, content);
  }
}

async function readJson(p) {
  if (!(await exists(p))) return null;
  return JSON.parse(await readFile(p, 'utf-8'));
}

/**
 * Convert a company name to PascalCase for the directory name.
 * "Black Mesa" → "BlackMesa", "my-company" → "MyCompany"
 */
export function toPascalCase(name) {
  return name
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/**
 * Assemble a company workspace from templates.
 *
 * @param {object} opts
 * @param {string} opts.companyName
 * @param {string} [opts.companyDescription] - Comprehensive company description
 * @param {Array} [opts.userGoals] - User/AI-specified goals: [{ title, description, parentGoal? }]
 * @param {Array} [opts.userProjects] - User/AI-specified projects: [{ name, description, goals[] }]
 * @param {string[]} opts.moduleNames
 * @param {string[]} opts.extraRoleNames
 * @param {Array} opts.inlineGoals - Inline goals from preset/modules (from collectGoals)
 * @param {string} opts.outputDir
 * @param {string} opts.templatesDir
 * @param {(line: string) => void} opts.onProgress
 * @returns {Promise<{companyDir: string, allRoles: Set<string>, initialIssues: Array, initialRoutines: Array, roleAdapterOverrides: Map<string, object>}>}
 */
export async function assembleCompany({
  companyName,
  companyDescription = '',
  userGoals = [],
  userProjects = [],
  moduleNames,
  extraRoleNames,
  inlineGoals = [],
  outputDir,
  templatesDir,
  onProgress = () => {},
}) {
  // --- Merge goals ---
  // The first user goal is the "main" company goal.
  // Module inline goals become sub-goals of the main goal.
  // Subgoals (formerly milestones) are expanded into allGoals with parentGoal + level.
  const mainGoal = userGoals[0] || null;
  const mergedInlineGoals = inlineGoals.map((g) => ({
    ...g,
    parentGoal: g.parentGoal || mainGoal?.title || undefined,
  }));

  const allGoals = [];
  for (const g of [...userGoals, ...mergedInlineGoals]) {
    allGoals.push(g);
    // Expand subgoals as nested goals
    if (g.subgoals?.length) {
      for (const sg of g.subgoals) {
        allGoals.push({
          title: sg.title,
          description: sg.description || '',
          level: sg.level || 'team',
          parentGoal: g.title,
        });
      }
    }
  }

  // If user specified projects, use them. Otherwise, create a default project linked to all goals.
  const resolvedProjects =
    userProjects.length > 0
      ? userProjects
      : [
          {
            name: companyName,
            description: mainGoal?.description || '',
            goals: allGoals.map((g) => g.title),
          },
        ];

  const baseDirName = toPascalCase(companyName);
  let dirName = baseDirName;
  let companyDir = join(outputDir, dirName);

  if (await exists(companyDir)) {
    let idx = 2;
    while (await exists(join(outputDir, `${baseDirName}${idx}`))) idx++;
    dirName = `${baseDirName}${idx}`;
    companyDir = join(outputDir, dirName);
  }

  // Discover base roles from roles/ directory (those with base: true in role.meta.json)
  const rolesDir = join(templatesDir, 'roles');
  const baseRoleNames = [];
  if (await exists(rolesDir)) {
    const roleDirs = await readdir(rolesDir, { withFileTypes: true });
    for (const dir of roleDirs) {
      if (!dir.isDirectory()) continue;
      const roleMeta = await readJson(join(rolesDir, dir.name, 'role.meta.json'));
      if (roleMeta?.base) {
        baseRoleNames.push(dir.name);
      }
    }
  }

  // Determine all roles present
  const allRoles = new Set([...baseRoleNames, ...extraRoleNames]);

  // Validate module dependencies before starting assembly.
  // Skip modules that won't activate (missing directory or gated by activatesWithRoles).
  const selectedSet = new Set(moduleNames);
  for (const moduleName of moduleNames) {
    const moduleDir = join(templatesDir, 'modules', moduleName);
    if (!(await exists(moduleDir))) continue;
    const moduleJson = await readJson(join(moduleDir, 'module.meta.json'));
    if (moduleJson?.activatesWithRoles?.length) {
      const hasActivatingRole = moduleJson.activatesWithRoles.some((r) => allRoles.has(r));
      if (!hasActivatingRole) continue;
    }
    const deps = moduleJson?.requires || [];
    for (const dep of deps) {
      if (!selectedSet.has(dep)) {
        throw new Error(`Module "${moduleName}" requires module "${dep}", which is not selected`);
      }
    }
  }

  // 1. Copy base roles (exclude .meta.json metadata)
  for (const roleName of baseRoleNames) {
    const roleSrc = join(rolesDir, roleName);
    const roleDest = join(companyDir, 'agents', roleName);
    await mkdir(roleDest, { recursive: true });
    const entries = await readdir(roleSrc, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await copyDir(join(roleSrc, entry.name), join(roleDest, entry.name), {
          skipExt: '.meta.json',
        });
      } else if (!entry.name.endsWith('.meta.json')) {
        await copyFile(join(roleSrc, entry.name), join(roleDest, entry.name));
      }
    }
    onProgress(`+ agents/${roleName}/ (base)`);
  }

  // 2. Copy extra roles from roles/
  for (const roleName of extraRoleNames) {
    const roleDir = join(rolesDir, roleName);
    if (!(await exists(roleDir))) {
      onProgress(`! role ${roleName} not found, skipping`);
      continue;
    }
    const destDir = join(companyDir, 'agents', roleName);
    await mkdir(destDir, { recursive: true });
    const entries = await readdir(roleDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() || !entry.name.endsWith('.md')) continue;
      await copyFile(join(roleDir, entry.name), join(destDir, entry.name));
    }
    onProgress(`+ agents/${roleName}/ (role)`);
  }

  // 3. Apply modules with capability-aware skill assignment
  const initialIssues = [];
  const initialRoutines = [];
  const roleAdapterOverrides = new Map(); // role name → merged adapter overrides from modules

  // Helper: resolve assignee for a role name or capability reference
  const resolveAssignee = (assignee, moduleJson) => {
    if (assignee?.startsWith('capability:')) {
      const capName = assignee.slice('capability:'.length);
      const cap = moduleJson?.capabilities?.find((c) => c.skill === capName);
      if (cap) return cap.owners.find((r) => allRoles.has(r)) || assignee;
    } else if (assignee && assignee !== 'ceo' && assignee !== 'user' && !allRoles.has(assignee)) {
      return 'ceo'; // Named role not in this team — fall back to CEO
    }
    return assignee;
  };

  for (const moduleName of moduleNames) {
    const moduleDir = join(templatesDir, 'modules', moduleName);
    if (!(await exists(moduleDir))) {
      onProgress(`! module ${moduleName} not found, skipping`);
      continue;
    }

    const moduleJson = await readJson(join(moduleDir, 'module.meta.json'));

    // Check activatesWithRoles
    if (moduleJson?.activatesWithRoles?.length) {
      const hasActivatingRole = moduleJson.activatesWithRoles.some((r) => allRoles.has(r));
      if (!hasActivatingRole) {
        onProgress(`○ ${moduleName} (needs ${moduleJson.activatesWithRoles.join(' or ')})`);
        continue;
      }
    }

    // Collect issues (backward compat: read tasks[] if issues[] not present)
    const moduleIssues = moduleJson?.issues || moduleJson?.tasks || [];
    for (const issue of moduleIssues) {
      initialIssues.push({
        ...issue,
        assignTo: resolveAssignee(issue.assignTo, moduleJson),
        module: moduleName,
      });
    }

    // Collect routines
    if (moduleJson?.routines?.length) {
      for (const routine of moduleJson.routines) {
        initialRoutines.push({
          ...routine,
          assignTo: resolveAssignee(routine.assignTo, moduleJson),
          module: moduleName,
        });
      }
    }

    // Copy shared docs
    const docsDir = join(moduleDir, 'docs');
    if (await exists(docsDir)) {
      await copyDir(docsDir, join(companyDir, 'docs'));
      const docs = await readdir(docsDir);
      for (const doc of docs) {
        onProgress(`+ docs/${doc} (${moduleName})`);
      }
    }

    // Resolve capabilities
    const capabilityOwners = new Map();
    if (moduleJson?.capabilities) {
      for (const cap of moduleJson.capabilities) {
        const primaryOwner = cap.owners.find((r) => allRoles.has(r));
        if (primaryOwner) {
          capabilityOwners.set(cap.skill, { primary: primaryOwner, cap });
        }
      }
    }

    // Collect adapter overrides for capability owners
    if (moduleJson?.adapterOverrides && capabilityOwners.size > 0) {
      const ownerRoles = new Set();
      for (const { primary, cap } of capabilityOwners.values()) {
        ownerRoles.add(primary);
        for (const r of cap.owners) {
          if (allRoles.has(r)) ownerRoles.add(r);
        }
      }
      for (const role of ownerRoles) {
        const existing = roleAdapterOverrides.get(role) || {};
        roleAdapterOverrides.set(role, { ...existing, ...moduleJson.adapterOverrides });
      }
    }

    // Copy agent skills.
    //
    // Skill resolution order (per role + skill name):
    //   1. Role-specific override:  agents/<role>/skills/<skill>.md
    //   2. Shared skill:            skills/<skill>.md
    //
    // For capabilities, the assembly logic decides what to copy:
    //   - Primary owner gets <skill>.md (role-specific or shared)
    //   - Fallback owners get <skill>.fallback.md (role-specific or shared)
    //   - Other combinations are skipped
    //
    // Non-capability skills (no matching capabilityOwners entry) are copied
    // as-is to the role that defines them.

    const sharedSkillsDir = join(moduleDir, 'skills');
    const agentsDir = join(moduleDir, 'agents');

    // Helper: resolve a skill file from role-specific first, then shared
    async function resolveSkillFile(roleName, fileName) {
      const roleSpecific = join(agentsDir, roleName, 'skills', fileName);
      if (await exists(roleSpecific)) return { path: roleSpecific, source: 'role' };
      const shared = join(sharedSkillsDir, fileName);
      if (await exists(shared)) return { path: shared, source: 'shared' };
      return null;
    }

    // Helper: copy a resolved skill into the agent's skills/ dir
    async function installSkill(roleName, fileName, label) {
      const resolved = await resolveSkillFile(roleName, fileName);
      if (!resolved) return false;
      const destSkillsDir = join(companyDir, 'agents', roleName, 'skills');
      await mkdir(destSkillsDir, { recursive: true });
      await copyFile(resolved.path, join(destSkillsDir, fileName));
      await appendToFile(
        join(companyDir, 'agents', roleName, 'AGENTS.md'),
        `\nRead and follow: \`$AGENT_HOME/skills/${fileName}\`\n`,
      );
      const sourceTag = resolved.source === 'shared' ? ', shared' : '';
      onProgress(`+ agents/${roleName}/skills/${fileName} (${moduleName}, ${label}${sourceTag})`);
      return true;
    }

    // Install capability-based skills for each present role
    for (const [skillName, { primary, cap }] of capabilityOwners) {
      // Primary owner gets the primary skill
      await installSkill(primary, `${skillName}.md`, 'primary');

      // Fallback owners get the fallback skill
      if (cap.fallbackSkill) {
        for (const fallbackRole of cap.owners) {
          if (fallbackRole === primary) continue;
          if (!allRoles.has(fallbackRole)) continue;
          await installSkill(fallbackRole, `${cap.fallbackSkill}.md`, 'fallback');
        }
      }
    }

    // Install non-capability skills (role-specific only, no shared lookup)
    if (await exists(agentsDir)) {
      const roles = await readdir(agentsDir, { withFileTypes: true });
      for (const role of roles) {
        if (!role.isDirectory()) continue;
        if (!allRoles.has(role.name)) continue;

        const skillsDir = join(agentsDir, role.name, 'skills');
        if (!(await exists(skillsDir))) continue;

        const skills = await readdir(skillsDir);
        for (const skillFile of skills) {
          const skillName = skillFile.replace(/\.md$/, '');
          const skillBaseName = skillName.replace(/\.fallback$/, '');

          // Skip if this skill belongs to a capability (already handled above)
          if (capabilityOwners.has(skillBaseName)) continue;

          const destSkillsDir = join(companyDir, 'agents', role.name, 'skills');
          await mkdir(destSkillsDir, { recursive: true });
          await copyFile(join(skillsDir, skillFile), join(destSkillsDir, skillFile));
          await appendToFile(
            join(companyDir, 'agents', role.name, 'AGENTS.md'),
            `\nRead and follow: \`$AGENT_HOME/skills/${skillFile}\`\n`,
          );
          onProgress(`+ agents/${role.name}/skills/${skillFile} (${moduleName})`);
        }
      }
    }
  }

  // 4. Inject module heartbeat sections into HEARTBEAT.md files
  //
  // Convention-based: if a module provides agents/<role>/heartbeat-section.md,
  // it gets appended to that role's HEARTBEAT.md (before the placeholder comment).
  // This follows the same gracefully-optimistic pattern as skills — if the file
  // exists the heartbeat extends, if not nothing breaks.
  const HEARTBEAT_MARKER =
    '<!-- Module heartbeat sections are inserted above this line during assembly -->';
  for (const moduleName of moduleNames) {
    const moduleDir = join(templatesDir, 'modules', moduleName);
    if (!(await exists(moduleDir))) continue;

    const moduleJson = await readJson(join(moduleDir, 'module.meta.json'));
    // Skip gated modules that didn't activate
    if (moduleJson?.activatesWithRoles?.length) {
      const hasActivatingRole = moduleJson.activatesWithRoles.some((r) => allRoles.has(r));
      if (!hasActivatingRole) continue;
    }

    const modAgentsDir = join(moduleDir, 'agents');
    if (!(await exists(modAgentsDir))) continue;

    const modRoles = await readdir(modAgentsDir, { withFileTypes: true });
    for (const modRole of modRoles) {
      if (!modRole.isDirectory()) continue;
      if (!allRoles.has(modRole.name)) continue;

      const sectionFile = join(modAgentsDir, modRole.name, 'heartbeat-section.md');
      if (!(await exists(sectionFile))) continue;

      const heartbeatPath = join(companyDir, 'agents', modRole.name, 'HEARTBEAT.md');
      if (!(await exists(heartbeatPath))) continue;

      const section = await readFile(sectionFile, 'utf-8');
      const heartbeat = await readFile(heartbeatPath, 'utf-8');

      // Insert before the marker comment, or append at end if marker not found
      const updated = heartbeat.includes(HEARTBEAT_MARKER)
        ? heartbeat.replace(HEARTBEAT_MARKER, section.trim() + '\n\n' + HEARTBEAT_MARKER)
        : heartbeat.trimEnd() + '\n\n' + section.trim() + '\n';

      await writeFile(heartbeatPath, updated);
      onProgress(`+ agents/${modRole.name}/HEARTBEAT.md (${moduleName}, heartbeat section)`);
    }
  }

  // 5. Add shared doc references to all AGENTS.md files
  const finalDocsDir = join(companyDir, 'docs');
  if (await exists(finalDocsDir)) {
    const docs = await readdir(finalDocsDir);
    if (docs.length > 0) {
      const agentsBaseDir = join(companyDir, 'agents');
      const agentRoles = await readdir(agentsBaseDir, { withFileTypes: true });
      for (const role of agentRoles) {
        if (!role.isDirectory()) continue;
        const agentsMd = join(agentsBaseDir, role.name, 'AGENTS.md');
        if (await exists(agentsMd)) {
          let docRefs = '\n## Shared Documentation\n';
          for (const doc of docs) {
            docRefs += `\nRead: \`docs/${doc}\`\n`;
          }
          await appendToFile(agentsMd, docRefs);
        }
      }
    }
  }

  // 6. Generate BOOTSTRAP.md
  const rolesList = [...allRoles];
  const formatRole = (r) =>
    r
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  // --- Helper: render metadata as visible bullet list ---
  const renderMeta = (fields) => {
    const lines = fields.filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (lines.length === 0) return '';
    return lines.map(([k, v]) => `- **${k}**: ${v}`).join('\n') + '\n\n';
  };

  // --- Helper: escape # in description body ---
  const escapeBody = (text) =>
    text
      .split('\n')
      .map((l) => l.replace(/^(#+)/, '\\$1'))
      .join('\n');

  let bootstrap = `# Bootstrap: ${companyName}\n\n`;

  // Company description
  if (companyDescription) {
    bootstrap += `${companyDescription}\n\n`;
  }

  // --- Goals ---
  // All goals (user goals + inline goals + expanded subgoals) rendered uniformly.
  if (allGoals.length > 0) {
    bootstrap += `## Goals\n\n`;
    for (const g of allGoals) {
      bootstrap += `### ${g.title}\n\n`;
      bootstrap += renderMeta([
        ['level', g.level || 'company'],
        ['status', 'active'],
        ['parentGoal', g.parentGoal],
      ]);
      if (g.description) {
        bootstrap += `${escapeBody(g.description)}\n\n`;
      }
    }
  }

  // --- Projects ---
  const mainProject = resolvedProjects[0];
  const mainProjectName = mainProject?.name || companyName;

  if (resolvedProjects.length > 0) {
    bootstrap += `## Projects\n\n`;
    for (const proj of resolvedProjects) {
      const projCwd = join(companyDir, 'projects', toPascalCase(proj.name));
      bootstrap += `### ${proj.name}\n\n`;
      bootstrap += renderMeta([
        ['workspace', projCwd],
        ['goals', proj.goals?.length > 0 ? proj.goals.join(', ') : undefined],
      ]);
      if (proj.description) {
        bootstrap += `${escapeBody(proj.description)}\n\n`;
      }
    }
  }

  // --- Agents ---
  bootstrap += `## Agents\n\n`;
  for (const role of rolesList) {
    bootstrap += `### ${formatRole(role)}\n\n`;
    bootstrap += renderMeta([
      ['role', role],
      ['instructionsFilePath', `${companyDir}/agents/${role}/AGENTS.md`],
    ]);
  }

  // --- Issues ---
  // All issues come from module.issues[] (project-scoped), not from goals.
  if (initialIssues.length > 0) {
    bootstrap += `## Issues\n\n`;
    for (const issue of initialIssues) {
      bootstrap += `### ${issue.title}\n\n`;
      bootstrap += renderMeta([
        ['assignee', issue.assignTo],
        ['priority', issue.priority && issue.priority !== 'medium' ? issue.priority : undefined],
        ['project', mainProjectName],
      ]);
      if (issue.description) {
        bootstrap += `${escapeBody(issue.description)}\n\n`;
      }
    }
  }

  // --- Routines ---
  if (initialRoutines.length > 0) {
    bootstrap += `## Routines\n\n`;
    for (const routine of initialRoutines) {
      bootstrap += `### ${routine.title}\n\n`;
      bootstrap += renderMeta([
        ['assignee', routine.assignTo],
        ['schedule', routine.schedule],
        [
          'priority',
          routine.priority && routine.priority !== 'medium' ? routine.priority : undefined,
        ],
        ['concurrencyPolicy', routine.concurrencyPolicy],
        ['project', mainProjectName],
      ]);
      if (routine.description) {
        bootstrap += `${escapeBody(routine.description)}\n\n`;
      }
    }
  }

  // --- Provisioning steps ---
  bootstrap += `## Provisioning Steps\n\n`;
  bootstrap += `The Company Wizard "Provision" step creates all of the above automatically.\n\n`;
  bootstrap += `Manual setup order (respects Paperclip object dependencies):\n\n`;
  let stepN = 1;
  bootstrap += `${stepN++}. **Create company** "${companyName}"${companyDescription ? ' (with description above)' : ''}\n`;
  for (const g of allGoals) {
    const parentNote = g.parentGoal ? `, parentId → "${g.parentGoal}"` : '';
    const level = g.level || 'company';
    bootstrap += `${stepN++}. **Create goal** "${g.title}" (level: ${level}${parentNote})\n`;
  }
  for (const proj of resolvedProjects) {
    const projCwd = join(companyDir, 'projects', toPascalCase(proj.name));
    const goalLinks =
      proj.goals?.length > 0 ? `, goalIds → [${proj.goals.map((g) => `"${g}"`).join(', ')}]` : '';
    bootstrap += `${stepN++}. **Create project** "${proj.name}" (workspace: \`${projCwd}\`${goalLinks})\n`;
  }
  bootstrap += `${stepN++}. **Create agents** — each with instructionsFilePath as listed above\n`;
  if (initialIssues.length > 0) {
    bootstrap += `${stepN++}. **Create issues** — link each to its project\n`;
  }
  if (initialRoutines.length > 0) {
    bootstrap += `${stepN++}. **Create routines** with cron triggers as listed above\n`;
  }
  bootstrap += `${stepN}. **Start CEO heartbeat** (one-time initial wakeup)\n`;

  await writeFile(join(companyDir, 'BOOTSTRAP.md'), bootstrap);
  onProgress('+ BOOTSTRAP.md');

  return { companyDir, allRoles, initialIssues, initialRoutines, roleAdapterOverrides };
}
