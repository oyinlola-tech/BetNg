#!/usr/bin/env node
// Fails when a public (VITE_/EXPO_PUBLIC_) variable is named like a secret, or when a built bundle contains secret names or key material.
// Usage: node scripts/check-public-env.mjs [--dist <dir>]...   (defaults to every existing apps/{web,tv,shop,admin}/dist)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BROWSER_APPS = ["web", "tv", "shop", "admin"];
const PUBLIC_NAME = /\b(?:VITE|EXPO_PUBLIC)_[A-Z0-9_]+\b/g;
const FORBIDDEN_IN_NAME = /SECRET|PRIVATE|PASSWORD|TOKEN|API_KEY/;
const SOURCE_EXTENSIONS = /\.(?:[cm]?[jt]sx?|json)$/;
const BUNDLE_EXTENSIONS = /\.(?:[cm]?js|css|html|json|map|txt|svg|webmanifest)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", "generated", ".expo", "android", "ios"]);

const SECRET_NAMES = [
  "PAYSTACK_SECRET_KEY",
  "FLUTTERWAVE_SECRET_KEY",
  "TERMII_API_KEY",
  "SENDGRID_API_KEY",
  "INTERNAL_SERVICE_TOKEN",
  "SESSION_SECRET",
  "SIMULATION_SEED_SECRET",
];
const SECRET_VALUES = [
  { label: "Paystack/Stripe secret key", pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{8,}/ },
  { label: "Flutterwave secret key", pattern: /FLWSECK(?:_TEST)?-[A-Za-z0-9]{8,}/ },
  { label: "SendGrid API key", pattern: /\bSG\.[\w-]{16,}\.[\w-]{16,}/ },
  { label: "private key block", pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/ },
  { label: "database URL with credentials", pattern: /postgres(?:ql)?:\/\/[^\s:/@"'`]+:[^\s@"'`]+@/ },
];

function* walk(directory, extensions) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path, extensions);
    } else if (entry.isFile() && extensions.test(entry.name)) {
      yield path;
    }
  }
}

const problems = [];
const rel = (path) => relative(root, path) || path;

function checkNames(path, text) {
  for (const [name] of text.matchAll(PUBLIC_NAME)) {
    if (FORBIDDEN_IN_NAME.test(name)) problems.push(`${rel(path)}: public variable ${name} is named like a secret`);
  }
}

const exampleFiles = [join(root, ".env.example"), ...["web", "tv", "shop", "admin", "mobile"].map((app) => join(root, "apps", app, ".env.example"))].filter(existsSync);
const sourceRoots = [
  ...["web", "tv", "shop", "admin", "mobile"].map((app) => join(root, "apps", app)),
  ...readdirSync(join(root, "packages")).map((name) => join(root, "packages", name, "src")),
].filter((path) => existsSync(path) && statSync(path).isDirectory());

let sourceCount = 0;
for (const file of exampleFiles) checkNames(file, readFileSync(file, "utf8"));
for (const directory of sourceRoots) {
  for (const file of walk(directory, SOURCE_EXTENSIONS)) {
    sourceCount += 1;
    checkNames(file, readFileSync(file, "utf8"));
  }
}

const args = process.argv.slice(2);
const distDirs = [];
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--dist" && args[index + 1] !== undefined) {
    distDirs.push(resolve(args[index + 1]));
    index += 1;
  } else {
    console.error(`unknown argument: ${args[index]}`);
    process.exit(2);
  }
}
if (distDirs.length === 0) {
  distDirs.push(...BROWSER_APPS.map((app) => join(root, "apps", app, "dist")).filter(existsSync));
}

let bundleCount = 0;
for (const directory of distDirs) {
  if (!existsSync(directory)) {
    problems.push(`${rel(directory)}: dist directory not found`);
    continue;
  }
  for (const file of walk(directory, BUNDLE_EXTENSIONS)) {
    bundleCount += 1;
    const text = readFileSync(file, "utf8");

    for (const name of SECRET_NAMES) {
      if (text.includes(name)) problems.push(`${rel(file)}: contains the secret variable name ${name}`);
    }
    for (const { label, pattern } of SECRET_VALUES) {
      if (pattern.test(text)) problems.push(`${rel(file)}: contains what looks like a ${label}`);
    }
    checkNames(file, text);
  }
}

console.log(
  `public env check: ${exampleFiles.length} example files, ${sourceCount} source files, ${bundleCount} bundle files in ${distDirs.length} dist dir(s)`,
);
if (problems.length > 0) {
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}
console.log("public env check: passed");
