// Use Next's bundled Babel to test the same ES modules without a new dependency.
const fs = require("node:fs");
const path = require("node:path");
const babel = require("next/dist/compiled/babel/core");
const original = require.extensions[".js"];
require.extensions[".js"] = (module, filename) => {
  if (!filename.startsWith(path.resolve(__dirname, "..") + path.sep) || filename.includes("node_modules")) return original(module, filename);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, babelrc: false, configFile: false,
    plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
  });
  module._compile(code, filename);
};
