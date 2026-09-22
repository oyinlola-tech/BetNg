import { useState } from "react";
import { View } from "react-native";
import type { BankAccount, BankAccountVerification } from "@betng/contracts";
import { Button, ErrorState, SkeletonRows, Text, TextField } from "../../components";
import { useAsync } from "../../hooks/useAsync";
import { presentError } from "../../lib/errors";
import { getAccountServices } from "../../services/dataSource";
import { Choice } from "./SheetFrame";

/** The account name always comes from the platform's name enquiry, never from what the customer typed. */
export function AddBankAccount({ onSaved }: { readonly onSaved: (account: BankAccount) => void }): React.JSX.Element {
  const banks = useAsync(() => getAccountServices().payments.listBanks(), []);
  const [bankCode, setBankCode] = useState<string | undefined>(undefined);
  const [number, setNumber] = useState("");
  const [verification, setVerification] = useState<BankAccountVerification | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const valid = bankCode !== undefined && /^\d{10}$/.test(number);

  const run = async (work: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(undefined);

    try {
      await work();
    } catch (cause) {
      setError(presentError(cause).message);
    } finally {
      setBusy(false);
    }
  };

  if (banks.data === undefined) {
    return banks.error === undefined ? <SkeletonRows rows={3} /> : <ErrorState error={banks.error} onRetry={() => void banks.refresh()} />;
  }

  if (verification !== undefined) {
    return (
      <View style={{ gap: 10 }}>
        <Text variant="caption" tone="muted">
          Account name from the bank
        </Text>
        <Text variant="bodyStrong">{verification.accountName}</Text>
        <Text variant="caption" tone="secondary">
          {verification.accountNumberMasked}
        </Text>
        {error !== undefined && (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        )}
        <Button
          label="Save this account"
          loading={busy}
          onPress={() =>
            void run(async () => {
              onSaved(await getAccountServices().payments.saveBankAccount(verification.verificationId, true));
            })
          }
        />
        <Button label="Use a different account" variant="ghost" onPress={() => { setVerification(undefined); }} />
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <Text variant="caption" tone="secondary">
        Choose your bank
      </Text>
      <View accessibilityRole="radiogroup" style={{ gap: 6 }}>
        {banks.data.map((bank) => (
          <Choice key={bank.code} label={bank.name} selected={bankCode === bank.code} onPress={() => { setBankCode(bank.code); }} />
        ))}
      </View>
      <TextField
        label="Account number"
        value={number}
        onChangeText={(value) => { setNumber(value.replace(/\D/g, "").slice(0, 10)); }}
        keyboardType="number-pad"
        maxLength={10}
        hint="10-digit NUBAN"
      />
      {error !== undefined && (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      )}
      <Button
        label="Verify account"
        variant="secondary"
        loading={busy}
        disabled={!valid}
        onPress={() =>
          void run(async () => {
            if (bankCode === undefined) return;

            setVerification(await getAccountServices().payments.verifyBankAccount({ bankCode, accountNumber: number }));
          })
        }
      />
    </View>
  );
}
