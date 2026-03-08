import React from "react";
import { render } from "ink";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import App from "./app.jsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "..", "templates");

// Parse CLI flags
function parseArgs(argv) {
  const args = argv.slice(2);
  const config = {
    outputDir: join(process.cwd(), "companies"),
    apiEnabled: false,
    apiBaseUrl: "http://localhost:3100",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) {
      config.outputDir = resolve(args[i + 1]);
      i++;
    } else if (args[i] === "--api") {
      config.apiEnabled = true;
    } else if (args[i] === "--api-url" && args[i + 1]) {
      config.apiBaseUrl = args[i + 1];
      config.apiEnabled = true;
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
  Clipper — Bootstrap a Paperclip company workspace

  Usage:
    clipper [options]

  Options:
    --output <dir>     Output directory (default: ./companies/)
    --api              Provision via Paperclip API after assembly
    --api-url <url>    Paperclip API URL (default: http://localhost:3100)
    -h, --help         Show this help
`);
      process.exit(0);
    }
  }

  return config;
}

const config = parseArgs(process.argv);

const app = render(
  <App
    outputDir={config.outputDir}
    templatesDir={TEMPLATES_DIR}
    apiEnabled={config.apiEnabled}
    apiBaseUrl={config.apiBaseUrl}
  />
);

await app.waitUntilExit();
