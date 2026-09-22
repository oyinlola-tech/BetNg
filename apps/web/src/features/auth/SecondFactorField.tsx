import { CodeInput, Input } from "@betng/ui-web";
import { BACKUP_CODE_PATTERN, TOTP_PATTERN } from "./schemas";

export type SecondFactorMethod = "TOTP" | "BACKUP_CODE";

export function isCompleteCode(method: SecondFactorMethod, code: string): boolean {
  return method === "TOTP" ? TOTP_PATTERN.test(code) : BACKUP_CODE_PATTERN.test(code.trim());
}

export interface SecondFactorFieldProps {
  readonly method: SecondFactorMethod;
  readonly onMethod?: ((method: SecondFactorMethod) => void) | undefined;
  readonly code: string;
  readonly onCode: (code: string) => void;
  readonly onComplete?: (code: string) => void;
  readonly error?: string | undefined;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
}

/** Authenticator code by default; a backup code when the customer switches, if the platform allows one. */
export function SecondFactorField({ method, onMethod, code, onCode, onComplete, error, disabled = false, autoFocus = false }: SecondFactorFieldProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      {method === "TOTP" ? (
        <CodeInput
          label="Authenticator code"
          length={6}
          value={code}
          onChange={onCode}
          {...(onComplete === undefined ? {} : { onComplete })}
          error={error}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      ) : (
        <Input
          label="Backup code"
          placeholder="ABCD-1234"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={9}
          value={code}
          disabled={disabled}
          autoFocus={autoFocus}
          error={error}
          hint="Each backup code works once."
          onChange={(event) => {
            onCode(event.target.value.toUpperCase());
          }}
        />
      )}
      {onMethod !== undefined && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onCode("");
            onMethod(method === "TOTP" ? "BACKUP_CODE" : "TOTP");
          }}
          className="rounded-xs text-sm font-semibold text-brand hover:underline focus-ring disabled:opacity-45"
        >
          {method === "TOTP" ? "Use a backup code instead" : "Use your authenticator app instead"}
        </button>
      )}
    </div>
  );
}
