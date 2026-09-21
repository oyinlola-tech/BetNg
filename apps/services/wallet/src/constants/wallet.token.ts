import { createToken } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type { WalletSettings } from "../configs/index.js";
import type { WalletRepository } from "../interfaces/index.js";

export const WALLET_REPOSITORY_TOKEN =
  createToken<WalletRepository>("wallet.repository");

export const WALLET_SETTINGS_TOKEN =
  createToken<WalletSettings>("wallet.settings");

export const LOGGER_TOKEN = createToken<Logger>("wallet.logger");
