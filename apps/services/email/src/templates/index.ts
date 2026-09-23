import { layout } from "./layout.js";
import type { EmailTemplate, RenderedEmail, TemplateVariables } from "./template.type.js";

export type { EmailTemplate, RenderedEmail, TemplateVariables } from "./template.type.js";
export { escapeHtml, layout } from "./layout.js";

function define(
  name: string,
  required: readonly string[],
  secretVariables: readonly string[],
  render: (variables: TemplateVariables) => RenderedEmail,
): EmailTemplate {
  return { name, required, secretVariables, render };
}

const minutes = (value: string): string => {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 1 ? `${String(parsed)} minutes` : "1 minute";
};

/** Codes and one-time credentials are rendered and then dropped; they never reach a stored row. */
const TEMPLATES: readonly EmailTemplate[] = [
  define("verification_code", ["code", "expiresInMinutes"], ["code"], (v) => {
    const body = layout({
      heading: "Verify your email address",
      paragraphs: [
        "Use this code to finish setting up your BetNG account.",
        `The code expires in ${minutes(v["expiresInMinutes"] ?? "")}.`,
        "If you did not create an account, you can ignore this email.",
      ],
      code: v["code"] ?? "",
    });

    return { subject: "Your BetNG verification code", ...body };
  }),

  define("password_reset_code", ["code", "expiresInMinutes"], ["code"], (v) => {
    const body = layout({
      heading: "Reset your password",
      paragraphs: [
        "Use this code to choose a new password.",
        `The code expires in ${minutes(v["expiresInMinutes"] ?? "")}.`,
        "Your password stays the same unless the code is used. If you did not ask for it, reset your password and contact support.",
      ],
      code: v["code"] ?? "",
    });

    return { subject: "Your BetNG password reset code", ...body };
  }),

  /** The generic carrier for copy a calling service composes: security alerts and customer notices. */
  define("notice", ["subject", "heading", "body"], [], (v) => {
    const body = layout({
      heading: v["heading"] ?? "",
      paragraphs: (v["body"] ?? "").split("\n").filter((line) => line.trim() !== ""),
      ...(v["footer"] === undefined ? {} : { footer: v["footer"] }),
    });

    return { subject: v["subject"] ?? "BetNG", ...body };
  }),

  define("admin_credentials", ["name", "email", "temporaryPassword", "expiresInHours"], ["temporaryPassword"], (v) => {
    const body = layout({
      heading: "Your BetNG administrator account",
      paragraphs: [
        `${v["name"] ?? "Hello"}, an administrator account was created for you.`,
        `Sign in with ${v["email"] ?? ""} and the temporary password below, then set your own password and enrol two-factor authentication.`,
        `The temporary password stops working in ${v["expiresInHours"] ?? "24"} hours.`,
      ],
      code: v["temporaryPassword"] ?? "",
    });

    return { subject: "Your BetNG administrator account", ...body };
  }),

  define("shop_application_received", ["applicantName", "reference"], [], (v) => {
    const body = layout({
      heading: "We have your shop application",
      paragraphs: [
        `${v["applicantName"] ?? "Hello"}, thank you for applying to run a BetNG shop.`,
        `Your reference is ${v["reference"] ?? ""}. Keep it: you will need it, with this email address, to check your application.`,
        "We will email you once it has been reviewed.",
      ],
    });

    return { subject: "Your BetNG shop application", ...body };
  }),

  define("shop_application_decided", ["applicantName", "reference", "decision"], [], (v) => {
    const approved = v["decision"] === "APPROVED";
    const changes = v["decision"] === "REQUIRES_ACTION";
    const paragraphs = approved
      ? [
          `${v["applicantName"] ?? "Hello"}, your shop application has been accepted.`,
          "Your owner sign-in details follow in a separate email.",
        ]
      : changes
        ? [
            `${v["applicantName"] ?? "Hello"}, your shop application needs something from you before we can decide.`,
            v["reason"] ?? "",
            `Reply to this email quoting ${v["reference"] ?? ""}.`,
          ]
        : [
            `${v["applicantName"] ?? "Hello"}, your shop application was not accepted.`,
            v["reason"] ?? "",
            `If you think this is a mistake, reply to this email quoting ${v["reference"] ?? ""}.`,
          ];

    const body = layout({
      heading: approved ? "Your shop application was accepted" : changes ? "Your shop application needs attention" : "Your shop application was not accepted",
      paragraphs: paragraphs.filter((line) => line.trim() !== ""),
    });

    return { subject: `Your BetNG shop application (${v["reference"] ?? ""})`, ...body };
  }),

  define(
    "shop_owner_credentials",
    ["ownerName", "shopCode", "username", "temporaryPassword", "temporaryPin", "expiresInHours"],
    ["temporaryPassword", "temporaryPin"],
    (v) => {
      const body = layout({
        heading: "Your shop is ready",
        paragraphs: [
          `${v["ownerName"] ?? "Hello"}, shop ${v["shopCode"] ?? ""} is open.`,
          `Sign in at the cashier terminal as ${v["username"] ?? ""} with the temporary password below, then change it.`,
          `Your temporary PIN is ${v["temporaryPin"] ?? ""}. Both stop working in ${v["expiresInHours"] ?? "24"} hours.`,
          "Once you are in, you can create cashiers for your shop.",
        ],
        code: v["temporaryPassword"] ?? "",
      });

      return { subject: `Your BetNG shop ${v["shopCode"] ?? ""} is ready`, ...body };
    },
  ),

  define(
    "cashier_credentials",
    ["displayName", "shopCode", "username", "temporaryPassword", "temporaryPin", "expiresInHours"],
    ["temporaryPassword", "temporaryPin"],
    (v) => {
      const body = layout({
        heading: "Your cashier sign-in",
        paragraphs: [
          `${v["displayName"] ?? "Hello"}, an account was created for you at shop ${v["shopCode"] ?? ""}.`,
          `Sign in as ${v["username"] ?? ""} with the temporary password below, then change it.`,
          `Your temporary PIN is ${v["temporaryPin"] ?? ""}. Both stop working in ${v["expiresInHours"] ?? "24"} hours.`,
        ],
        code: v["temporaryPassword"] ?? "",
      });

      return { subject: "Your BetNG cashier sign-in", ...body };
    },
  ),
];

const BY_NAME: ReadonlyMap<string, EmailTemplate> = new Map(TEMPLATES.map((template) => [template.name, template]));

export const TEMPLATE_NAMES: readonly string[] = TEMPLATES.map((template) => template.name);

export function findTemplate(name: string): EmailTemplate | undefined {
  return BY_NAME.get(name);
}
