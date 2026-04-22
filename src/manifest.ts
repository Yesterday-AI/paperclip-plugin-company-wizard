import type { PaperclipPluginManifestV1 } from '@paperclipai/plugin-sdk';

const manifest: PaperclipPluginManifestV1 = {
  id: 'yesterday-ai.paperclip-plugin-company-wizard',
  apiVersion: 1,
  version: '0.1.15',
  displayName: 'Company Wizard',
  description: 'AI-powered wizard to bootstrap agent companies from composable templates',
  author: 'Yesterday',
  categories: ['workspace', 'ui'],
  capabilities: [
    'companies.read',
    'issues.create',
    'issues.read',
    'issues.update',
    'goals.create',
    'goals.read',
    'agents.read',
    'projects.read',
    'plugin.state.read',
    'plugin.state.write',
    'events.subscribe',
    'ui.page.register',
    'ui.sidebar.register',
  ],
  instanceConfigSchema: {
    type: 'object',
    properties: {
      companiesDir: {
        type: 'string',
        description:
          'Directory where assembled company workspaces are written. Defaults to ~/.paperclip/instances/default/companies. Override for Docker setups (e.g. /paperclip/instances/default/companies).',
      },
      templatesPath: {
        type: 'string',
        description:
          'Path to the templates directory. Defaults to ~/.paperclip/plugin-templates (auto-downloaded from templatesRepoUrl if missing). Override for Docker setups (e.g. /paperclip/plugin-templates).',
      },
      templatesRepoUrl: {
        type: 'string',
        default:
          'https://github.com/Yesterday-AI/paperclip-plugin-company-wizard/tree/main/templates',
        description:
          'GitHub tree URL to pull templates from when the templates directory does not exist.',
      },
      anthropicApiKey: {
        type: 'string',
        format: 'secret-ref',
        description:
          'Anthropic API key for the AI wizard. Required to use the AI-powered company setup path.',
      },
      paperclipUrl: {
        type: 'string',
        description:
          'Paperclip instance URL. Defaults to http://localhost:3100 or the PAPERCLIP_PUBLIC_URL env var.',
      },
      paperclipEmail: {
        type: 'string',
        description: 'Board login email (for authenticated instances).',
      },
      paperclipPassword: {
        type: 'string',
        format: 'secret-ref',
        description: 'Board login password.',
      },
      disableBoardApprovalOnNewCompanies: {
        type: 'boolean',
        default: false,
        description:
          'Optional. If true, the wizard will PATCH new companies to set requireBoardApprovalForNewAgents=false during provisioning. Leave false to preserve approval-gated hiring policies.',
      },
    },
  },
  entrypoints: {
    worker: './dist/worker.js',
    ui: './dist/ui',
  },
  ui: {
    slots: [
      {
        type: 'page',
        id: 'company-wizard',
        displayName: 'Company Wizard',
        exportName: 'WizardPage',
        routePath: 'company-creator',
      },
      {
        type: 'sidebar',
        id: 'company-wizard-link',
        displayName: 'Create Company',
        exportName: 'SidebarLink',
      },
    ],
  },
};

export default manifest;
