import { useState } from "react";
import { Check, Copy, Download, KeyRound } from "lucide-react";
import { Button, Checkbox } from "@betng/ui-web";

export interface BackupCodesPanelProps {
  readonly codes: readonly string[];
  /** Called once the customer confirms they saved the codes; the caller then forgets them. */
  readonly onDone: () => void;
}

function asText(codes: readonly string[]): string {
  return ["BETNG backup codes", "Each code works once. Keep them somewhere safe and private.", "", ...codes, ""].join("\n");
}

/** Shown once, straight after the platform issues the codes. Nothing here is stored or logged. */
export function BackupCodesPanel({ codes, onDone }: BackupCodesPanelProps): React.JSX.Element {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(asText(codes));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = (): void => {
    const url = URL.createObjectURL(new Blob([asText(codes)], { type: "text/plain" }));
    const link = document.createElement("a");

    link.href = url;
    link.download = "betng-backup-codes.txt";
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  };

  return (
    <section aria-labelledby="backup-codes-title" className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning-subtle text-warning">
          <KeyRound className="size-4.5" aria-hidden />
        </span>
        <div>
          <h3 id="backup-codes-title" className="type-h3">
            Save your backup codes
          </h3>
          <p className="type-small mt-0.5 text-text-secondary">If you lose your phone, each code signs you in once. This is the only time they are shown.</p>
        </div>
      </div>
      <ol aria-label="Backup codes" className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface-sunken p-3 font-mono type-data sm:grid-cols-3">
        {codes.map((code) => (
          <li key={code} className="text-center tracking-wider text-text-primary">
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" leadingIcon={copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="secondary" size="sm" leadingIcon={<Download className="size-3.5" aria-hidden />} onClick={download}>
          Download as text
        </Button>
      </div>
      <Checkbox
        label="I have saved these codes somewhere safe"
        checked={saved}
        onChange={(event) => {
          setSaved(event.target.checked);
        }}
      />
      <Button disabled={!saved} onClick={onDone}>
        Done
      </Button>
    </section>
  );
}
