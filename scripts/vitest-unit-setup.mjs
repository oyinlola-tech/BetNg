// Vitest global setup: the service test databases start a run empty. Not referenced by vitest.config.ts yet.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "db-test.sh");

export default function setup() {
  execFileSync("bash", [script, "reset"], { stdio: "inherit" });
}
