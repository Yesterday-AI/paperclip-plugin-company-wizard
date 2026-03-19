export interface PresetData {
  name: string;
  description: string;
  base?: string;
  modules?: string[];
  roles?: string[];
  constraints?: string[];
}

export interface ModuleData {
  name: string;
  description: string;
  capabilities?: Array<{
    skill: string;
    owners: string[];
    fallbackSkill?: string;
  }>;
  activatesWithRoles?: string[];
  requires?: string[];
  tasks?: Array<{
    title: string;
    assignTo: string;
    description?: string;
  }>;
}

export interface RoleData {
  name: string;
  title: string;
  description: string;
  _base?: boolean;
  division?: string;
  tagline?: string;
  paperclipRole?: string;
  reportsTo?: string;
  adapter?: Record<string, unknown>;
  enhances?: string[];
}

export interface TemplateData {
  presets: PresetData[];
  modules: ModuleData[];
  roles: RoleData[];
}
