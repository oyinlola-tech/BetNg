import { FlaskConical } from "lucide-react";

/** Shown while the display runs on the development stand-in, so its pictures are never mistaken for the platform's. Not focusable. */
export function DevelopmentBanner(): React.JSX.Element {
  return (
    <p
      role="status"
      className="inline-flex shrink-0 items-center gap-[0.5rem] rounded-full border border-warning bg-warning-subtle px-[0.9rem] py-[0.2rem] text-[0.85rem] font-bold text-warning"
    >
      <FlaskConical className="size-[1rem]" aria-hidden />
      Development data · not the BETNG platform
    </p>
  );
}
