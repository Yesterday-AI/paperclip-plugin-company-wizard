#!/usr/bin/env node

/**
 * Clipper — Bootstrap a Paperclip company workspace from modular templates.
 *
 * Usage:
 *   clipper                        (interactive, outputs to ./companies/)
 *   clipper --output /path/to/dir  (custom output directory)
 */

import {
  access,
  appendFile,
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { argv, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "templates");

// Parse --output flag, default to ./companies/ in the user's current working directory
function parseOutputDir() {
  const idx = argv.indexOf("--output");
  if (idx !== -1 && argv[idx + 1]) return resolve(argv[idx + 1]);
  return join(process.cwd(), "companies");
}

const OUTPUT_DIR = parseOutputDir();

// ── ANSI helpers ──

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const magenta = (s) => `\x1b[35m${s}\x1b[0m`;

// ── Filesystem helpers ──

async function exists(path) {
  try {
    await access(path);
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

async function readJson(path) {
  if (!(await exists(path))) return null;
  return JSON.parse(await readFile(path, "utf-8"));
}

// ── Data loading ──

async function loadPresets() {
  const presetsDir = join(TEMPLATES_DIR, "presets");
  const presets = [];
  if (!(await exists(presetsDir))) return presets;
  const dirs = await readdir(presetsDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const presetFile = join(presetsDir, dir.name, "preset.json");
    if (await exists(presetFile)) {
      presets.push(JSON.parse(await readFile(presetFile, "utf-8")));
    }
  }
  return presets;
}

async function loadModules() {
  const modulesDir = join(TEMPLATES_DIR, "modules");
  const modules = [];
  if (!(await exists(modulesDir))) return modules;
  const dirs = await readdir(modulesDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const moduleJson = await readJson(
      join(modulesDir, dir.name, "module.json")
    );
    const readmePath = join(modulesDir, dir.name, "README.md");
    let description = "";
    if (await exists(readmePath)) {
      const content = await readFile(readmePath, "utf-8");
      const descLine = content
        .split("\n")
        .find((l) => l.length > 0 && !l.startsWith("#"));
      description = descLine?.trim() || "";
    }
    modules.push({ name: dir.name, description, ...(moduleJson || {}) });
  }
  return modules;
}

async function loadRoles() {
  const rolesDir = join(TEMPLATES_DIR, "roles");
  const roles = [];
  if (!(await exists(rolesDir))) return roles;
  const dirs = await readdir(rolesDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const roleJson = await readJson(join(rolesDir, dir.name, "role.json"));
    if (roleJson) {
      roles.push(roleJson);
    }
  }
  return roles;
}

// ── Capability-aware assembly ──

async function assembleCompany(
  companyName,
  baseName,
  moduleNames,
  extraRoleNames
) {
  const companyDir = join(OUTPUT_DIR, companyName);

  if (await exists(companyDir)) {
    throw new Error(`Company directory already exists: ${companyDir}`);
  }

  // Determine all roles present in this company
  const baseDir = join(TEMPLATES_DIR, baseName);
  const baseEntries = await readdir(baseDir, { withFileTypes: true });
  const allRoles = new Set(
    baseEntries.filter((e) => e.isDirectory()).map((e) => e.name)
  );
  for (const role of extraRoleNames) allRoles.add(role);

  console.log("");
  console.log(bold("Assembling company workspace..."));
  console.log("");

  // 1. Copy base template roles
  for (const role of baseEntries) {
    if (!role.isDirectory()) continue;
    await copyDir(
      join(baseDir, role.name),
      join(companyDir, "agents", role.name)
    );
    console.log(`  ${green("+")} agents/${role.name}/ ${dim("(base)")}`);
  }

  // 2. Copy extra roles from templates/roles/
  for (const roleName of extraRoleNames) {
    const roleDir = join(TEMPLATES_DIR, "roles", roleName);
    if (!(await exists(roleDir))) {
      console.log(`  ${yellow("!")} role ${roleName} not found, skipping`);
      continue;
    }
    const destDir = join(companyDir, "agents", roleName);
    await mkdir(destDir, { recursive: true });
    // Copy only .md files (skip role.json)
    const entries = await readdir(roleDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() || !entry.name.endsWith(".md")) continue;
      await copyFile(join(roleDir, entry.name), join(destDir, entry.name));
    }
    console.log(`  ${green("+")} agents/${roleName}/ ${dim("(role)")}`);
  }

  // 3. Apply modules with capability-aware skill assignment
  const initialTasks = []; // collect initial tasks from modules
  for (const moduleName of moduleNames) {
    const moduleDir = join(TEMPLATES_DIR, "modules", moduleName);
    if (!(await exists(moduleDir))) {
      console.log(`  ${yellow("!")} module ${moduleName} not found, skipping`);
      continue;
    }

    const moduleJson = await readJson(join(moduleDir, "module.json"));

    // Check activatesWithRoles — skip module if required roles aren't present
    if (moduleJson?.activatesWithRoles?.length) {
      const hasActivatingRole = moduleJson.activatesWithRoles.some((r) =>
        allRoles.has(r)
      );
      if (!hasActivatingRole) {
        console.log(
          `  ${dim("○")} ${moduleName} ${dim(
            `(needs ${moduleJson.activatesWithRoles.join(" or ")})`
          )}`
        );
        continue;
      }
    }

    // Collect initial tasks
    if (moduleJson?.tasks?.length) {
      for (const task of moduleJson.tasks) {
        let assignee = task.assignTo;
        // Resolve capability-based assignment to actual role
        if (assignee?.startsWith("capability:")) {
          const capName = assignee.slice("capability:".length);
          const cap = moduleJson.capabilities?.find((c) => c.skill === capName);
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
        console.log(`  ${green("+")} docs/${doc} ${dim(`(${moduleName})`)}`);
      }
    }

    // Resolve capabilities: determine primary owner for each capability
    const capabilityOwners = new Map(); // skill -> primary owner role
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
        if (!allRoles.has(role.name)) continue; // skip skills for roles not in this company

        const skillsDir = join(agentsDir, role.name, "skills");
        if (!(await exists(skillsDir))) continue;

        const destSkillsDir = join(companyDir, "agents", role.name, "skills");
        await mkdir(destSkillsDir, { recursive: true });

        const skills = await readdir(skillsDir);
        for (const skillFile of skills) {
          const skillName = skillFile.replace(/\.md$/, "");

          // Check if this is a capability with ownership rules
          const baseName = skillName.replace(/\.fallback$/, "");
          const isFallbackFile = skillName.endsWith(".fallback");
          const capInfo = capabilityOwners.get(baseName);

          if (capInfo) {
            const isPrimaryOwner = capInfo.primary === role.name;

            // Primary owner gets the primary skill, others get fallback
            if (isPrimaryOwner && !isFallbackFile) {
              await copyFile(
                join(skillsDir, skillFile),
                join(destSkillsDir, skillFile)
              );
              await appendToFile(
                join(companyDir, "agents", role.name, "AGENTS.md"),
                `\nRead and follow: \`$AGENT_HOME/skills/${skillFile}\`\n`
              );
              console.log(
                `  ${green("+")} agents/${role.name}/skills/${skillFile} ${dim(
                  `(${moduleName}, primary)`
                )}`
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
              console.log(
                `  ${green("+")} agents/${role.name}/skills/${skillFile} ${dim(
                  `(${moduleName}, fallback)`
                )}`
              );
            } else if (!isPrimaryOwner && !isFallbackFile) {
              // Non-primary owner, no fallback variant — skip (primary is elsewhere)
            } else {
              // Primary owner but this is the fallback file — skip
            }
          } else {
            // No capability rules — copy normally
            await copyFile(
              join(skillsDir, skillFile),
              join(destSkillsDir, skillFile)
            );
            await appendToFile(
              join(companyDir, "agents", role.name, "AGENTS.md"),
              `\nRead and follow: \`$AGENT_HOME/skills/${skillFile}\`\n`
            );
            console.log(
              `  ${green("+")} agents/${role.name}/skills/${skillFile} ${dim(
                `(${moduleName})`
              )}`
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
    bootstrap += `### ${
      role.charAt(0).toUpperCase() + role.slice(1).replace(/-/g, " ")
    }\n`;
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
  console.log(`  ${green("+")} BOOTSTRAP.md`);

  return { companyDir, allRoles };
}

// ── Interactive prompts ──

async function prompt(rl, question, validate) {
  while (true) {
    let answer;
    try {
      answer = (await rl.question(question)).trim();
    } catch {
      process.exit(1);
    }
    if (validate) {
      const error = validate(answer);
      if (error) {
        console.log(`  ${red(error)}`);
        continue;
      }
    }
    return answer;
  }
}

async function selectOne(rl, label, options) {
  console.log("");
  console.log(bold(label));
  console.log("");
  options.forEach((opt, i) => {
    console.log(`  ${cyan(`${i + 1})`)} ${bold(opt.name)}`);
    if (opt.description) console.log(`     ${dim(opt.description)}`);
    if (opt.constraints?.length) {
      opt.constraints.forEach((c) => console.log(`     ${yellow("!")} ${c}`));
    }
  });
  console.log("");

  const answer = await prompt(
    rl,
    `  ${dim("Enter number")} [1-${options.length}]: `,
    (a) => {
      const n = parseInt(a);
      if (isNaN(n) || n < 1 || n > options.length)
        return `Pick 1-${options.length}`;
    }
  );
  return options[parseInt(answer) - 1];
}

async function selectMany(rl, label, options, preselected = []) {
  console.log("");
  console.log(bold(label));
  console.log("");
  options.forEach((opt, i) => {
    const pre = preselected.includes(opt.name) ? green(" [included]") : "";
    console.log(`  ${cyan(`${i + 1})`)} ${bold(opt.name || opt.title)}${pre}`);
    const desc = opt.description || "";
    if (desc) console.log(`     ${dim(desc)}`);
    if (opt.enhances?.length) {
      opt.enhances.forEach((e) => console.log(`     ${cyan("+")} ${e}`));
    }
  });
  console.log("");

  const available = options.filter((o) => !preselected.includes(o.name));
  if (available.length === 0) {
    console.log(`  ${dim("All options already included.")}`);
    return preselected;
  }

  const answer = await prompt(
    rl,
    `  ${dim("Select (comma-separated numbers, or Enter to skip)")}: `,
    () => null
  );

  if (!answer) return preselected;

  const selected = [...preselected];
  for (const part of answer.split(",")) {
    const n = parseInt(part.trim());
    if (
      n >= 1 &&
      n <= options.length &&
      !selected.includes(options[n - 1].name)
    ) {
      selected.push(options[n - 1].name);
    }
  }
  return selected;
}

// ── Main ──

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    console.log("");
    console.log(magenta("  ╔═══════════════════════════════════════╗"));
    console.log(
      magenta("  ║") +
        bold("   Clipper                             ") +
        magenta("║")
    );
    console.log(magenta("  ╚═══════════════════════════════════════╝"));
    console.log("");

    // 1. Company name
    const companyName = await prompt(rl, `  ${bold("Company name")}: `, (a) => {
      if (!a) return "Name is required";
      if (!/^[a-zA-Z][a-zA-Z0-9 _-]*$/.test(a))
        return "Use letters, numbers, spaces, hyphens, or underscores";
    });

    // 2. Load data
    const presets = await loadPresets();
    const allModules = await loadModules();
    const availableRoles = await loadRoles();

    // 3. Select preset or custom
    const presetOptions = [
      ...presets,
      { name: "custom", description: "Pick modules manually" },
    ];

    const choice = await selectOne(rl, "Select a preset:", presetOptions);

    let baseName, moduleNames;

    let preselectedRoles = [];

    if (choice.name === "custom") {
      baseName = "base";
      moduleNames = await selectMany(rl, "Select modules:", allModules);
    } else {
      baseName = choice.base;
      moduleNames = [...choice.modules];
      preselectedRoles = choice.roles || [];

      // Offer to add extra modules
      moduleNames = await selectMany(
        rl,
        "Modules included + available:",
        allModules,
        moduleNames
      );
    }

    // 4. Select additional roles
    let extraRoleNames = [...preselectedRoles];
    if (availableRoles.length > 0) {
      extraRoleNames = await selectMany(
        rl,
        "Add roles (optional — capabilities adapt gracefully):",
        availableRoles,
        preselectedRoles
      );
    }

    // 5. Show capability resolution
    if (extraRoleNames.length > 0) {
      console.log("");
      console.log(bold("  Capability resolution:"));
      for (const mod of allModules) {
        if (!moduleNames.includes(mod.name) || !mod.capabilities?.length)
          continue;
        for (const cap of mod.capabilities) {
          const allRolesSet = new Set(["ceo", "engineer", ...extraRoleNames]);
          const primaryOwner = cap.owners.find((r) => allRolesSet.has(r));
          const fallbacks = cap.owners.filter(
            (r) => r !== primaryOwner && allRolesSet.has(r)
          );
          console.log(
            `    ${cyan(cap.skill)}: ${bold(primaryOwner)}${
              fallbacks.length
                ? ` ${dim(`(fallback: ${fallbacks.join(", ")})`)}`
                : ""
            }`
          );
        }
      }
    }

    // 6. Confirm
    console.log("");
    console.log(bold("  Summary:"));
    console.log(`    Company:  ${cyan(companyName)}`);
    console.log(`    Base:     ${cyan(baseName)}`);
    console.log(
      `    Modules:  ${
        moduleNames.length > 0
          ? moduleNames.map((m) => cyan(m)).join(", ")
          : dim("none")
      }`
    );
    console.log(
      `    Roles:    ${cyan("ceo")}, ${cyan("engineer")}${
        extraRoleNames.length > 0
          ? ", " + extraRoleNames.map((r) => cyan(r)).join(", ")
          : ""
      }`
    );
    console.log(`    Output:   ${dim(join(OUTPUT_DIR, companyName) + "/")}`);
    console.log("");

    const confirm = await prompt(
      rl,
      `  ${bold("Create?")} [Y/n]: `,
      () => null
    );

    if (confirm.toLowerCase() === "n") {
      console.log(`\n  ${dim("Cancelled.")}\n`);
      return;
    }

    // 7. Assemble
    const { companyDir, allRoles } = await assembleCompany(
      companyName,
      baseName,
      moduleNames,
      extraRoleNames
    );

    // 8. Done
    console.log("");
    console.log(green(bold("  Done!")));
    console.log("");
    console.log(bold("  Next steps:"));
    let step = 1;
    console.log(`    ${step++}. Create the company in the Paperclip UI`);
    for (const role of allRoles) {
      console.log(`    ${step++}. Create the ${bold(role)} agent with:`);
      console.log(`       ${dim(`cwd = ${companyDir}`)}`);
      console.log(
        `       ${dim(`instructionsFilePath = agents/${role}/AGENTS.md`)}`
      );
    }
    console.log("");
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\n  ${red("Error:")} ${err.message}\n`);
  process.exit(1);
});
