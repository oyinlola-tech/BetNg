import { cn } from "@betng/ui-web";

export function Kbd({ children, className }: { readonly children: React.ReactNode; readonly className?: string }): React.JSX.Element {
  return <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border-strong bg-surface-sunken px-1 font-mono text-[10px] font-semibold text-text-secondary", className)}>{children}</kbd>;
}
