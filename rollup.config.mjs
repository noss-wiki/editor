import { defineConfig } from "rollup";
import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";

export default defineConfig([
  {
    input: ["src/index.ts"],
    output: {
      dir: "dist",
      format: "es",
      exports: "named",
      preserveModules: true,
      preserveModulesRoot: "src",
    },
    plugins: [
      typescript(),
      commonjs({
        include: ["node_modules/**"],
      }),
    ],
  },
]);
