/**
 * The TV client's root component.
 */

import { BroadcastLayout } from "./layouts/index";
import { resolveRoute } from "./routes/index";

export function App(): React.JSX.Element {
  return <BroadcastLayout>{resolveRoute(window.location.search)}</BroadcastLayout>;
}
