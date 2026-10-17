// pnpm installs babel-preset-expo only as a dependency of expo, so the release bundler can't find it by name.
const preset = require.resolve("babel-preset-expo", { paths: [require.resolve("expo/package.json")] });

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [[preset, { unstable_transformImportMeta: true }]],
  };
};
