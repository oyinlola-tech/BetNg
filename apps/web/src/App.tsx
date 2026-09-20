/**
 * The web client's root component.
 */

import { AppLayout } from "./layouts/index";
import { resolveRoute } from "./routes/index";

export function App(): React.JSX.Element {
  return <AppLayout>{resolveRoute(window.location.pathname)}</AppLayout>;
}
