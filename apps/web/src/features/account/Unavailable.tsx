import { CircleSlash } from "lucide-react";
import { EmptyState } from "@betng/ui-web";

export function Unavailable({ title, description, action }: { readonly title: string; readonly description: string; readonly action?: React.ReactNode }): React.JSX.Element {
  return <EmptyState compact icon={<CircleSlash className="size-5" />} title={title} description={description} {...(action === undefined ? {} : { action })} />;
}
