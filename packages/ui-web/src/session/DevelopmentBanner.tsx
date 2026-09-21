import { FlaskConical } from "lucide-react";

/** Always visible while an app runs on the development stand-in, so its data is never mistaken for the platform's. */
export function DevelopmentBanner({ label = "Development data" }: { readonly label?: string }): React.JSX.Element {
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-warning/40 bg-warning-subtle px-4 py-1 text-center type-caption font-semibold text-warning">
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>{label}: this app is running on the local stand-in, not the BETNG platform. Nothing here is real.</span>
    </div>
  );
}
