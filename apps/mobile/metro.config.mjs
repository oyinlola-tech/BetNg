import path from "node:path";
import { getDefaultConfig } from "expo/metro-config.js";

const root = import.meta.dirname;
const config = getDefaultConfig(root);
const nodeCrypto = path.join(root, "src/platform/nodeCrypto.ts");

// The shared validation packages import node:crypto, which a device does not have.
config.resolver.resolveRequest = (context, moduleName, platform) =>
  moduleName === "node:crypto" || moduleName === "crypto"
    ? { type: "sourceFile", filePath: nodeCrypto }
    : context.resolveRequest(context, moduleName, platform);

export default config;
