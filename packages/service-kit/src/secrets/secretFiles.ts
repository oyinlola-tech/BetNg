import { readFileSync } from "node:fs";

/**
 * Resolves `NAME_FILE=/run/secrets/name` into `NAME`, for Docker and Kubernetes secrets.
 * Setting both is refused so a stale inline value can't silently win.
 */
export function loadSecretFiles(env: Record<string, string | undefined> = process.env): readonly string[] {
  const loaded: string[] = [];

  for (const [key, path] of Object.entries(env)) {
    if (!key.endsWith("_FILE") || path === undefined || path === "") continue;

    const name = key.slice(0, -"_FILE".length);

    if (env[name] !== undefined && env[name] !== "") throw new Error(`Both ${name} and ${key} are set; keep one.`);

    const value = readFileSync(path, "utf8").replace(/\r?\n$/, "");

    if (value === "") throw new Error(`${key} points at an empty file.`);

    env[name] = value;
    loaded.push(name);
  }

  return loaded;
}
