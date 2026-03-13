import React from 'react';
import { render } from 'ink';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import App from './app.jsx';
import { runHeadless } from './headless.js';
import { aiWizard, aiWizardInterview } from './logic/ai-wizard.js';
import { loadPresets, loadModules, loadRoles } from './logic/load-templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

const HELP = `
  Clipper — Bootstrap a Paperclip company workspace

  Usage:
    clipper [options]

  Company options:
    --name <name>              Company name (required for non-interactive)
    --goal <title>             Company goal title
    --goal-description <desc>  Goal description
    --project <name>           Project name (default: company name)
    --project-description <d>  Project description
    --repo <url>               GitHub repository URL
    --preset <name>            Preset: fast, quality, rad, startup, research, full
    --modules <a,b,c>          Comma-separated module names (added to preset)
    --roles <a,b>              Comma-separated extra role names (added to preset)
    --goal-template <name>     Starter goal template (e.g., build-api, launch-mvp)

  Infrastructure options:
    --dry-run                  Show summary and exit without writing files
    --output <dir>             Output directory (default: ./companies/)
    --api                      Provision via Paperclip API after assembly
    --api-url <url>            Paperclip API URL (default: http://localhost:3100)
    --api-email <email>        Board login email (or PAPERCLIP_EMAIL env var)
    --api-password <pass>      Board login password (or PAPERCLIP_PASSWORD env var)
    --api-workspace-root <p>   Workspace root as seen by the API server (Docker mount path)
    --model <model>            LLM model for agents (default: adapter default)
    --start                    Start CEO heartbeat after provisioning (implies --api)

  AI wizard:
    --ai                       AI interview: 3 guided questions, then auto-config
    --ai <description>         AI single-shot: describe company, auto-config
    --ai-model <model>         Model for AI wizard (default: claude-opus-4-6)

  Modes:
    Interactive (default)      Wizard prompts for missing values
    Non-interactive            Pass --name and --preset (minimum) to skip the wizard
    AI interview               Pass --ai for a 3-question guided setup
    AI single-shot             Pass --ai "description" to skip questions

  Examples:
    clipper                                          # interactive wizard
    clipper --name "Acme" --preset fast               # headless, files only
    clipper --name "Acme" --preset startup --api      # headless + API provisioning
    clipper --name "Acme" --preset fast --roles product-owner --modules pr-review
    clipper --name "Acme" --preset custom --modules github-repo,auto-assign
    clipper --ai                                        # AI interview (3 questions)
    clipper --ai "A fintech startup building a payment API" # AI single-shot

  Environment:
    ANTHROPIC_API_KEY            Required for --ai mode
    PAPERCLIP_EMAIL              Board login email (for authenticated instances)
    PAPERCLIP_PASSWORD           Board login password (for authenticated instances)

  -h, --help                   Show this help
`;

// Parse CLI flags
function parseArgs(argv) {
  const args = argv.slice(2);
  const config = {
    outputDir: join(process.cwd(), 'companies'),
    dryRun: false,
    apiEnabled: false,
    apiBaseUrl: 'http://localhost:3100',
    apiEmail: process.env.PAPERCLIP_EMAIL || null,
    apiPassword: process.env.PAPERCLIP_PASSWORD || null,
    apiWorkspaceRoot: null,
    model: null,
    startCeo: false,
    // AI wizard
    aiDescription: null,
    aiModel: null,
    // Company options
    name: null,
    goal: null,
    goalDescription: null,
    projectName: null,
    projectDescription: null,
    repo: null,
    preset: null,
    modules: [],
    roles: [],
    goalTemplate: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--output':
        config.outputDir = resolve(next);
        i++;
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--api':
        config.apiEnabled = true;
        break;
      case '--api-url':
        config.apiBaseUrl = next;
        config.apiEnabled = true;
        i++;
        break;
      case '--api-email':
        config.apiEmail = next;
        i++;
        break;
      case '--api-password':
        config.apiPassword = next;
        i++;
        break;
      case '--api-workspace-root':
        config.apiWorkspaceRoot = next;
        i++;
        break;
      case '--start':
        config.startCeo = true;
        config.apiEnabled = true;
        break;
      case '--model':
        config.model = next;
        i++;
        break;
      case '--ai':
        // --ai without argument → interview mode (empty string)
        // --ai "description" → single-shot mode
        if (next && !next.startsWith('-')) {
          config.aiDescription = next;
          i++;
        } else {
          config.aiDescription = '';
        }
        break;
      case '--ai-model':
        config.aiModel = next;
        i++;
        break;
      case '--name':
        config.name = next;
        i++;
        break;
      case '--goal':
        config.goal = next;
        i++;
        break;
      case '--goal-description':
        config.goalDescription = next;
        i++;
        break;
      case '--project':
        config.projectName = next;
        i++;
        break;
      case '--project-description':
        config.projectDescription = next;
        i++;
        break;
      case '--repo':
        config.repo = next;
        i++;
        break;
      case '--preset':
        config.preset = next;
        i++;
        break;
      case '--modules':
        config.modules = next
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        i++;
        break;
      case '--roles':
        config.roles = next
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        i++;
        break;
      case '--goal-template':
        config.goalTemplate = next;
        i++;
        break;
      case '--help':
      case '-h':
        console.log(HELP);
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown flag: ${arg}`);
          console.error('Run clipper --help for usage.');
          process.exit(1);
        }
    }
  }

  return config;
}

const config = parseArgs(process.argv);

// AI wizard mode: --ai (interview) or --ai "description" (single-shot)
if (config.aiDescription !== null) {
  (async () => {
    try {
      const [presets, modules, allRoles] = await Promise.all([
        loadPresets(TEMPLATES_DIR),
        loadModules(TEMPLATES_DIR),
        loadRoles(TEMPLATES_DIR),
      ]);

      const optionalRoles = allRoles.filter((r) => !r.base);
      let aiResult;

      if (config.aiDescription) {
        // Single-shot mode: --ai "description"
        aiResult = await aiWizard({
          description: config.aiDescription,
          presets,
          modules,
          roles: optionalRoles,
          model: config.aiModel || undefined,
          templatesDir: TEMPLATES_DIR,
        });
      } else {
        // Interview mode: --ai (no description)
        aiResult = await aiWizardInterview({
          presets,
          modules,
          roles: optionalRoles,
          model: config.aiModel || undefined,
          templatesDir: TEMPLATES_DIR,
        });
      }

      // User aborted interview
      if (!aiResult) {
        process.exit(0);
      }

      // In single-shot mode, show reasoning and summary
      if (config.aiDescription) {
        console.log(`  \x1b[32m●\x1b[0m ${aiResult.reasoning}`);
        console.log('');
        console.log(
          `  \x1b[1mCompany:\x1b[0m ${aiResult.name}  \x1b[2m│\x1b[0m  \x1b[1mPreset:\x1b[0m ${aiResult.preset}`,
        );
        if (aiResult.modules.length) {
          console.log(`  \x1b[36mModules:\x1b[0m ${aiResult.modules.join(', ')}`);
        }
        if (aiResult.roles.length) {
          console.log(`  \x1b[36mRoles:\x1b[0m   ${aiResult.roles.join(', ')}`);
        }
        console.log('');
      }

      // AI result as defaults, explicit CLI flags override
      const merged = {
        ...config,
        name: config.name || aiResult.name,
        goal: config.goal || aiResult.goal,
        goalDescription: config.goalDescription || aiResult.goalDescription,
        preset: config.preset || aiResult.preset,
        modules: config.modules.length ? config.modules : aiResult.modules,
        roles: config.roles.length ? config.roles : aiResult.roles,
      };

      await runHeadless({
        ...merged,
        templatesDir: TEMPLATES_DIR,
        dryRun: config.dryRun,
      });
    } catch (err) {
      console.error('');
      console.error(`  \x1b[31m✗\x1b[0m ${err.message}`);
      console.error('');
      process.exit(1);
    }
  })();
} else if (config.name && config.preset) {
  // Headless mode: --name + --preset are the minimum for non-interactive
  runHeadless({
    ...config,
    templatesDir: TEMPLATES_DIR,
  }).catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
} else {
  // Interactive wizard (Ink)
  const app = render(
    <App
      outputDir={config.outputDir}
      templatesDir={TEMPLATES_DIR}
      dryRun={config.dryRun}
      apiEnabled={config.apiEnabled}
      apiBaseUrl={config.apiBaseUrl}
      apiEmail={config.apiEmail}
      apiPassword={config.apiPassword}
      apiWorkspaceRoot={config.apiWorkspaceRoot}
      model={config.model}
      startCeo={config.startCeo}
      // Pass pre-filled values from flags
      initialName={config.name}
      initialGoal={config.goal}
      initialGoalDescription={config.goalDescription}
      initialProjectName={config.projectName}
      initialProjectDescription={config.projectDescription}
      initialRepo={config.repo}
      initialPreset={config.preset}
      initialModules={config.modules}
      initialRoles={config.roles}
    />,
  );

  await app.waitUntilExit();
}
