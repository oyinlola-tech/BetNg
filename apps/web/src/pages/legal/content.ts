/* Placeholder structure only. Replace each document's sections with the approved text, then set `approved: true` to allow indexing. */

export type LegalSlug =
  | "terms"
  | "betting-rules"
  | "privacy"
  | "responsible-gaming"
  | "self-exclusion"
  | "age-policy"
  | "aml-kyc"
  | "payments"
  | "account-closure"
  | "cookies"
  | "complaints";

export interface LegalSection {
  readonly id: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export interface LegalDocument {
  readonly slug: LegalSlug;
  readonly title: string;
  readonly summary: string;
  readonly approved: boolean;
  readonly lastUpdated?: string;
  readonly sections: readonly LegalSection[];
}

const pending = (topic: string): string => `The approved wording for ${topic} has not been published yet. This section will be replaced with it.`;

export const LEGAL_DOCUMENTS: Readonly<Record<LegalSlug, LegalDocument>> = {
  terms: {
    slug: "terms",
    title: "Terms of use",
    summary: "The terms that will govern use of BETNG.",
    approved: false,
    sections: [
      { id: "definitions", heading: "Definitions", paragraphs: [pending("the terms used throughout this document")] },
      { id: "eligibility", heading: "Eligibility", paragraphs: ["BETNG is for adults aged 18 and over.", pending("residency, restricted territories and who may not open an account")] },
      { id: "accounts", heading: "Account registration and security", paragraphs: [pending("opening an account, one account per person, and keeping credentials secure")] },
      { id: "verification", heading: "Identity verification", paragraphs: [pending("the checks required before betting, depositing or withdrawing")] },
      { id: "deposits", heading: "Deposits", paragraphs: [pending("accepted methods, limits and timing")] },
      { id: "withdrawals", heading: "Withdrawals", paragraphs: [pending("withdrawal requirements, processing and timing")] },
      { id: "bets", heading: "Bet placement and acceptance", paragraphs: [pending("when a bet is accepted and when it may be refused")] },
      { id: "odds", heading: "Odds and market suspension", paragraphs: [pending("odds changes, suspension and obvious pricing errors")] },
      { id: "settlement", heading: "Settlement", paragraphs: [pending("how results are determined and markets settled")] },
      { id: "errors", heading: "Errors and technical failures", paragraphs: [pending("the treatment of errors, outages and void bets")] },
      { id: "responsible", heading: "Responsible gambling", paragraphs: [pending("limits, breaks and self-exclusion, and how to use them")] },
      { id: "restrictions", heading: "Account restrictions and closure", paragraphs: [pending("when an account may be restricted, suspended or closed")] },
      { id: "fraud", heading: "Fraud and financial crime", paragraphs: [pending("prohibited conduct and the consequences")] },
      { id: "complaints", heading: "Complaints", paragraphs: [pending("how disputes are raised and escalated")] },
      { id: "ip", heading: "Intellectual property", paragraphs: [pending("ownership of the platform and its content")] },
      { id: "changes", heading: "Changes to these terms", paragraphs: [pending("how changes are announced and when they take effect")] },
      { id: "law", heading: "Governing law", paragraphs: [pending("the governing law and jurisdiction")] },
      { id: "contact", heading: "Contact", paragraphs: [pending("the operator's contact details")] },
    ],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy notice",
    summary: "How personal data will be collected, used and protected.",
    approved: false,
    sections: [
      { id: "data", heading: "Data we collect", paragraphs: [pending("the personal data collected")] },
      { id: "use", heading: "How it is used", paragraphs: [pending("the purposes and legal bases")] },
      { id: "rights", heading: "Your rights", paragraphs: [pending("access, correction and deletion rights")] },
      { id: "contact", heading: "Contact", paragraphs: [pending("the data protection contact")] },
    ],
  },
  "responsible-gaming": {
    slug: "responsible-gaming",
    title: "Responsible gaming",
    summary: "Tools and support for keeping betting under control.",
    approved: false,
    sections: [
      { id: "tools", heading: "Limits and self-exclusion", paragraphs: [pending("the deposit, loss and time limits and self-exclusion")] },
      { id: "support", heading: "Getting support", paragraphs: [pending("support organisations and how to reach them")] },
      { id: "age", heading: "Age restriction", paragraphs: ["BETNG is for adults aged 18 and over.", pending("age verification")] },
    ],
  },
  "aml-kyc": {
    slug: "aml-kyc",
    title: "AML and KYC policy",
    summary: "How identity is verified and financial crime is prevented.",
    approved: false,
    sections: [
      { id: "verification", heading: "Identity verification", paragraphs: [pending("the identity checks required and when")] },
      { id: "monitoring", heading: "Monitoring", paragraphs: [pending("transaction monitoring")] },
      { id: "records", heading: "Record keeping", paragraphs: [pending("how long records are kept")] },
    ],
  },
  "betting-rules": {
    slug: "betting-rules",
    title: "Betting rules",
    summary: "How bets are accepted, priced and settled.",
    approved: false,
    sections: [
      { id: "general", heading: "General rules", paragraphs: [pending("the rules that apply to every bet")] },
      { id: "prematch", heading: "Pre-match betting", paragraphs: [pending("betting before kick-off and when markets close")] },
      { id: "live", heading: "Live betting", paragraphs: [pending("in-play betting, delays and acceptance")] },
      { id: "suspension", heading: "Market suspension and odds changes", paragraphs: [pending("when a market is suspended and how price changes are handled")] },
      { id: "virtual", heading: "Virtual football", paragraphs: ["Match outcomes on BETNG are produced by the platform's simulation rather than by real-world fixtures.", pending("the result source, the simulation's role and how disputes about a result are handled")] },
      { id: "disrupted", heading: "Abandoned, postponed and cancelled matches", paragraphs: [pending("how each case is settled or voided")] },
      { id: "void", heading: "Void selections", paragraphs: [pending("when a selection is voided and the effect on a multiple")] },
      { id: "multiples", heading: "Multiples and accumulators", paragraphs: [pending("how combined bets are priced and settled")] },
      { id: "settlement", heading: "Settlement and result source", paragraphs: [pending("the authoritative result source and settlement timing")] },
      { id: "disputes", heading: "Disputes", paragraphs: [pending("how a settlement dispute is raised")] },
    ],
  },
  "self-exclusion": {
    slug: "self-exclusion",
    title: "Self-exclusion",
    summary: "Taking a break from betting, and what it means for your account.",
    approved: false,
    sections: [
      { id: "what", heading: "What self-exclusion does", paragraphs: [pending("the restrictions applied and which parts of the account remain available")] },
      { id: "durations", heading: "Durations", paragraphs: [pending("the available periods and how each is applied")] },
      { id: "effect", heading: "When it takes effect", paragraphs: [pending("when the restriction starts and how open bets and balances are treated")] },
      { id: "ending", heading: "When it ends", paragraphs: [pending("what happens at the end of the period and any cooling-off before reinstatement")] },
      { id: "support", heading: "Getting support", paragraphs: [pending("the support organisations available and how to reach them")] },
    ],
  },
  "age-policy": {
    slug: "age-policy",
    title: "Age policy",
    summary: "BETNG is strictly for adults aged 18 and over.",
    approved: false,
    sections: [
      { id: "requirement", heading: "The requirement", paragraphs: ["You must be 18 or over to open an account, deposit or place a bet on BETNG.", pending("the full eligibility statement")] },
      { id: "verification", heading: "How age is verified", paragraphs: [pending("the age verification checks and when they are carried out")] },
      { id: "underage", heading: "Underage accounts", paragraphs: [pending("the action taken where an account holder is found to be underage, and the treatment of stakes and winnings")] },
      { id: "protection", heading: "Protecting minors", paragraphs: [pending("filtering software and shared-device guidance for parents and guardians")] },
    ],
  },
  payments: {
    slug: "payments",
    title: "Payments, withdrawals and refunds",
    summary: "How money moves into and out of a BETNG account.",
    approved: false,
    sections: [
      { id: "deposits", heading: "Deposits", paragraphs: [pending("accepted methods, currency, minimums and when funds become available")] },
      { id: "withdrawals", heading: "Withdrawals", paragraphs: [pending("requirements, destination accounts, processing times and limits")] },
      { id: "fees", heading: "Fees", paragraphs: [pending("any fees charged on deposits or withdrawals")] },
      { id: "verification", heading: "Verification before payout", paragraphs: [pending("the checks required before a withdrawal is released")] },
      { id: "refunds", heading: "Refunds and reversals", paragraphs: [pending("when a payment is refunded or reversed, and how")] },
      { id: "failed", heading: "Failed payments", paragraphs: [pending("what happens when a payment fails and how to resolve it")] },
      { id: "currency", heading: "Currency", paragraphs: [pending("the currency held and any conversion")] },
    ],
  },
  "account-closure": {
    slug: "account-closure",
    title: "Closing your account",
    summary: "How to close an account, and what happens to balances and records.",
    approved: false,
    sections: [
      { id: "how", heading: "How to close your account", paragraphs: [pending("the closure request route and confirmation")] },
      { id: "open-bets", heading: "Open bets", paragraphs: [pending("how bets still running at closure are treated")] },
      { id: "balance", heading: "Remaining balance", paragraphs: [pending("how a remaining balance is returned and any verification required")] },
      { id: "retention", heading: "Records we must keep", paragraphs: [pending("the financial, identity and transaction records retained after closure and the periods required")] },
      { id: "reopening", heading: "Reopening", paragraphs: [pending("whether and how an account may be reopened")] },
    ],
  },
  cookies: {
    slug: "cookies",
    title: "Cookie policy",
    summary: "Which cookies and similar storage BETNG uses.",
    approved: false,
    sections: [
      { id: "essential", heading: "Essential storage", paragraphs: [pending("cookies and storage needed to run the site")] },
      { id: "choices", heading: "Your choices", paragraphs: [pending("how to manage cookie preferences")] },
    ],
  },
  complaints: {
    slug: "complaints",
    title: "Complaints",
    summary: "How to raise a complaint and how it will be handled.",
    approved: false,
    sections: [
      { id: "raise", heading: "Raising a complaint", paragraphs: [pending("how to submit a complaint")] },
      { id: "handling", heading: "How complaints are handled", paragraphs: [pending("response times and escalation")] },
    ],
  },
};

export const LEGAL_LINKS: readonly { readonly slug: LegalSlug; readonly label: string }[] = [
  { slug: "terms", label: "Terms" },
  { slug: "betting-rules", label: "Betting rules" },
  { slug: "privacy", label: "Privacy" },
  { slug: "cookies", label: "Cookies" },
  { slug: "payments", label: "Payments" },
  { slug: "aml-kyc", label: "AML/KYC" },
  { slug: "complaints", label: "Complaints" },
];

/** The responsible-play documents, grouped away from the commercial terms. */
export const RESPONSIBLE_LINKS: readonly { readonly slug: LegalSlug; readonly label: string }[] = [
  { slug: "responsible-gaming", label: "Responsible gaming" },
  { slug: "self-exclusion", label: "Self-exclusion" },
  { slug: "age-policy", label: "18+ age policy" },
  { slug: "account-closure", label: "Closing your account" },
];

export function legalPath(slug: LegalSlug): string {
  return `/legal/${slug}`;
}
