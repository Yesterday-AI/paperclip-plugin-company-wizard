import { PaperclipClient } from "./client.js";
import { formatRoleName } from "../logic/resolve.js";

/**
 * Provision a company in Paperclip via the API.
 * This is the optional step after file assembly.
 *
 * @param {object} opts
 * @param {PaperclipClient} opts.client
 * @param {string} opts.companyName
 * @param {string} opts.companyDir - absolute path, used as cwd
 * @param {Set<string>} opts.allRoles
 * @param {Map<string, object>} opts.rolesData - role name → role.json data
 * @param {Array} opts.initialTasks
 * @param {(line: string) => void} opts.onProgress
 * @returns {Promise<{companyId: string, agentIds: Map<string, string>}>}
 */
export async function provisionCompany({
  client,
  companyName,
  companyDir,
  allRoles,
  rolesData = new Map(),
  initialTasks = [],
  onProgress = () => {},
}) {
  // 1. Create company
  onProgress("Creating company...");
  const company = await client.createCompany({ name: companyName });
  const companyId = company.id;
  onProgress(`✓ Company created (${companyId.slice(0, 8)}…)`);

  // 2. Create agents
  const agentIds = new Map();
  for (const role of allRoles) {
    const roleData = rolesData.get(role);
    const paperclipRole = PaperclipClient.resolveRole(role, roleData);
    const title = formatRoleName(role);

    onProgress(`Creating ${title} agent...`);
    const agent = await client.createAgent(companyId, {
      name: title,
      role: paperclipRole,
      title,
      adapterConfig: {
        cwd: companyDir,
        instructionsFilePath: `agents/${role}/AGENTS.md`,
      },
    });
    agentIds.set(role, agent.id);
    onProgress(`✓ ${title} created (${agent.id.slice(0, 8)}…)`);
  }

  // 3. Create initial tasks as issues
  for (const task of initialTasks) {
    onProgress(`Creating issue: ${task.title}...`);
    await client.createIssue(companyId, {
      title: task.title,
      description: task.description,
    });
    onProgress(`✓ Issue created: ${task.title}`);
  }

  return { companyId, agentIds };
}
