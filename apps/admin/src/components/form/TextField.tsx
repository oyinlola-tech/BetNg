import { forwardRef } from "react";
import { currentCurrency } from "@betng/ui-core";
import { Field, Input } from "@betng/ui-web";

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly prefix?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({ label, hint, error, required, className, prefix, ...input }, ref) {
  return (
    <Field label={label} error={error} required={required === true} {...(hint === undefined ? {} : { hint })} {...(className === undefined ? {} : { className })}>
      {(control) => <Input ref={ref} {...input} {...control} {...(prefix === undefined ? {} : { prefix })} {...(error === undefined ? {} : { className: "[&>div]:border-danger" })} />}
    </Field>
  );
});

/** An amount typed in major units. The form keeps the text; the schema turns it into minor units with `parseMoney`. */
export const MoneyField = forwardRef<HTMLInputElement, Omit<TextFieldProps, "prefix" | "type" | "inputMode">>(function MoneyField(props, ref) {
  return <TextField ref={ref} {...props} type="text" inputMode="decimal" autoComplete="off" prefix={currentCurrency().symbol} />;
});
