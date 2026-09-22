import { useState } from "react";
import { View } from "react-native";
import type { CustomerProfile } from "@betng/contracts";
import { Button, Text, TextField, useToast } from "../../components";
import { useCanTransact } from "../../hooks/useConnectivity";
import { presentError } from "../../lib/errors";
import { profileChange, type ProfileDraft } from "../../lib/profile";
import { getAccountServices } from "../../services/dataSource";

export function EditProfile({ user, onDone }: { readonly user: CustomerProfile; readonly onDone: () => void }): React.JSX.Element {
  const { toast } = useToast();
  const online = useCanTransact();
  const [draft, setDraft] = useState<ProfileDraft>({ displayName: user.displayName, phone: user.phone ?? "" });
  const [problem, setProblem] = useState<{ readonly field?: keyof ProfileDraft; readonly message: string } | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const edit = (field: keyof ProfileDraft) => (value: string): void => {
    setDraft((d) => ({ ...d, [field]: value }));
    setProblem(undefined);
  };

  const save = async (): Promise<void> => {
    const change = profileChange(user, draft);

    if (!change.ok) {
      setProblem(change);
      return;
    }

    setBusy(true);

    try {
      await getAccountServices().profile.update(change.request);
      toast("Profile updated", "success");
      onDone();
    } catch (cause) {
      setProblem({ message: presentError(cause).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12, marginTop: 14 }}>
      <TextField
        label="Display name"
        value={draft.displayName}
        onChangeText={edit("displayName")}
        autoComplete="name"
        maxLength={60}
        error={problem?.field === "displayName" ? problem.message : undefined}
      />
      <TextField
        label="Phone"
        value={draft.phone}
        onChangeText={edit("phone")}
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={20}
        hint="Include the country code, for example +234"
        error={problem?.field === "phone" ? problem.message : undefined}
      />
      <Text variant="caption" tone="muted">
        Your email address is changed through its own verified flow.
      </Text>
      {problem !== undefined && problem.field === undefined && (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {problem.message}
        </Text>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Cancel" variant="ghost" onPress={onDone} style={{ flex: 1 }} />
        <Button label="Save" loading={busy} disabled={!online} onPress={() => void save()} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
