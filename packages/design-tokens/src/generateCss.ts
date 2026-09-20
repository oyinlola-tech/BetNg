/**
 * Build step: writes `css/tokens.css` from the TypeScript tokens.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCss } from "./css.js";

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../css/tokens.css");

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, renderCss(), "utf8");
