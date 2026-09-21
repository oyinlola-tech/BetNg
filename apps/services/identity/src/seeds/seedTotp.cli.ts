/** Prints the current TOTP for the seeded two-factor admin. Development convenience only. */

import process from "node:process";
import { generateTotp } from "../utils/index.js";
import { SEED_ADMIN_TOTP_SECRET } from "./demo.seed.js";

if (process.env["NODE_ENV"] === "production") {
  throw new Error("The seed TOTP helper does not run in production.");
}

const secret = process.env["SEED_ADMIN_TOTP_SECRET"] ?? SEED_ADMIN_TOTP_SECRET;

process.stdout.write(`${generateTotp(secret, Date.now())}\n`);
