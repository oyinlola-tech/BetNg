import { formatMoney } from "@betng/ui-core";
import { Button } from "@betng/ui-web";

export const AMOUNT_PRESETS: readonly number[] = [100_000, 500_000, 1_000_000, 2_500_000];

export function AmountPresets({ onPick, disabled = false, presets = AMOUNT_PRESETS }: { readonly onPick: (minorUnits: number) => void; readonly disabled?: boolean; readonly presets?: readonly number[] }): React.JSX.Element {
  return (
    <div role="group" aria-label="Quick amounts" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {presets.map((preset) => (
        <Button
          key={preset}
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => {
            onPick(preset);
          }}
        >
          {formatMoney(preset, { fraction: "never" })}
        </Button>
      ))}
    </div>
  );
}
