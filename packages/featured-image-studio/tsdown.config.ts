import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    admin: "src/admin.tsx",
  },
  format: "esm",
  dts: { sourcemap: false },
  sourcemap: false,
  clean: true,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  external: [
    "emdash",
    "react",
    "react/jsx-runtime",
    "@cloudflare/kumo",
    "@phosphor-icons/react",
    "zod",
  ],
});
