import { useNavigate } from "react-router";
import type { ShopPermission } from "@betng/contracts";
import { Button, Panel, PermissionDenied } from "@betng/ui-web";
import { useShopSession } from "../hooks/useShopSession";

/** Hides a screen the role cannot use. The platform still refuses the request; this only spares the cashier a dead end. */
export function Guard({ permission, children }: { readonly permission: ShopPermission; readonly children: React.ReactNode }): React.JSX.Element {
  const { can } = useShopSession();
  const navigate = useNavigate();

  if (can(permission)) return <>{children}</>;

  return (
    <Panel className="mx-auto mt-10 max-w-lg">
      <PermissionDenied
        permission={permission}
        action={
          <Button variant="secondary" size="sm" onClick={() => void navigate("/")}>
            Back to dashboard
          </Button>
        }
      />
    </Panel>
  );
}
