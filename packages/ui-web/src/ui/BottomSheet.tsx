import { Sheet } from "./Sheet";
import type { SheetProps } from "./Sheet";

export type BottomSheetProps = Omit<SheetProps, "side">;

export function BottomSheet(props: BottomSheetProps): React.JSX.Element | null {
  return <Sheet {...props} side="bottom" />;
}
