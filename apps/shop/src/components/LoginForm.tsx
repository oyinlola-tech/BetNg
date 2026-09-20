import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogIn, WifiOff } from "lucide-react";
import { DataSourceError } from "@betng/ui-core";
import { Button, CodeInput, Input, PasswordInput, presentError } from "@betng/ui-web";
import { isMock } from "../configs/app.config";
import { shopSource } from "../services/dataSource";

/* Mirrors `shopLoginRequestSchema`; the terminal always asks for the PIN, which the contract leaves optional. */
const schema = z.object({
  shopCode: z.string().trim().min(3, "Enter the shop code.").max(20),
  username: z.string().trim().min(2, "Enter your username.").max(40),
  password: z.string().min(1, "Enter your password.").max(128),
  pin: z.string().regex(/^\d{4,6}$/, "Enter your 4-digit PIN."),
});

type Values = z.infer<typeof schema>;

export interface LoginFormProps {
  /** Locks the identity fields when re-authenticating an expired session. */
  readonly fixed?: { readonly shopCode: string; readonly username: string };
  readonly submitLabel?: string;
  readonly onSuccess?: () => void;
}

export function LoginForm({ fixed, submitLabel = "Sign in", onSuccess }: LoginFormProps): React.JSX.Element {
  const [failure, setFailure] = useState<unknown>();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { shopCode: fixed?.shopCode ?? "", username: fixed?.username ?? "", password: "", pin: "" } });

  const submit = handleSubmit(async (values) => {
    setFailure(undefined);

    try {
      await shopSource.login({ shopCode: values.shopCode.toUpperCase(), username: values.username.toLowerCase(), password: values.password, pin: values.pin });
      onSuccess?.();
    } catch (error) {
      setFailure(error);
      setValue("pin", "");

      if (error instanceof DataSourceError && error.code === "INVALID_CREDENTIALS") setFocus("password");
    }
  });

  const presented = failure === undefined ? undefined : presentError(failure);
  const offline = failure instanceof DataSourceError && failure.code === "NETWORK";

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Shop code" placeholder="BNG-LAG-001" autoCapitalize="characters" autoComplete="organization" spellCheck={false} readOnly={fixed !== undefined} autoFocus={fixed === undefined} error={errors.shopCode?.message} className="uppercase" {...register("shopCode")} />
        <Input label="Username" autoComplete="username" spellCheck={false} readOnly={fixed !== undefined} error={errors.username?.message} {...register("username")} />
      </div>
      <PasswordInput label="Password" autoComplete="current-password" autoFocus={fixed !== undefined} error={errors.password?.message} {...register("password")} />
      <Controller control={control} name="pin" render={({ field }) => <CodeInput label="Cashier PIN" length={4} masked value={field.value} onChange={field.onChange} error={errors.pin?.message} disabled={isSubmitting} />} />

      {presented !== undefined && (
        <div role="alert" className="flex items-start gap-2.5 rounded-sm border border-danger/30 bg-danger-subtle px-3 py-2.5 text-sm">
          {offline && <WifiOff className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
          <p className="text-text-primary">
            <span className="font-semibold text-danger">{presented.title}.</span> {failure instanceof DataSourceError && failure.code === "FORBIDDEN" ? failure.message : presented.message}
          </p>
        </div>
      )}

      <Button type="submit" size="lg" full loading={isSubmitting} icon={<LogIn className="size-4" />}>
        {isSubmitting ? "Signing in" : submitLabel}
      </Button>

      {isMock && fixed === undefined && (
        <div className="rounded-sm border border-dashed border-border-strong px-3 py-2.5 text-sm text-text-secondary">
          <p className="caps-label mb-1">Demo shop</p>
          <p>
            Shop <code className="font-mono text-text-primary">BNG-LAG-001</code> · password <code className="font-mono text-text-primary">betng-demo</code> · PIN <code className="font-mono text-text-primary">1234</code>
          </p>
          <p className="mt-0.5 text-text-muted">
            Users: <code className="font-mono">ada</code> (owner), <code className="font-mono">tunde</code> (manager), <code className="font-mono">bisi</code> (cashier), <code className="font-mono">kunle</code> (suspended)
          </p>
        </div>
      )}
    </form>
  );
}
