import { createToken } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type { EmailSettings } from "../configs/index.js";
import type { EmailRepository } from "../interfaces/index.js";
import type { EmailProvider } from "../providers/index.js";

export const EMAIL_REPOSITORY_TOKEN = createToken<EmailRepository>("email.repository");

export const EMAIL_PROVIDER_TOKEN = createToken<EmailProvider>("email.provider");

export const EMAIL_SETTINGS_TOKEN = createToken<EmailSettings>("email.settings");

export const LOGGER_TOKEN = createToken<Logger>("email.logger");
