import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assembleCompany } from "./assemble.js";

let tmpDir;
let templatesDir;
let outputDir;

async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2));
}

async function setupFixtures() {
  tmpDir = await mkdtemp(join(tmpdir(), "assemble-test-"));
  templatesDir = join(tmpDir, "templates");
  outputDir = join(tmpDir, "output");
  await mkdir(outputDir, { recursive: true });

  // Base template with ceo and engineer roles
  const baseDir = join(templatesDir, "base");
  for (const role of ["ceo", "engineer"]) {
    const roleDir = join(baseDir, role);
    await mkdir(roleDir, { recursive: true });
    await writeFile(join(roleDir, "AGENTS.md"), `# ${role} agent\n\n## Skills\n\n<!-- Skills are appended here by modules during company assembly -->\n`);
    await writeFile(join(roleDir, "HEARTBEAT.md"), `# ${role} heartbeat\n`);
    await writeFile(join(roleDir, "SOUL.md"), `# ${role} soul\n`);
  }

  // Extra role template
  const proleDir = join(templatesDir, "roles", "product-owner");
  await mkdir(proleDir, { recursive: true });
  await writeFile(join(proleDir, "AGENTS.md"), "# product-owner agent\n\n## Skills\n\n");
  await writeFile(join(proleDir, "HEARTBEAT.md"), "# product-owner heartbeat\n");
  await writeFile(join(proleDir, "SOUL.md"), "# product-owner soul\n");

  // Module: github-repo (has docs and agent skills, no capabilities)
  const ghDir = join(templatesDir, "modules", "github-repo");
  await mkdir(join(ghDir, "docs"), { recursive: true });
  await writeFile(join(ghDir, "docs", "git-workflow.md"), "# Git Workflow\n");
  await mkdir(join(ghDir, "agents", "engineer", "skills"), { recursive: true });
  await writeFile(join(ghDir, "agents", "engineer", "skills", "git-workflow.md"), "# Git skill\n");
  await writeJson(join(ghDir, "module.json"), {
    name: "github-repo",
    capabilities: [],
    tasks: [
      { title: "Init repo", assignTo: "engineer", description: "Set up repo" },
    ],
  });

  // Module: auto-assign (has capabilities with ownership chain)
  const aaDir = join(templatesDir, "modules", "auto-assign");
  await mkdir(join(aaDir, "agents", "ceo", "skills"), { recursive: true });
  await mkdir(join(aaDir, "agents", "product-owner", "skills"), { recursive: true });
  await writeFile(join(aaDir, "agents", "ceo", "skills", "auto-assign.fallback.md"), "# auto-assign fallback\n");
  await writeFile(join(aaDir, "agents", "ceo", "skills", "auto-assign.md"), "# auto-assign primary\n");
  await writeFile(join(aaDir, "agents", "product-owner", "skills", "auto-assign.md"), "# auto-assign primary\n");
  // Shared skill (primary, used by any owner without a role-specific override)
  await mkdir(join(aaDir, "skills"), { recursive: true });
  await writeFile(join(aaDir, "skills", "auto-assign.md"), "# auto-assign shared primary\n");
  await writeJson(join(aaDir, "module.json"), {
    name: "auto-assign",
    capabilities: [
      { skill: "auto-assign", owners: ["product-owner", "ceo"], fallbackSkill: "auto-assign.fallback" },
    ],
  });

  // Module: gated-mod (has activatesWithRoles)
  const gatedDir = join(templatesDir, "modules", "gated-mod");
  await mkdir(gatedDir, { recursive: true });
  await writeJson(join(gatedDir, "module.json"), {
    name: "gated-mod",
    activatesWithRoles: ["designer"],
    capabilities: [],
  });
}

describe("assembleCompany", () => {
  beforeEach(async () => {
    await setupFixtures();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("copies base roles to agents/ directory", async () => {
    const { companyDir, allRoles } = await assembleCompany({
      companyName: "Test Co",
      baseName: "base",
      moduleNames: [],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });

    assert.ok(companyDir.endsWith("TestCo"));
    assert.deepEqual(allRoles, new Set(["ceo", "engineer"]));

    const ceoAgents = await readFile(join(companyDir, "agents", "ceo", "AGENTS.md"), "utf-8");
    assert.ok(ceoAgents.includes("# ceo agent"));

    const engHeartbeat = await readFile(join(companyDir, "agents", "engineer", "HEARTBEAT.md"), "utf-8");
    assert.ok(engHeartbeat.includes("# engineer heartbeat"));
  });

  it("copies extra roles from templates/roles/", async () => {
    const { allRoles, companyDir } = await assembleCompany({
      companyName: "Test Co 2",
      baseName: "base",
      moduleNames: [],
      extraRoleNames: ["product-owner"],
      outputDir,
      templatesDir,
    });

    assert.ok(allRoles.has("product-owner"));
    assert.ok(allRoles.has("ceo"));

    const poAgents = await readFile(join(companyDir, "agents", "product-owner", "AGENTS.md"), "utf-8");
    assert.ok(poAgents.includes("# product-owner agent"));
  });

  it("skips missing extra roles with progress message", async () => {
    const progress = [];
    await assembleCompany({
      companyName: "Test Co 3",
      baseName: "base",
      moduleNames: [],
      extraRoleNames: ["nonexistent-role"],
      outputDir,
      templatesDir,
      onProgress: (line) => progress.push(line),
    });

    assert.ok(progress.some((p) => p.includes("nonexistent-role") && p.includes("!")));
  });

  it("copies module shared docs to docs/", async () => {
    const { companyDir } = await assembleCompany({
      companyName: "DocTest",
      baseName: "base",
      moduleNames: ["github-repo"],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });

    const gitDoc = await readFile(join(companyDir, "docs", "git-workflow.md"), "utf-8");
    assert.ok(gitDoc.includes("# Git Workflow"));
  });

  it("injects module skills into agent skills/ and appends to AGENTS.md", async () => {
    const { companyDir } = await assembleCompany({
      companyName: "SkillTest",
      baseName: "base",
      moduleNames: ["github-repo"],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });

    // Skill file should exist
    const skillContent = await readFile(
      join(companyDir, "agents", "engineer", "skills", "git-workflow.md"),
      "utf-8"
    );
    assert.ok(skillContent.includes("# Git skill"));

    // AGENTS.md should reference the skill
    const agentsMd = await readFile(join(companyDir, "agents", "engineer", "AGENTS.md"), "utf-8");
    assert.ok(agentsMd.includes("$AGENT_HOME/skills/git-workflow.md"));
  });

  it("appends shared doc references to all AGENTS.md files", async () => {
    const { companyDir } = await assembleCompany({
      companyName: "SharedDocs",
      baseName: "base",
      moduleNames: ["github-repo"],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });

    // Both ceo and engineer AGENTS.md should reference shared docs
    for (const role of ["ceo", "engineer"]) {
      const agentsMd = await readFile(join(companyDir, "agents", role, "AGENTS.md"), "utf-8");
      assert.ok(agentsMd.includes("docs/git-workflow.md"), `${role} AGENTS.md should reference shared doc`);
      assert.ok(agentsMd.includes("Shared Documentation"), `${role} AGENTS.md should have shared docs section`);
    }
  });

  it("generates BOOTSTRAP.md with company name and roles", async () => {
    const { companyDir } = await assembleCompany({
      companyName: "Boot Co",
      baseName: "base",
      moduleNames: [],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });

    const bootstrap = await readFile(join(companyDir, "BOOTSTRAP.md"), "utf-8");
    assert.ok(bootstrap.includes("# Bootstrap: Boot Co"));
    assert.ok(bootstrap.includes("### Ceo"));
    assert.ok(bootstrap.includes("### Engineer"));
    assert.ok(bootstrap.includes("instructionsFilePath"));
  });

  it("includes goal in BOOTSTRAP.md when provided", async () => {
    const { companyDir } = await assembleCompany({
      companyName: "GoalCo",
      goal: { title: "Ship MVP", description: "Build and launch the MVP" },
      baseName: "base",
      moduleNames: [],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });

    const bootstrap = await readFile(join(companyDir, "BOOTSTRAP.md"), "utf-8");
    assert.ok(bootstrap.includes("## Goal"));
    assert.ok(bootstrap.includes("**Ship MVP**"));
    assert.ok(bootstrap.includes("Build and launch the MVP"));
  });

  it("includes project info in BOOTSTRAP.md", async () => {
    const { companyDir } = await assembleCompany({
      companyName: "ProjCo",
      project: { name: "my-app", repoUrl: "https://github.com/test/my-app" },
      baseName: "base",
      moduleNames: [],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });

    const bootstrap = await readFile(join(companyDir, "BOOTSTRAP.md"), "utf-8");
    assert.ok(bootstrap.includes("my-app"));
    assert.ok(bootstrap.includes("https://github.com/test/my-app"));
  });

  it("includes initial tasks in BOOTSTRAP.md from modules", async () => {
    const { companyDir, initialTasks } = await assembleCompany({
      companyName: "TaskCo",
      baseName: "base",
      moduleNames: ["github-repo"],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });

    assert.equal(initialTasks.length, 1);
    assert.equal(initialTasks[0].title, "Init repo");
    assert.equal(initialTasks[0].assignTo, "engineer");

    const bootstrap = await readFile(join(companyDir, "BOOTSTRAP.md"), "utf-8");
    assert.ok(bootstrap.includes("Initial Tasks"));
    assert.ok(bootstrap.includes("Init repo"));
  });

  it("fires onProgress callback for each step", async () => {
    const progress = [];
    await assembleCompany({
      companyName: "ProgressCo",
      baseName: "base",
      moduleNames: ["github-repo"],
      extraRoleNames: [],
      outputDir,
      templatesDir,
      onProgress: (line) => progress.push(line),
    });

    // Should have base role copies, doc copies, skill copies, BOOTSTRAP.md
    assert.ok(progress.some((p) => p.includes("agents/ceo/") && p.includes("base")));
    assert.ok(progress.some((p) => p.includes("agents/engineer/") && p.includes("base")));
    assert.ok(progress.some((p) => p.includes("docs/git-workflow.md")));
    assert.ok(progress.some((p) => p.includes("git-workflow.md") && p.includes("github-repo")));
    assert.ok(progress.some((p) => p.includes("BOOTSTRAP.md")));
  });

  it("appends incrementing index when company directory already exists", async () => {
    const first = await assembleCompany({
      companyName: "DupeCo",
      baseName: "base",
      moduleNames: [],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });
    assert.ok(first.companyDir.endsWith("DupeCo"));

    const second = await assembleCompany({
      companyName: "DupeCo",
      baseName: "base",
      moduleNames: [],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });
    assert.ok(second.companyDir.endsWith("DupeCo2"));

    const third = await assembleCompany({
      companyName: "DupeCo",
      baseName: "base",
      moduleNames: [],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });
    assert.ok(third.companyDir.endsWith("DupeCo3"));
  });

  it("converts company name to PascalCase directory", async () => {
    const { companyDir } = await assembleCompany({
      companyName: "my cool company",
      baseName: "base",
      moduleNames: [],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });

    assert.ok(companyDir.endsWith("MyCoolCompany"));
  });

  it("skips modules not found with progress message", async () => {
    const progress = [];
    await assembleCompany({
      companyName: "MissingMod",
      baseName: "base",
      moduleNames: ["nonexistent-module"],
      extraRoleNames: [],
      outputDir,
      templatesDir,
      onProgress: (line) => progress.push(line),
    });

    assert.ok(progress.some((p) => p.includes("nonexistent-module") && p.includes("!")));
  });

  it("skips modules gated by activatesWithRoles when role absent", async () => {
    const progress = [];
    await assembleCompany({
      companyName: "GatedCo",
      baseName: "base",
      moduleNames: ["gated-mod"],
      extraRoleNames: [],
      outputDir,
      templatesDir,
      onProgress: (line) => progress.push(line),
    });

    // Should show skipped with ○
    assert.ok(progress.some((p) => p.includes("gated-mod") && p.includes("○")));
  });

  it("assigns primary skill to capability owner and fallback to non-owner", async () => {
    const { companyDir } = await assembleCompany({
      companyName: "CapCo",
      baseName: "base",
      moduleNames: ["auto-assign"],
      extraRoleNames: ["product-owner"],
      outputDir,
      templatesDir,
    });

    // product-owner is primary owner → gets auto-assign.md (primary)
    const poSkills = await readdir(join(companyDir, "agents", "product-owner", "skills"));
    assert.ok(poSkills.includes("auto-assign.md"));

    // ceo is fallback → gets auto-assign.fallback.md
    const ceoSkills = await readdir(join(companyDir, "agents", "ceo", "skills"));
    assert.ok(ceoSkills.includes("auto-assign.fallback.md"));
    // ceo should NOT get the primary auto-assign.md
    assert.ok(!ceoSkills.includes("auto-assign.md"));
  });

  it("injects heartbeat sections from modules into HEARTBEAT.md", async () => {
    // Add heartbeat-section.md to the auto-assign module for ceo
    const aaHeartbeatDir = join(templatesDir, "modules", "auto-assign", "agents", "ceo");
    await mkdir(aaHeartbeatDir, { recursive: true });
    await writeFile(
      join(aaHeartbeatDir, "heartbeat-section.md"),
      "## Assignment Check (Fallback)\n\nCheck for idle agents.\n"
    );

    // Add the marker comment to ceo HEARTBEAT.md
    const ceoHeartbeat = join(templatesDir, "base", "ceo", "HEARTBEAT.md");
    await writeFile(
      ceoHeartbeat,
      "# ceo heartbeat\n\n<!-- Module heartbeat sections are inserted above this line during assembly -->\n"
    );

    const { companyDir } = await assembleCompany({
      companyName: "HeartbeatCo",
      baseName: "base",
      moduleNames: ["auto-assign"],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });

    const heartbeat = await readFile(join(companyDir, "agents", "ceo", "HEARTBEAT.md"), "utf-8");
    assert.ok(heartbeat.includes("## Assignment Check (Fallback)"), "should inject heartbeat section");
    assert.ok(heartbeat.includes("Check for idle agents"), "should include section content");
    assert.ok(heartbeat.includes("<!-- Module heartbeat"), "should preserve the marker for further injections");
  });

  it("injects heartbeat sections for multiple modules into same role", async () => {
    // Create two modules with heartbeat sections for ceo
    for (const mod of ["mod-a", "mod-b"]) {
      const modDir = join(templatesDir, "modules", mod);
      await mkdir(join(modDir, "agents", "ceo"), { recursive: true });
      await writeJson(join(modDir, "module.json"), { name: mod, capabilities: [] });
      await writeFile(
        join(modDir, "agents", "ceo", "heartbeat-section.md"),
        `## Section from ${mod}\n\nDo ${mod} things.\n`
      );
    }

    // Add marker to ceo HEARTBEAT.md
    await writeFile(
      join(templatesDir, "base", "ceo", "HEARTBEAT.md"),
      "# ceo heartbeat\n\n<!-- Module heartbeat sections are inserted above this line during assembly -->\n"
    );

    const { companyDir } = await assembleCompany({
      companyName: "MultiHeartbeat",
      baseName: "base",
      moduleNames: ["mod-a", "mod-b"],
      extraRoleNames: [],
      outputDir,
      templatesDir,
    });

    const heartbeat = await readFile(join(companyDir, "agents", "ceo", "HEARTBEAT.md"), "utf-8");
    assert.ok(heartbeat.includes("## Section from mod-a"), "should have mod-a section");
    assert.ok(heartbeat.includes("## Section from mod-b"), "should have mod-b section");
    assert.ok(heartbeat.includes("<!-- Module heartbeat"), "should preserve marker after both injections");
  });

  it("skips heartbeat injection for roles not present in the company", async () => {
    // auto-assign module has product-owner heartbeat section in fixtures
    const poHeartbeatDir = join(templatesDir, "modules", "auto-assign", "agents", "product-owner");
    await mkdir(poHeartbeatDir, { recursive: true });
    await writeFile(
      join(poHeartbeatDir, "heartbeat-section.md"),
      "## PO Assignment Check\n\nAssign issues.\n"
    );

    const { companyDir } = await assembleCompany({
      companyName: "NoPoCo",
      baseName: "base",
      moduleNames: ["auto-assign"],
      extraRoleNames: [], // no product-owner
      outputDir,
      templatesDir,
    });

    // CEO heartbeat should NOT have PO section
    const ceoHb = await readFile(join(companyDir, "agents", "ceo", "HEARTBEAT.md"), "utf-8");
    assert.ok(!ceoHb.includes("PO Assignment Check"), "should not inject PO section into CEO");
  });

  it("skips heartbeat injection for gated modules that didn't activate", async () => {
    // gated-mod requires "designer" role
    const gatedDir = join(templatesDir, "modules", "gated-mod");
    await mkdir(join(gatedDir, "agents", "ceo"), { recursive: true });
    await writeFile(
      join(gatedDir, "agents", "ceo", "heartbeat-section.md"),
      "## Gated Section\n\nShould not appear.\n"
    );

    await writeFile(
      join(templatesDir, "base", "ceo", "HEARTBEAT.md"),
      "# ceo heartbeat\n\n<!-- Module heartbeat sections are inserted above this line during assembly -->\n"
    );

    const { companyDir } = await assembleCompany({
      companyName: "GatedHeartbeat",
      baseName: "base",
      moduleNames: ["gated-mod"],
      extraRoleNames: [], // no designer
      outputDir,
      templatesDir,
    });

    const heartbeat = await readFile(join(companyDir, "agents", "ceo", "HEARTBEAT.md"), "utf-8");
    assert.ok(!heartbeat.includes("Gated Section"), "should not inject from gated module");
  });

  it("reports heartbeat injection in onProgress callback", async () => {
    const aaHeartbeatDir = join(templatesDir, "modules", "auto-assign", "agents", "ceo");
    await mkdir(aaHeartbeatDir, { recursive: true });
    await writeFile(
      join(aaHeartbeatDir, "heartbeat-section.md"),
      "## Assignment Check\n\nDo assignments.\n"
    );

    await writeFile(
      join(templatesDir, "base", "ceo", "HEARTBEAT.md"),
      "# ceo heartbeat\n\n<!-- Module heartbeat sections are inserted above this line during assembly -->\n"
    );

    const progress = [];
    await assembleCompany({
      companyName: "ProgressHeartbeat",
      baseName: "base",
      moduleNames: ["auto-assign"],
      extraRoleNames: [],
      outputDir,
      templatesDir,
      onProgress: (line) => progress.push(line),
    });

    assert.ok(
      progress.some((p) => p.includes("HEARTBEAT.md") && p.includes("auto-assign") && p.includes("heartbeat section")),
      "should report heartbeat injection in progress"
    );
  });

  it("resolves capability:* task assignments to the primary owner role", async () => {
    // Add a task with capability: reference
    const aaModuleJson = join(templatesDir, "modules", "auto-assign", "module.json");
    await writeJson(aaModuleJson, {
      name: "auto-assign",
      capabilities: [
        { skill: "auto-assign", owners: ["product-owner", "ceo"] },
      ],
      tasks: [
        { title: "Configure auto-assign", assignTo: "capability:auto-assign" },
      ],
    });

    const { initialTasks } = await assembleCompany({
      companyName: "CapTaskCo",
      baseName: "base",
      moduleNames: ["auto-assign"],
      extraRoleNames: ["product-owner"],
      outputDir,
      templatesDir,
    });

    assert.equal(initialTasks.length, 1);
    assert.equal(initialTasks[0].assignTo, "product-owner");
  });
});
