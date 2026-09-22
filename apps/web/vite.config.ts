import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const SW_SOURCE = new URL("./sw/sw.js", import.meta.url);
const PUBLIC_EXCLUDED = new Set(["sw.js", "robots.txt"]);

function publicFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) return publicFiles(path, root);

    const published = relative(root, path).split(sep).join("/");

    return PUBLIC_EXCLUDED.has(published) ? [] : [published];
  });
}

function originOf(value: string | undefined): string {
  try {
    return value === undefined || value === "" ? "" : new URL(value).origin;
  } catch {
    return "";
  }
}

/** Emits /sw.js with the precache list of this build; the worker never caches private or non-GET traffic. */
function serviceWorker(): Plugin {
  let publicDir = "";
  let apiOrigin = "";

  return {
    name: "betng-service-worker",
    apply: "build",
    configResolved(config) {
      publicDir = config.publicDir;
      apiOrigin = originOf(config.env["VITE_API_URL"] as string | undefined);
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const built = Object.values(bundle)
          .map((file) => file.fileName)
          .filter((name) => !name.endsWith(".map") && name !== "sw.js")
          .concat("index.html");
        const precache = [...new Set([...built, ...(publicDir === "" ? [] : publicFiles(publicDir))])].map((name) => `/${name}`).sort();
        const source = readFileSync(SW_SOURCE, "utf8");
        const version = createHash("sha256").update(precache.join("\n")).update(source).update(apiOrigin).digest("hex").slice(0, 12);
        const header = `self.__BETNG_BUILD__ = ${JSON.stringify({ version, apiOrigin, precache })};\n`;

        this.emitFile({ type: "asset", fileName: "sw.js", source: header + source });
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  server: {
    host: process.env["HOST"] ?? "127.0.0.1",
    port: 4200,
  },
});
