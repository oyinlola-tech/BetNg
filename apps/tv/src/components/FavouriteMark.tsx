import { Star } from "lucide-react";
import { cn } from "../lib/cn";

export function FavouriteMark({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <span className={cn("inline-flex items-center text-warning", className)}>
      <Star className="size-[1em] fill-current" aria-hidden />
      <span className="sr-only">Following</span>
    </span>
  );
}
