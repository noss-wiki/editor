import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: [
    "./src/index",
    // {
    //   input: "./src/index",
    //   builder: "mkdist", // doesn't seem to work? results in empty directory
    // },
  ],
  clean: true,
  outDir: "dist",
  declaration: true,
});
