export {
  actorNotAllowed,
  betNotFound,
  insufficientFunds,
  invalidBet,
  invalidRequest,
  marketClosed,
  oddsChanged,
  placementUnavailable,
  riskRejected,
  riskUnavailable,
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
