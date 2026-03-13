import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "../../../templates");

// Default path — host writes here; container path only needed with Docker
const DEFAULT_WORKDIR_HOST = "/tmp";
const DEFAULT_PAPERCLIP_URL = "http://localhost:3100";

/**
 * Vite dev-server plugin that exposes POST /api/provision.
 *
 * Runs assembleCompany() to write files on the host, then provisionCompany()
 * to register everything via the Paperclip REST API. Progress is streamed
 * back as Server-Sent Events.
 *
 * Path mapping: files are written to WORKDIR_HOST on the local filesystem,
 * but API paths use WORKDIR_CONTAINER (the Docker bind-mount target).
 */
export function provisionApiPlugin(): Plugin {
  // Load .env at plugin init (Vite only auto-exposes VITE_-prefixed vars)
  const envDir = path.resolve(__dirname, "../../");
  const env = loadEnv("development", envDir, "");

  const getEnv = (key: string) => env[key] || process.env[key] || "";

  return {
    name: "clipper-provision-api",
    configureServer(server) {
      server.middlewares.use("/api/provision", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        // Parse JSON body
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString());

        const {
          companyName,
          goal,
          project,
          presetName,
          selectedModules,
          selectedRoles,
          allRoles,
          goalTemplate: goalTemplateFromBody,
        } = body;

        const instancesHost =
          getEnv("PAPERCLIP_WORKDIR_HOST") || DEFAULT_WORKDIR_HOST;
        // If no container path is set, assume Paperclip sees the same filesystem (no Docker)
        const instancesContainer =
          getEnv("PAPERCLIP_WORKDIR_CONTAINER") || instancesHost;
        const paperclipUrl =
          getEnv("PAPERCLIP_URL") || DEFAULT_PAPERCLIP_URL;
        const paperclipEmail = getEnv("PAPERCLIP_EMAIL");
        const paperclipPassword = getEnv("PAPERCLIP_PASSWORD");

        // SSE headers
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        const send = (event: string, data: unknown) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        const log = (msg: string) => send("log", { message: msg });

        try {
          // Dynamic import of the CLI modules (plain JS, ESM)
          const { assembleCompany } = await import(
            "../../../src/logic/assemble.js"
          );
          const { provisionCompany } = await import(
            "../../../src/api/provision.js"
          );
          const { PaperclipClient } = await import(
            "../../../src/api/client.js"
          );

          // --- Step 1: Assemble files to host instances dir ---
          fs.mkdirSync(instancesHost, { recursive: true });
          log("Assembling company workspace...");

          const assembleResult = await assembleCompany({
            companyName,
            goal: goal || {},
            project: project || {},
            moduleNames: selectedModules ?? [],
            extraRoleNames: selectedRoles ?? [],
            goalTemplate: goalTemplateFromBody ?? null,
            outputDir: instancesHost,
            templatesDir: TEMPLATES_DIR,
            onProgress: log,
          });

          const { companyDir, initialTasks } = assembleResult;
          const assembledAllRoles: Set<string> = assembleResult.allRoles;

          log("");
          log(`Assembled to: ${companyDir}`);

          // --- Step 2: Compute container-relative path ---
          // companyDir = /host/path/instances/CompanyName
          // We need: /paperclip/instances/CompanyName
          const relativeDir = path.relative(instancesHost, companyDir);
          const remoteCompanyDir = path.join(instancesContainer, relativeDir);

          log(`Container path: ${remoteCompanyDir}`);
          log("");

          // --- Step 3: Load role metadata for API provisioning ---
          const rolesData = new Map();
          for (const role of assembledAllRoles) {
            const metaPath = path.join(TEMPLATES_DIR, "roles", role, "role.meta.json");
            try {
              const raw = fs.readFileSync(metaPath, "utf-8");
              rolesData.set(role, JSON.parse(raw));
            } catch {
              // Role without metadata — use defaults
            }
          }

          // --- Step 4: Provision via Paperclip API ---
          log("Connecting to Paperclip API...");
          const client = new PaperclipClient(paperclipUrl, {
            email: paperclipEmail,
            password: paperclipPassword,
          });
          await client.connect();
          log("Connected.");
          log("");

          const result = await provisionCompany({
            client,
            companyName,
            companyDir,
            goal: goal || {},
            projectName: project?.name || companyName,
            projectDescription: project?.description ?? null,
            repoUrl: project?.repoUrl ?? null,
            allRoles: assembledAllRoles,
            rolesData,
            initialTasks,
            goalTemplate: goalTemplateFromBody ?? null,
            model: null,
            remoteCompanyDir,
            startCeo: false,
            onProgress: log,
          });

          log("");
          log("Provisioning complete!");

          send("result", {
            companyId: result.companyId,
            goalId: result.goalId,
            projectId: result.projectId,
            agentIds: Object.fromEntries(result.agentIds),
            issueIds: result.issueIds,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          log(`Error: ${message}`);
          send("error", { message });
        } finally {
          res.end();
        }
      });
    },
  };
}
