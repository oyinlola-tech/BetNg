import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useToast } from "@betng/ui-web";
import { applyUpdate, onNotificationNavigate, usePwa } from "../../pwa/pwa";

/** Offers the waiting version once, and routes notification clicks inside the open app. */
export function useAppUpdates(): void {
  const { updateReady } = usePwa();
  const { toast, dismiss } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    onNotificationNavigate((path) => {
      void navigate(path);
    });

    return () => {
      onNotificationNavigate(undefined);
    };
  }, [navigate]);

  useEffect(() => {
    if (!updateReady) return;

    const id = toast({
      tone: "system",
      title: "New version available",
      message: "Reload to update. Your bet slip stays on this device.",
      duration: 0,
      action: { label: "Reload", onSelect: applyUpdate },
    });

    return () => {
      dismiss(id);
    };
  }, [updateReady, toast, dismiss]);
}
