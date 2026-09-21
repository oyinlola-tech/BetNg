import { describe, expect, it } from "vitest";
import { CREST_EMBLEMS, CREST_PATTERNS, CREST_SHAPES, crestFor, crestLayers, crestSvg, detailFor, shapePath } from "../src/index.js";
import type { CrestSpec } from "../src/index.js";

const colors = { primary: "#123C7A", secondary: "#F2C230", onPrimary: "#FFFFFF" };
const ids = Array.from({ length: 80 }, (_, i) => `team-${String(i + 1)}`);
const key = (s: CrestSpec): string => `${s.shape}/${s.pattern}/${s.emblem}`;

describe("crestFor", () => {
  it("derives the same spec for the same id", () => {
    for (const id of ids) expect(crestFor({ id, colors })).toEqual(crestFor({ id, colors: { ...colors } }));
  });

  it("spreads ids across shape, pattern and emblem", () => {
    const specs = ids.map((id) => crestFor({ id, colors }));

    expect(new Set(specs.map(key)).size).toBeGreaterThanOrEqual(40);
    expect(new Set(specs.map((s) => s.shape)).size).toBe(CREST_SHAPES.length);
    expect(new Set(specs.map((s) => s.pattern)).size).toBe(CREST_PATTERNS.length);
    expect(new Set(specs.map((s) => s.emblem)).size).toBeGreaterThanOrEqual(CREST_EMBLEMS.length - 1);
  });

  it("never derives a blank field", () => {
    for (const id of Array.from({ length: 600 }, (_, i) => `club_${String(i)}`)) {
      const spec = crestFor({ id, colors });

      if (spec.pattern === "solid" || spec.pattern === "border") expect(spec.emblem).not.toBe("none");
    }
  });

  it("prefers platform-supplied fields", () => {
    const spec = crestFor({ id: "team-1", colors, crest: { shape: "hex", pattern: "saltire", emblem: "anchor", accent: "#00FFAA" } });

    expect(spec).toMatchObject({ shape: "hex", pattern: "saltire", emblem: "anchor", accent: "#00FFAA", primary: colors.primary, secondary: colors.secondary });
  });

  it("accepts the documented spelling and an explicit empty emblem", () => {
    const spec = crestFor({ id: "team-1", colors, crest: { shape: "square-notch", pattern: "Hoops", emblem: "none" } });

    expect(spec).toMatchObject({ shape: "squareNotch", pattern: "hoops", emblem: "none" });
  });

  it("keeps derived fields for the ones the platform omits", () => {
    const derived = crestFor({ id: "team-7", colors });
    const partial = crestFor({ id: "team-7", colors, crest: { shape: "oval" } });

    expect(partial.shape).toBe("oval");
    expect(partial.pattern).toBe(derived.pattern);
    expect(partial.emblem).toBe(derived.emblem);
  });

  it("falls back when an override is invalid", () => {
    const derived = crestFor({ id: "team-9", colors });
    const spec = crestFor({ id: "team-9", colors, crest: { shape: "blob", pattern: "", emblem: "dragon", accent: 'red" onload="x' } });

    expect(spec).toEqual(derived);
  });

  it("replaces unsafe colours rather than emitting them", () => {
    const spec = crestFor({ id: "team-9", colors: { primary: '"/><script>', secondary: "url(#x)" } });
    const svg = crestSvg(spec, 64);

    expect(svg).not.toContain("script");
    expect(svg).not.toContain("url(#x)");
  });

  it("picks a readable accent", () => {
    expect(crestFor({ id: "a", colors: { primary: "#FFFFFF", secondary: "#000000" } }).accent).toBe("#14130F");
    expect(crestFor({ id: "a", colors: { primary: "#0A0C10", secondary: "#FFFFFF" } }).accent).toBe("#FFFFFF");
    expect(crestFor({ id: "a", colors: { primary: "#FFFFFF", secondary: "#000000", onPrimary: "#FFFFFF" } }).accent).toBe("#14130F");
  });
});

describe("detailFor", () => {
  it("steps detail by size", () => {
    expect([16, 20, 23].map(detailFor)).toEqual(["minimal", "minimal", "minimal"]);
    expect([24, 32, 39].map(detailFor)).toEqual(["reduced", "reduced", "reduced"]);
    expect([40, 64, 128].map(detailFor)).toEqual(["full", "full", "full"]);
  });
});

describe("crestLayers", () => {
  const spec: CrestSpec = { shape: "shield", pattern: "stripes", emblem: "star", primary: "#123C7A", secondary: "#F2C230", accent: "#FFFFFF" };

  it("starts with the shape and drops detail as size falls", () => {
    const full = crestLayers(spec, "full");
    const reduced = crestLayers(spec, "reduced");
    const minimal = crestLayers(spec, "minimal");

    expect(full[0]).toEqual({ d: shapePath("shield"), fill: "#123C7A" });
    expect(full.length).toBeGreaterThan(reduced.length);
    expect(reduced.length).toBeGreaterThan(minimal.length);
  });

  it("emits finite geometry for every combination", () => {
    for (const shape of CREST_SHAPES) {
      for (const pattern of CREST_PATTERNS) {
        for (const emblem of CREST_EMBLEMS) {
          for (const detail of ["full", "reduced", "minimal"] as const) {
            for (const layer of crestLayers({ ...spec, shape, pattern, emblem }, detail)) {
              expect(layer.d).toMatch(/^M/);
              expect(layer.d).not.toMatch(/NaN|Infinity|undefined/);
            }
          }
        }
      }
    }
  });
});

describe("crestSvg", () => {
  it("contains no text and is sized as asked", () => {
    for (const id of ids) {
      for (const size of [16, 32, 128]) {
        const svg = crestSvg(crestFor({ id, colors }), size);

        expect(svg).not.toMatch(/<text|<tspan/i);
        expect(svg).toContain(`width="${String(size)}"`);
        expect(svg).toContain('viewBox="0 0 64 64"');
      }
    }
  });

  it("escapes the title", () => {
    const svg = crestSvg(crestFor({ id: "x", colors }), 48, { title: 'A "<b>" & co' });

    expect(svg).toContain('role="img"');
    expect(svg).not.toContain("<b>");
  });
});
