import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p) {
  if (!(await exists(p))) return null;
  return JSON.parse(await readFile(p, 'utf-8'));
}

export async function loadPresets(templatesDir) {
  const presetsDir = join(templatesDir, 'presets');
  const presets = [];
  if (!(await exists(presetsDir))) return presets;
  const dirs = await readdir(presetsDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const presetFile = join(presetsDir, dir.name, 'preset.meta.json');
    if (await exists(presetFile)) {
      presets.push(JSON.parse(await readFile(presetFile, 'utf-8')));
    }
  }
  return presets;
}

export async function loadModules(templatesDir) {
  const modulesDir = join(templatesDir, 'modules');
  const modules = [];
  if (!(await exists(modulesDir))) return modules;
  const dirs = await readdir(modulesDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const moduleJson = await readJson(join(modulesDir, dir.name, 'module.meta.json'));
    const readmePath = join(modulesDir, dir.name, 'README.md');
    let description = '';
    if (await exists(readmePath)) {
      const content = await readFile(readmePath, 'utf-8');
      const descLine = content.split('\n').find((l) => l.length > 0 && !l.startsWith('#'));
      description = descLine?.trim() || '';
    }
    modules.push({ name: dir.name, description, ...(moduleJson || {}) });
  }
  return modules;
}

export async function loadRoles(templatesDir) {
  const rolesDir = join(templatesDir, 'roles');
  const roles = [];
  if (!(await exists(rolesDir))) return roles;

  const dirs = await readdir(rolesDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const roleJson = await readJson(join(rolesDir, dir.name, 'role.meta.json'));
    if (roleJson) {
      roles.push(roleJson);
    }
  }

  return roles;
}
