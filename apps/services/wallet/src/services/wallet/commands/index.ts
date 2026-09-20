/**
 * @betng/wallet-service/services/wallet/commands
 *
 * The write side of the wallet service. Every entry is simulated.
 */

export {
  DepositFundsCommand,
  DepositFundsHandler,
} from "./depositFunds/index.js";
export {
  WithdrawFundsCommand,
  WithdrawFundsHandler,
} from "./withdrawFunds/index.js";
