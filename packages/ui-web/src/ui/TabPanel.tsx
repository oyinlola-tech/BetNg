import { cn } from "../lib/cn";
import { tabId, tabPanelId } from "./tabIds";

export interface TabPanelProps<T extends string> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "id" | "role"
> {
  /** The same `id` given to the `Tabs` this panel belongs to. */
  readonly tabsId: string;
  readonly value: T;
  readonly active: T;
  /** Keeps an inactive panel mounted (hidden) so its state survives tab changes. */
  readonly keepMounted?: boolean;
}

export function TabPanel<T extends string>({
  tabsId,
  value,
  active,
  keepMounted = false,
  className,
  children,
  ...rest
}: TabPanelProps<T>): React.JSX.Element | null {
  const selected = value === active;

  if (!selected && !keepMounted) return null;

  return (
    <div
      id={tabPanelId(tabsId, value)}
      role="tabpanel"
      aria-labelledby={tabId(tabsId, value)}
      hidden={!selected}
      tabIndex={0}
      className={cn("rounded-sm focus-ring", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
