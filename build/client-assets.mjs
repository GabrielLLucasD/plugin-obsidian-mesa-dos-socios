import { build } from "esbuild";
import { resolve } from "node:path";

export function clientAssetsPlugin() {
  return {
    name: "client-assets",

    setup(builder) {
      builder.onResolve(
        { filter: /^virtual:client-script$/ },
        () => ({
          path: "client-script",
          namespace: "client-assets",
        }),
      );

      builder.onLoad(
        { filter: /.*/, namespace: "client-assets" },
        async () => {
          const result = await build({
            entryPoints: ["src/client/main.ts"],
            bundle: true,
            platform: "browser",
            format: "iife",
            target: "es2021",
            write: false,
            metafile: true,
          });

          return {
            contents: result.outputFiles[0].text,
            loader: "text",
            watchFiles: Object.keys(result.metafile.inputs)
              .map((file) => resolve(file)),
          };
        },
      );
    },
  };
}