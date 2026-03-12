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
 * @param {object} opts.goal - { title, description }
 * @param {object} opts.project - { name, repoUrl }
 * @param {string[]} opts.moduleNames
 * @param {string[]} opts.extraRoleNames
 * @param {string} opts.outputDir
 * @param {string} opts.templatesDir
 * @param {(line: string) => void} opts.onProgress
 * @returns {Promise<{companyDir: string, allRoles: Set<string>, initialTasks: Array}>}
 */
export async function assembleCompany({
  companyName,
  goal = {},
  project = {},
  moduleNames,
  extraRoleNames,
  outputDir,
  templatesDir,
  onProgress = () => {},
}) {
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
  const initialTasks = [];
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

    // Collect initial tasks
    if (moduleJson?.tasks?.length) {
      for (const task of moduleJson.tasks) {
        let assignee = task.assignTo;
        if (assignee?.startsWith('capability:')) {
          const capName = assignee.slice('capability:'.length);
          const cap = moduleJson.capabilities?.find((c) => c.skill === capName);
          if (cap) {
            assignee = cap.owners.find((r) => allRoles.has(r)) || assignee;
          }
        }
        initialTasks.push({ ...task, assignTo: assignee, module: moduleName });
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

  let bootstrap = `# Bootstrap: ${companyName}\n\n`;

  // Goal
  if (goal?.title) {
    bootstrap += `## Goal\n\n`;
    bootstrap += `**${goal.title}**\n`;
    if (goal.description) {
      bootstrap += `${goal.description}\n`;
    }
    bootstrap += `\n`;
  }

  // Project
  const projectName = project?.name || companyName;
  const projectCwd = join(companyDir, 'projects', toPascalCase(projectName));
  bootstrap += `## Project\n\n`;
  bootstrap += `- **Name**: ${projectName}\n`;
  if (project?.description) {
    bootstrap += `- **Description**: ${project.description}\n`;
  }
  bootstrap += `- **Workspace**: \`${projectCwd}\`\n`;
  if (project?.repoUrl) {
    bootstrap += `- **Repository**: ${project.repoUrl}\n`;
  }
  bootstrap += `\n`;

  // Agents
  bootstrap += `## Agents\n\n`;
  bootstrap += `Create the following agents in Paperclip. Set each agent's working directory to this workspace and the instructions file as shown.\n\n`;
  for (const role of rolesList) {
    bootstrap += `### ${formatRole(role)}\n`;
    bootstrap += `- **instructionsFilePath**: \`${companyDir}/agents/${role}/AGENTS.md\`\n`;
    bootstrap += `- **cwd**: \`${companyDir}\`\n\n`;
  }

  // Initial tasks
  if (initialTasks.length > 0) {
    bootstrap += `## Initial Tasks\n\n`;
    bootstrap += `Create these as issues (linked to the project and goal) to kick off workflows:\n\n`;
    for (const task of initialTasks) {
      bootstrap += `- **${task.title}** → assign to ${task.assignTo}\n`;
      if (task.description) {
        bootstrap += `  ${task.description}\n`;
      }
    }
    bootstrap += `\n`;
  }

  // Get started
  bootstrap += `## Get Started\n\n`;
  bootstrap += `If using \`clipper --api\`, all of the above is created automatically.\n\n`;
  bootstrap += `Otherwise, create manually in the Paperclip UI:\n`;
  bootstrap += `1. Create the company "${companyName}"\n`;
  bootstrap += `2. Create the project "${projectName}" with workspace → \`${projectCwd}\`\n`;
  if (project?.repoUrl) {
    bootstrap += `   Set the repository to: ${project.repoUrl}\n`;
  }
  let stepN = 3;
  bootstrap += `${stepN++}. Create each agent listed above\n`;
  if (goal?.title) {
    bootstrap += `${stepN++}. Create the goal: "${goal.title}"\n`;
  }
  if (initialTasks.length > 0) {
    bootstrap += `${stepN++}. Create the initial issues listed above\n`;
  }
  bootstrap += `${stepN}. Start the CEO heartbeat\n`;

  await writeFile(join(companyDir, 'BOOTSTRAP.md'), bootstrap);
  onProgress('+ BOOTSTRAP.md');

  return { companyDir, allRoles, initialTasks };
}
