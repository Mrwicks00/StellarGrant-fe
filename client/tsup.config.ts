import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false, // keep readable for debugging; can be toggled true for production publish
  external: [
    "@stellar/stellar-sdk",
    "@stellar/stellar-base",
    "@stellar/freighter-api",
    "commander",
    "dotenv",
    "vue",
  ],
  esbuildOptions(options) {
    options.platform = "neutral";
    options.target = "es2022";
  },
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".mjs" : ".js",
    };
  },
});
