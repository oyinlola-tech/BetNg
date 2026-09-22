export {
  accountRestricted,
  actorNotAllowed,
  betNotFound,
  insufficientFunds,
  invalidBet,
  invalidRequest,
  limitExceeded,
  limitsUnavailable,
  marketClosed,
  oddsChanged,
  placementUnavailable,
  riskRejected,
  riskUnavailable,
  selfExcluded,
  stakeLimited,
  stakeNotTaken,
  ticketConflict,
  ticketNotFound,
  upstreamUnavailable,
} from "./betting.error.js";
export type { CurrentPrice } from "./betting.error.js";

export {
  classifyPeerFailure,
  PeerRefusedError,
  PeerUnavailableError,
} from "./peer.error.js";
