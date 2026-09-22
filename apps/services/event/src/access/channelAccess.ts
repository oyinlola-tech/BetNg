import { MATCH_CHANNEL_PATTERN } from "@betng/contracts";
import type { Actor } from "@betng/service-kit";

export type ChannelRule =
  | { readonly type: "public" }
  | { readonly type: "customer"; readonly userId: string }
  | { readonly type: "admin"; readonly permission: string }
  | { readonly type: "shop"; readonly shopId: string };

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const CUSTOMER_CHANNEL = new RegExp(`^(?:wallet|bets|notifications|user):(${UUID})$`);
const SHOP_CHANNEL = new RegExp(`^shop:(${UUID})$`);

export const SYSTEM_CHANNEL = "system";

const ADMIN_CHANNELS: Readonly<Record<string, string>> = {
  admin: "reports:read",
  risk: "risk:read",
};

export function channelRule(channel: string): ChannelRule | undefined {
  if (MATCH_CHANNEL_PATTERN.test(channel) || channel === SYSTEM_CHANNEL) return { type: "public" };

  const customer = CUSTOMER_CHANNEL.exec(channel)?.[1];

  if (customer !== undefined) return { type: "customer", userId: customer.toLowerCase() };

  const shop = SHOP_CHANNEL.exec(channel)?.[1];

  if (shop !== undefined) return { type: "shop", shopId: shop.toLowerCase() };

  const permission = ADMIN_CHANNELS[channel];

  return permission === undefined ? undefined : { type: "admin", permission };
}

export function mayRead(rule: ChannelRule, actor: Actor | undefined): boolean {
  switch (rule.type) {
    case "public":
      return true;
    case "customer":
      return actor?.kind === "CUSTOMER" && actor.id.toLowerCase() === rule.userId;
    case "shop":
      return actor?.kind === "CASHIER" && actor.shopId?.toLowerCase() === rule.shopId;
    case "admin":
      return actor?.kind === "ADMIN" && actor.permissions.includes(rule.permission);
  }
}

export function isPrivate(channel: string): boolean {
  const rule = channelRule(channel);

  return rule !== undefined && rule.type !== "public";
}
