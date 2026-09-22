import { Link } from "react-router";
import { FileWarning } from "lucide-react";
import { formatShortDate } from "@betng/ui-core";
import { SectionHeading } from "@betng/ui-web";
import { usePageMeta } from "../../features/seo";
import { LEGAL_DOCUMENTS, LEGAL_LINKS, legalPath, type LegalSlug } from "./content";

export function LegalPage({ slug }: { readonly slug: LegalSlug }): React.JSX.Element {
  const doc = LEGAL_DOCUMENTS[slug];

  usePageMeta({ title: doc.title, description: doc.summary, noindex: !doc.approved });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label="Legal documents" className="order-2 lg:order-1">
        <p className="type-caption">Legal</p>
        <ul className="mt-2 space-y-0.5">
          {LEGAL_LINKS.map((link) => (
            <li key={link.slug}>
              <Link
                to={legalPath(link.slug)}
                aria-current={link.slug === slug ? "page" : undefined}
                className="flex min-h-9 items-center rounded-sm px-2 text-base text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-ring aria-[current=page]:bg-surface aria-[current=page]:font-semibold aria-[current=page]:text-text-primary"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="order-1 min-w-0 lg:order-2">
        <h1 className="type-h1">{doc.title}</h1>
        <p className="mt-1 text-base text-text-secondary">{doc.summary}</p>
        {!doc.approved && (
          <div role="note" className="mt-4 flex items-start gap-2 rounded-sm border border-warning/40 bg-warning-subtle px-3 py-2 text-sm text-text-primary">
            <FileWarning className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <p>
              <span className="font-semibold">Placeholder — pending approved legal text.</span> Nothing on this page is a binding statement yet.
            </p>
          </div>
        )}
        {doc.lastUpdated !== undefined && <p className="type-small mt-3 text-text-muted">Last updated {formatShortDate(doc.lastUpdated)}</p>}
        <div className="mt-8 space-y-8">
          {doc.sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-32">
              <SectionHeading as="h2" id={`${section.id}-title`}>
                {section.heading}
              </SectionHeading>
              <div className="mt-3 max-w-2xl space-y-3 text-md text-text-secondary">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
