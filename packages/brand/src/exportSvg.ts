import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LEAGUE_MARKS, leagueMarkSvg } from "./leagues.js";
import { logoSvg } from "./logo.js";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../svg");

mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "betng-logo.svg"), logoSvg({ tile: "#2457F5", ink: "#FFFFFF", size: 256 }));
writeFileSync(resolve(out, "betng-logo-dark.svg"), logoSvg({ tile: "#4C7DFF", ink: "#0A0C10", size: 256 }));
writeFileSync(resolve(out, "betng-logo-mono.svg"), logoSvg({ tile: "#0E1218", ink: "#FFFFFF", size: 256 }));

for (const mark of LEAGUE_MARKS) writeFileSync(resolve(out, `league-${mark.slug}.svg`), leagueMarkSvg(mark, 192));
