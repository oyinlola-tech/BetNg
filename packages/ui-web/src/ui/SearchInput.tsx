import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../lib/cn";

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput({ value, onChange, label, className, placeholder, ...rest }, ref) {
  return (
    <div role="search" className={cn("flex h-9 items-center gap-2 rounded-sm border border-border bg-surface-sunken px-2.5 transition-colors focus-within:border-brand", className)}>
      <Search className="size-4 shrink-0 text-text-muted" aria-hidden />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-full w-full min-w-0 bg-transparent text-base text-text-primary outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden"
        {...rest}
      />
      {value !== "" && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
          }}
          className="rounded-xs text-text-muted hover:text-text-primary focus-ring"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
});
