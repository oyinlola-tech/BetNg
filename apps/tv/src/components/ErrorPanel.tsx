import { TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn";

export function ErrorPanel({ title = "This screen could not be loaded", detail = "The display keeps retrying and will recover on its own.", className }: { readonly title?: string; readonly detail?: string; readonly className?: string }): React.JSX.Element {
  return (
    <div role="alert" className={cn("flex h-full min-h-[12rem] flex-col items-center justify-center gap-[0.6rem] text-center", className)}>
      <TriangleAlert className="size-[2.4rem] text-warning" aria-hidden />
      <p className="font-display text-[1.8rem] font-bold">{title}</p>
      <p className="text-[1.05rem] text-text-muted">{detail}</p>
    </div>
  );
}
