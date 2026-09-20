import { useState } from "react";
import { useNavigate } from "react-router";
import { ConfirmDialog, useToast } from "@betng/ui-web";
import { useBetSlip } from "../../stores/betslip.store";
import { useAuth } from "./useAuth";

export function useLogoutFlow(): { readonly request: () => void; readonly dialog: React.JSX.Element } {
  const { logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const selectionCount = useBetSlip((s) => s.selections.length);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (): Promise<void> => {
    setBusy(true);
    await logout();
    setBusy(false);
    setConfirming(false);
    toast({ tone: "info", title: "You are logged out", message: "Matches, results and tables stay open to browse." });
    void navigate("/");
  };

  return {
    request: () => {
      if (selectionCount > 0) setConfirming(true);
      else void run();
    },
    dialog: (
      <ConfirmDialog
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        onConfirm={run}
        loading={busy}
        title="Log out?"
        confirmLabel="Log out"
        description={`Your bet slip has ${String(selectionCount)} selection${selectionCount === 1 ? "" : "s"}. They stay on this device, but you will need to log in again to place the bet.`}
      />
    ),
  };
}
