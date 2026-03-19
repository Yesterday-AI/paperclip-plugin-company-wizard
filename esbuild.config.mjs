import esbuild from "esbuild";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const presets = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx" });
const watch = process.argv.includes("--watch");

// Plugin to handle ?raw imports (load file contents as string)
const rawImportPlugin = {
  name: "raw-import",
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => {
      const resolved = path.resolve(path.dirname(args.importer), args.path.replace(/\?raw$/, ""));
      return { path: resolved, namespace: "raw" };
    });
    build.onLoad({ filter: /.*/, namespace: "raw" }, (args) => {
      const contents = fs.readFileSync(args.path, "utf-8");
      return { contents: `export default ${JSON.stringify(contents)};`, loader: "js" };
    });
  },
};

// Plugin to process CSS through PostCSS + Tailwind v4
const tailwindPlugin = {
  name: "tailwind-postcss",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const source = fs.readFileSync(args.path, "utf-8");
      const processor = postcss([tailwindcss()]);
      const result = await processor.process(source, { from: args.path });
      return { contents: result.css, loader: "css" };
    });
  },
};

// Customize UI config
const uiConfig = {
  ...presets.esbuild.ui,
  plugins: [tailwindPlugin, rawImportPlugin, ...(presets.esbuild.ui.plugins || [])],
};

const workerCtx = await esbuild.context(presets.esbuild.worker);
const manifestCtx = await esbuild.context(presets.esbuild.manifest);
const uiCtx = await esbuild.context(uiConfig);

if (watch) {
  await Promise.all([workerCtx.watch(), manifestCtx.watch(), uiCtx.watch()]);
  console.log("esbuild watch mode enabled for worker, manifest, and ui");
} else {
  await Promise.all([workerCtx.rebuild(), manifestCtx.rebuild(), uiCtx.rebuild()]);
  await Promise.all([workerCtx.dispose(), manifestCtx.dispose(), uiCtx.dispose()]);
}
