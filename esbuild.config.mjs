import { build } from "esbuild";

await build({
  entryPoints: ["src/cli.jsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "dist/cli.mjs",
  banner: {
    js: '#!/usr/bin/env node\nimport { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  external: [
    "node:*",
  ],
  alias: {
    "react-devtools-core": "./src/shims/empty.js",
  },
  jsx: "automatic",
  jsxImportSource: "react",
});

console.log("Built dist/cli.mjs");
