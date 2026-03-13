import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const TEMPLATES_DIR = path.resolve(__dirname, "../../../templates");

function loadJsonFiles(dir: string, filename: string) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((d) => fs.statSync(path.join(dir, d)).isDirectory())
    .map((d) => {
      const fp = path.join(dir, d, filename);
      if (!fs.existsSync(fp)) return null;
      try {
        return JSON.parse(fs.readFileSync(fp, "utf-8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function templateLoaderPlugin(): Plugin {
  const virtualId = "virtual:clipper-templates";
  const resolvedId = "\0" + virtualId;

  return {
    name: "clipper-template-loader",
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;

      const presets = loadJsonFiles(path.join(TEMPLATES_DIR, "presets"), "preset.meta.json");
      const modules = loadJsonFiles(path.join(TEMPLATES_DIR, "modules"), "module.meta.json");

      // Map "base" field to "_base" for web UI compatibility
      const roles = loadJsonFiles(path.join(TEMPLATES_DIR, "roles"), "role.meta.json").map(
        (r: Record<string, unknown>) => {
          if (r.base) return { ...r, _base: true };
          return r;
        }
      );

      return `export const presets = ${JSON.stringify(presets)};
export const modules = ${JSON.stringify(modules)};
export const roles = ${JSON.stringify(roles)};`;
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(TEMPLATES_DIR)) {
        const mod = server.moduleGraph.getModuleById(resolvedId);
        if (mod) return [mod];
      }
    },
  };
}
