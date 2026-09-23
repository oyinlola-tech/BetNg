export const EMAIL_COMMAND = Object.freeze({
  SEND: "email.send",
  APPLY_EVENT: "email.applyEvent",
  SUPPRESS: "email.suppress",
});

export const EMAIL_QUERY = Object.freeze({
  GET_MESSAGE: "email.getMessage",
});

export const EMAIL_PROCEDURE = Object.freeze({
  SEND: "email.send",
  STATUS: "email.status",
});

export const WEBHOOK_ROUTE = "sendbyte" as const;

export const LIMITS = Object.freeze({
  /** SendByte caps a subject at 998; we cap far lower so a subject cannot be used as a payload. */
  SUBJECT_MAX: 200,
  TEMPLATE_MAX: 60,
  IDEMPOTENCY_KEY_MIN: 8,
  IDEMPOTENCY_KEY_MAX: 120,
  TAGS_MAX: 10,
  TAG_MAX: 40,
  VARIABLES_MAX: 40,
  VARIABLE_VALUE_MAX: 2000,
  ADDRESS_MAX: 254,
});
