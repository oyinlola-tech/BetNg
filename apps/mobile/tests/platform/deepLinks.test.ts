import { describe, expect, it } from "vitest";
import { hostsFromSiteUrl, parseDeepLink } from "../../src/platform/deepLinks";

const options = { schemes: ["betng"], hosts: ["betng.example"] };
const target = (url: unknown) => parseDeepLink(url, options);

describe("parseDeepLink", () => {
  it("maps the supported routes from the app scheme to ids only", () => {
    expect(target("betng://match/M_123-abc")).toEqual({ accepted: true, target: { name: "Match", matchId: "M_123-abc" } });
    expect(target("betng:///results")).toEqual({ accepted: true, target: { name: "Results" } });
    expect(target("betng://bet/BET42")).toEqual({ accepted: true, target: { name: "Bet", betId: "BET42" } });
    expect(target("betng://payment/PAY-000123")).toEqual({ accepted: true, target: { name: "Payment", reference: "PAY-000123" } });
    expect(target("BETNG://Match/abc")).toEqual({ accepted: true, target: { name: "Match", matchId: "abc" } });
  });

  it("accepts https links only on an allowlisted host", () => {
    expect(target("https://betng.example/match/abc?utm=x#top")).toEqual({ accepted: true, target: { name: "Match", matchId: "abc" } });
    expect(target("https://BETNG.example/results")).toEqual({ accepted: true, target: { name: "Results" } });
    expect(target("https://evil.example/match/abc").accepted).toBe(false);
    expect(target("https://betng.example.evil.com/match/abc").accepted).toBe(false);
    expect(target("http://betng.example/match/abc").accepted).toBe(false);
    expect(target("https://user@betng.example/match/abc").accepted).toBe(false);
  });

  it("rejects other schemes", () => {
    for (const url of ["javascript:alert(1)", "otherapp://match/abc", "file:///match/abc", "intent://match/abc", "data:text/html,x"]) {
      expect(target(url)).toEqual({ accepted: false, target: { name: "Home" } });
    }
  });

  it("validates id charset and length", () => {
    expect(target("betng://match/").accepted).toBe(false);
    expect(target("betng://match/a%2Fb").accepted).toBe(false);
    expect(target("betng://match/a.b").accepted).toBe(false);
    expect(target("betng://match/<script>").accepted).toBe(false);
    expect(target(`betng://match/${"a".repeat(65)}`).accepted).toBe(false);
    expect(target(`betng://match/${"a".repeat(64)}`).accepted).toBe(true);
    expect(target("betng://payment/abc").accepted).toBe(false);
    expect(target("betng://match/../wallet").accepted).toBe(false);
    expect(target("betng://match/a\\b").accepted).toBe(false);
  });

  it("sends unknown, extra or malformed paths home", () => {
    for (const url of ["betng://wallet", "betng://match/abc/extra", "betng://results/2024", "betng://", "", "betng://match/a b", "betng://match/a\u0000b", 42, undefined, `betng://match/${"a".repeat(600)}`]) {
      expect(target(url).target).toEqual({ name: "Home" });
    }
    expect(target("betng://")).toEqual({ accepted: true, target: { name: "Home" } });
    expect(target("betng://wallet").accepted).toBe(false);
  });

  it("derives universal-link hosts only from an https site URL", () => {
    expect(hostsFromSiteUrl("https://BetNG.example/path")).toEqual(["betng.example"]);
    expect(hostsFromSiteUrl("http://betng.example")).toEqual([]);
    expect(hostsFromSiteUrl(undefined)).toEqual([]);
  });
});
