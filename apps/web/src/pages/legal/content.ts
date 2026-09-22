/* Placeholder structure only. Replace each document's sections with the approved text, then set `approved: true` to allow indexing. */

export type LegalSlug = "terms" | "privacy" | "responsible-gaming" | "aml-kyc" | "cookies" | "complaints";

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
      { id: "scope", heading: "Scope", paragraphs: [pending("who these terms apply to and when")] },
      { id: "accounts", heading: "Accounts", paragraphs: [pending("opening, using and closing an account")] },
      { id: "bets", heading: "Bets and settlement", paragraphs: [pending("how bets are accepted and settled")] },
      { id: "changes", heading: "Changes to these terms", paragraphs: [pending("how changes are announced")] },
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
  { slug: "privacy", label: "Privacy" },
  { slug: "responsible-gaming", label: "Responsible Gaming" },
  { slug: "aml-kyc", label: "AML/KYC" },
  { slug: "cookies", label: "Cookies" },
  { slug: "complaints", label: "Complaints" },
];

export function legalPath(slug: LegalSlug): string {
  return `/legal/${slug}`;
}
