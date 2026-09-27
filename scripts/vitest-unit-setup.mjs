// Vitest global setup for the unit project: the service test databases start every run empty.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "db-test.sh");

export default function setup() {
  execFileSync("bash", [script, "reset"], { stdio: "inherit" });
}
