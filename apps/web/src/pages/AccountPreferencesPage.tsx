import { Card, Field, SectionHeading, ThemeSwitcher } from "@betng/ui-web";
import { formatDateTime } from "@betng/ui-core";
import { DATE_LOCALES, useDisplayPreferences, type DateLocale } from "../features/account/displayPreferences";
import { usePageMeta } from "../features/seo";

const SELECT =
  "h-10 w-full rounded-sm border border-border bg-surface-sunken px-3 text-base text-text-primary focus-ring sm:max-w-xs";

export function AccountPreferencesPage(): React.JSX.Element {
  usePageMeta({ title: "Preferences", noindex: true });

  const dateLocale = useDisplayPreferences((s) => s.dateLocale);
  const setDateLocale = useDisplayPreferences((s) => s.setDateLocale);

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading as="h2">Appearance</SectionHeading>
        <p className="type-small mt-2 text-text-muted">Light, dark, or follow this device.</p>
        <ThemeSwitcher showLabels className="mt-3" />
      </Card>
      <Card>
        <SectionHeading as="h2">Dates and times</SectionHeading>
        <Field label="Date format" hint={`Example: ${formatDateTime("2026-01-31T18:30:00Z")}`} className="mt-3">
          {(control) => (
            <select
              {...control}
              value={dateLocale}
              onChange={(event) => {
                setDateLocale(event.target.value as DateLocale);
              }}
              className={SELECT}
            >
              {DATE_LOCALES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <p className="type-small mt-3 text-text-muted">Prices are shown as decimal odds, the format the platform quotes. Amounts use the platform's currency.</p>
      </Card>
      <p className="type-small text-text-muted">Preferences are stored on this device only.</p>
    </div>
  );
}
