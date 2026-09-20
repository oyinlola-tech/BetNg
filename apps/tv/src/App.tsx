import { RouterProvider } from "react-router";
import { router } from "./routes";

export function App(): React.JSX.Element {
  return <RouterProvider router={router} />;
}
