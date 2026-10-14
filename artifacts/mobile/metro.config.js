const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Native-only packages cannot load in a browser. On web (the local visual preview) they resolve to a no-op stub;
// phones are untouched.
const WEB_STUBS = ["@speechmatics/expo-two-way-audio"];
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_STUBS.some((m) => moduleName === m || moduleName.startsWith(m + "/"))) {
    return { type: "sourceFile", filePath: path.join(__dirname, "scripts/web-stubs/native-only.js") };
  }
  return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
