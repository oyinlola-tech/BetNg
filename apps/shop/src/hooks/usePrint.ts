import { useCallback, useState } from "react";
import { useToast } from "@betng/ui-web";
import { printReceipt, type ReceiptJob } from "../services/printing";

export function usePrintReceipt(): { readonly print: (job: ReceiptJob) => void; readonly printing: boolean } {
  const { toast } = useToast();
  const [printing, setPrinting] = useState(false);

  const print = useCallback(
    (job: ReceiptJob) => {
      setPrinting(true);
      printReceipt(job)
        .catch((cause: unknown) => {
          toast({ tone: "danger", title: "Could not print", message: cause instanceof Error ? cause.message : "The printer did not accept the receipt." });
        })
        .finally(() => {
          setPrinting(false);
        });
    },
    [toast],
  );

  return { print, printing };
}
