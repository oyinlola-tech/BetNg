import { createToken } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type {
  BetRepository,
  IdentityPeer,
  MarketReader,
  MatchLock,
  RiskPeer,
  WalletPeer,
} from "../interfaces/index.js";

export const BET_REPOSITORY_TOKEN =
  createToken<BetRepository>("betting.repository");

export const MARKET_READER_TOKEN =
  createToken<MarketReader>("betting.marketReader");

export const MATCH_LOCK_TOKEN = createToken<MatchLock>("betting.matchLock");

export const RISK_PEER_TOKEN = createToken<RiskPeer>("betting.riskPeer");

export const WALLET_PEER_TOKEN = createToken<WalletPeer>("betting.walletPeer");

export const IDENTITY_PEER_TOKEN = createToken<IdentityPeer>(
  "betting.identityPeer",
);

export const CLOCK_TOKEN = createToken<() => Date>("betting.clock");

export const LOGGER_TOKEN = createToken<Logger>("betting.logger");
