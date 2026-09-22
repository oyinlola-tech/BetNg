import { ipMatchesCidr, normalizeIpAddress, parseCidr, parseIpAddress } from "@zudojs/http";

export type IpMatcher = (address: string) => boolean;

const MAPPED_IPV4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/;

// `::ffff:1.2.3.4` and `1.2.3.4` are the same client; keys and blocklists must agree on one form.
export function canonicalIp(address: string): string {
  const normalized = normalizeIpAddress(address);

  return MAPPED_IPV4.exec(normalized)?.[1] ?? normalized;
}

export function createIpMatcher(entries: readonly string[]): IpMatcher {
  const cidrs = entries.map((entry) => {
    const trimmed = entry.trim();
    const cidr = parseCidr(trimmed.includes("/") ? trimmed : `${trimmed}/${trimmed.includes(":") ? "128" : "32"}`);

    if (cidr === undefined) {
      throw new Error(`"${trimmed}" is not an IP address or CIDR range.`);
    }

    return cidr;
  });

  return (address) => {
    const parsed = parseIpAddress(canonicalIp(address));

    return parsed !== undefined && cidrs.some((cidr) => ipMatchesCidr(parsed, cidr));
  };
}
