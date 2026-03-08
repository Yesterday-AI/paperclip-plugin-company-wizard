import {
  access,
  appendFile,
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
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
  return JSON.parse(await readFile(p, "utf-8"));
}

/**
 * Assemble a company workspace from templates.
 *
 * @param {object} opts
 * @param {string} opts.companyName
 * @param {string} opts.baseName
 * @param {string[]} opts.moduleNames
 * @param {string[]} opts.extraRoleNames
 * @param {string} opts.outputDir
 * @param {string} opts.templatesDir
 * @param {(line: string) => void} opts.onProgress
 * @returns {Promise<{companyDir: string, allRoles: Set<string>, initialTasks: Array}>}
 */
export async function assembleCompany({
  companyName,
  baseName,
  moduleNames,
  extraRoleNames,
  outputDir,
  templatesDir,
  onProgress = () => {},
}) {
  const companyDir = join(outputDir, companyName);

  if (await exists(companyDir)) {
    throw new Error(`Company directory already exists: ${companyDir}`);
  }

  // Determine all roles present
  const baseDir = join(templatesDir, baseName);
  const baseEntries = await readdir(baseDir, { withFileTypes: true });
  const allRoles = new Set(
    baseEntries.filter((e) => e.isDirectory()).map((e) => e.name)
  );
  for (const role of extraRoleNames) allRoles.add(role);

  // 1. Copy base template roles
  for (const role of baseEntries) {
    if (!role.isDirectory()) continue;
    await copyDir(
      join(baseDir, role.name),
      join(companyDir, "agents", role.name)
    );
    onProgress(`+ agents/${role.name}/ (base)`);
  }

  // 2. Copy extra roles from templates/roles/
  for (const roleName of extraRoleNames) {
    const roleDir = join(templatesDir, "roles", roleName);
    if (!(await exists(roleDir))) {
      onProgress(`! role ${roleName} not found, skipping`);
      continue;
    }
    const destDir = join(companyDir, "agents", roleName);
    await mkdir(destDir, { recursive: true });
    const entries = await readdir(roleDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() || !entry.name.endsWith(".md")) continue;
      await copyFile(join(roleDir, entry.name), join(destDir, entry.name));
    }
    onProgress(`+ agents/${roleName}/ (role)`);
  }

  // 3. Apply modules with capability-aware skill assignment
  const initialTasks = [];
  for (const moduleName of moduleNames) {
    const moduleDir = join(templatesDir, "modules", moduleName);
    if (!(await exists(moduleDir))) {
      onProgress(`! module ${moduleName} not found, skipping`);
      continue;
    }

    const moduleJson = await readJson(join(moduleDir, "module.json"));

    // Check activatesWithRoles
    if (moduleJson?.activatesWithRoles?.length) {
      const hasActivatingRole = moduleJson.activatesWithRoles.some((r) =>
        allRoles.has(r)
      );
      if (!hasActivatingRole) {
        onProgress(
          `○ ${moduleName} (needs ${moduleJson.activatesWithRoles.join(" or ")})`
        );
        continue;
      }
    }

    // Collect initial tasks
    if (moduleJson?.tasks?.length) {
      for (const task of moduleJson.tasks) {
        let assignee = task.assignTo;
        if (assignee?.startsWith("capability:")) {
          const capName = assignee.slice("capability:".length);
          const cap = moduleJson.capabilities?.find(
            (c) => c.skill === capName
          );
          if (cap) {
            assignee = cap.owners.find((r) => allRoles.has(r)) || assignee;
          }
        }
        initialTasks.push({ ...task, assignTo: assignee, module: moduleName });
      }
    }

    // Copy shared docs
    const docsDir = join(moduleDir, "docs");
    if (await exists(docsDir)) {
      await copyDir(docsDir, join(companyDir, "docs"));
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

    // Copy role-specific agent skills
    const agentsDir = join(moduleDir, "agents");
    if (await exists(agentsDir)) {
      const roles = await readdir(agentsDir, { withFileTypes: true });
      for (const role of roles) {
        if (!role.isDirectory()) continue;
        if (!allRoles.has(role.name)) continue;

        const skillsDir = join(agentsDir, role.name, "skills");
        if (!(await exists(skillsDir))) continue;

        const destSkillsDir = join(
          companyDir,
          "agents",
          role.name,
          "skills"
        );
        await mkdir(destSkillsDir, { recursive: true });

        const skills = await readdir(skillsDir);
        for (const skillFile of skills) {
          const skillName = skillFile.replace(/\.md$/, "");
          const skillBaseName = skillName.replace(/\.fallback$/, "");
          const isFallbackFile = skillName.endsWith(".fallback");
          const capInfo = capabilityOwners.get(skillBaseName);

          if (capInfo) {
            const isPrimaryOwner = capInfo.primary === role.name;

            if (isPrimaryOwner && !isFallbackFile) {
              await copyFile(
                join(skillsDir, skillFile),
                join(destSkillsDir, skillFile)
              );
              await appendToFile(
                join(companyDir, "agents", role.name, "AGENTS.md"),
                `\nRead and follow: \`$AGENT_HOME/skills/${skillFile}\`\n`
              );
              onProgress(
                `+ agents/${role.name}/skills/${skillFile} (${moduleName}, primary)`
              );
            } else if (!isPrimaryOwner && isFallbackFile) {
              await copyFile(
                join(skillsDir, skillFile),
                join(destSkillsDir, skillFile)
              );
              await appendToFile(
                join(companyDir, "agents", role.name, "AGENTS.md"),
                `\nRead and follow: \`$AGENT_HOME/skills/${skillFile}\`\n`
              );
              onProgress(
                `+ agents/${role.name}/skills/${skillFile} (${moduleName}, fallback)`
              );
            }
            // Other combinations: skip
          } else {
            await copyFile(
              join(skillsDir, skillFile),
              join(destSkillsDir, skillFile)
            );
            await appendToFile(
              join(companyDir, "agents", role.name, "AGENTS.md"),
              `\nRead and follow: \`$AGENT_HOME/skills/${skillFile}\`\n`
            );
            onProgress(
              `+ agents/${role.name}/skills/${skillFile} (${moduleName})`
            );
          }
        }
      }
    }
  }

  // 4. Add shared doc references to all AGENTS.md files
  const finalDocsDir = join(companyDir, "docs");
  if (await exists(finalDocsDir)) {
    const docs = await readdir(finalDocsDir);
    if (docs.length > 0) {
      const agentsBaseDir = join(companyDir, "agents");
      const agentRoles = await readdir(agentsBaseDir, { withFileTypes: true });
      for (const role of agentRoles) {
        if (!role.isDirectory()) continue;
        const agentsMd = join(agentsBaseDir, role.name, "AGENTS.md");
        if (await exists(agentsMd)) {
          let docRefs = "\n## Shared Documentation\n";
          for (const doc of docs) {
            docRefs += `\nRead: \`docs/${doc}\`\n`;
          }
          await appendToFile(agentsMd, docRefs);
        }
      }
    }
  }

  // 5. Generate BOOTSTRAP.md
  const rolesList = [...allRoles];
  let bootstrap = `# Bootstrap: ${companyName}\n\n`;
  bootstrap += `Your company workspace is pre-configured at this location. All agent instruction files, skills, and shared documentation are already in place.\n\n`;
  bootstrap += `## Setup Agents\n\n`;
  bootstrap += `Create the following agents in the Paperclip UI. For each, set the company workspace as cwd and the instructionsFilePath as shown:\n\n`;
  for (const role of rolesList) {
    const label = role
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    bootstrap += `### ${label}\n`;
    bootstrap += `- **instructionsFilePath**: \`agents/${role}/AGENTS.md\`\n\n`;
  }
  if (initialTasks.length > 0) {
    bootstrap += `## Initial Tasks\n\n`;
    bootstrap += `Create these as issues to kick off the company workflows:\n\n`;
    for (const task of initialTasks) {
      bootstrap += `### ${task.title}\n`;
      bootstrap += `- **Assign to**: ${task.assignTo}\n`;
      bootstrap += `- **Description**: ${task.description}\n\n`;
    }
  }
  bootstrap += `## Get Started\n\n`;
  bootstrap += `Once all agents are created and initial tasks are assigned:\n`;
  bootstrap += `1. Start the CEO heartbeat\n`;
  bootstrap += `2. The CEO will coordinate the team and monitor progress\n`;
  bootstrap += `3. Engineers begin working on assigned issues\n`;

  await writeFile(join(companyDir, "BOOTSTRAP.md"), bootstrap);
  onProgress("+ BOOTSTRAP.md");

  return { companyDir, allRoles, initialTasks };
}
