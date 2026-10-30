import { build, context } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import { clientAssetsPlugin } from "./build/client-assets.mjs";
// O resultado já fica no lugar onde o Obsidian procura plugins do vault de teste.
const outputDirectory = "sandbox-vault/.obsidian/plugins/obsidian-vtt";
await mkdir(outputDirectory, { recursive: true });
await copyFile("manifest.json", `${outputDirectory}/manifest.json`);

const options = {
  entryPoints: ["src/main.ts"],
  outfile: `${outputDirectory}/main.js`,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "es2021",
  external: ["obsidian", "electron"],
  logLevel: "info",
  sourcemap: "inline",
  loader: {
  ".html": "text",
  ".css": "text",
  },
  plugins: [clientAssetsPlugin()],
};

if (process.argv.includes("--watch")) {
  const builder = await context(options);
  await builder.watch();
} else {
  await build(options);
}
