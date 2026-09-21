import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { currentCurrency } from "@betng/ui-core";
import { Button, Input, Panel, presentError } from "@betng/ui-web";
import { useOpenShift } from "../../hooks/queries";
import { useOperationKey } from "../../hooks/useOperationKey";
import { errorMessage, parseAmount } from "./money";

export function StartShiftForm(): React.JSX.Element {
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState<string | undefined>();
  const open = useOpenShift();
  const key = useOperationKey();

  const submit = (): void => {
    const openingFloat = parseAmount(text);

    if (openingFloat === undefined) {
      setInvalid("Enter the cash in the drawer, for example 20000.");

      return;
    }

    setInvalid(undefined);
    open.mutate(
      { openingFloat, key: key.current() },
      {
        onSuccess: () => {
          key.renew();
          setText("");
        },
      },
    );
  };

  return (
    <Panel title="Start shift" description="Count the cash in the drawer before your first sale. Every total for the shift is kept by the platform." className="max-w-xl">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <Input
          label="Opening float"
          prefix={currentCurrency().symbol}
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          value={text}
          error={invalid}
          hint="The cash you are starting the shift with."
          onChange={(event) => {
            setText(event.target.value);
            key.renew();
          }}
        />
        {open.isError && (
          <div role="alert" className="rounded-sm border border-danger/30 bg-danger-subtle px-3 py-2 text-sm">
            <p className="font-semibold text-danger">{presentError(open.error).title}</p>
            <p className="text-text-primary">{errorMessage(open.error, presentError(open.error).message)} The shift was not started; submitting again is safe.</p>
          </div>
        )}
        <Button type="submit" size="lg" loading={open.isPending} leadingIcon={<PlayCircle className="size-4" />}>
          {open.isError ? "Try again" : "Start shift"}
        </Button>
      </form>
    </Panel>
  );
}
