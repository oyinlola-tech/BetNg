// The static list comes from GATEWAY_IP_BLOCKLIST and always applies. The dynamic set `<prefix>:blocked-ips`
// (exact addresses, added by operators with SADD) is skipped while Redis is unreachable.

import { canonicalIp, createIpMatcher } from "@betng/service-kit";
import type { Logger, RedisConnection } from "@betng/service-kit";
import type { IpBlocklist } from "../interfaces/index.js";

const BREAKER_MS = 2000;

export interface IpBlocklistOptions {
  readonly entries: readonly string[];
  readonly prefix: string;
  readonly redis?: RedisConnection;
  readonly logger: Logger;
}

export function blockedIpsKey(prefix: string): string {
  return `${prefix}:blocked-ips`;
}

export function createIpBlocklist(options: IpBlocklistOptions): IpBlocklist {
  const matches = createIpMatcher(options.entries);
  const key = blockedIpsKey(options.prefix);
  const { redis, logger } = options;
  let downUntil = 0;
  let warned = false;

  async function dynamicallyBlocked(address: string): Promise<boolean> {
    if (redis === undefined || Date.now() < downUntil) return false;

    try {
      await redis.connect();
      const blocked = await redis.client.sIsMember(key, address);

      warned = false;

      return Number(blocked) === 1;
    } catch (error) {
      downUntil = Date.now() + BREAKER_MS;

      if (!warned) {
        warned = true;
        logger.warn("The dynamic IP blocklist cannot reach Redis; only the static list applies", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return false;
    }
  }

  return {
    isBlocked: async (address) => {
      const canonical = canonicalIp(address);

      return matches(canonical) || (await dynamicallyBlocked(canonical));
    },
  };
}
