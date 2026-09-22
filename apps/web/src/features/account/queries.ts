import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountDeletion, ChannelPreferences, TwoFactorStatus } from "@betng/contracts";
import { DataSourceError } from "@betng/ui-core";
import { useSession } from "@betng/ui-web";
import { accountServices, session } from "../../services/runtime";

/* Every key starts with "account", which lib/queryClient treats as private and drops on sign-out or expiry. */
export const accountKeys = {
  twoFactor: ["account", "two-factor"] as const,
  sessions: ["account", "sessions"] as const,
  deletion: ["account", "deletion"] as const,
  channels: ["account", "channels"] as const,
  pushDevices: ["account", "push-devices"] as const,
};

export function isNotImplemented(error: unknown): boolean {
  return error instanceof DataSourceError && error.code === "NOT_IMPLEMENTED";
}

function useSignedIn(): boolean {
  return useSession(session).status === "AUTHENTICATED";
}

export function useTwoFactorStatus(enabled: boolean) {
  const signedIn = useSignedIn();

  return useQuery({ queryKey: accountKeys.twoFactor, queryFn: () => accountServices.security.getTwoFactor(), enabled: signedIn && enabled, staleTime: 30_000 });
}

export function useAccountSessions(enabled: boolean) {
  const signedIn = useSignedIn();

  return useQuery({ queryKey: accountKeys.sessions, queryFn: () => accountServices.security.listSessions(), enabled: signedIn && enabled, staleTime: 15_000 });
}

export function useRevokeSession() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => accountServices.security.revokeSession(id),
    onSettled: () => client.invalidateQueries({ queryKey: accountKeys.sessions }),
  });
}

export function useRevokeOtherSessions() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: () => accountServices.security.revokeOtherSessions(),
    onSettled: () => client.invalidateQueries({ queryKey: accountKeys.sessions }),
  });
}

export function useDeletion(enabled: boolean) {
  const signedIn = useSignedIn();

  return useQuery({ queryKey: accountKeys.deletion, queryFn: () => accountServices.security.getDeletion(), enabled: signedIn && enabled, staleTime: 15_000 });
}

export function useSetDeletion() {
  const client = useQueryClient();

  return (next: AccountDeletion): void => {
    client.setQueryData(accountKeys.deletion, next);
  };
}

export function useChannelPreferences(enabled: boolean) {
  const signedIn = useSignedIn();

  return useQuery({ queryKey: accountKeys.channels, queryFn: () => accountServices.devices.getChannelPreferences(), enabled: signedIn && enabled, staleTime: 60_000 });
}

export function useSetChannelPreferences() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (channels: ChannelPreferences["channels"]) => accountServices.devices.setChannelPreferences(channels),
    onSuccess: (saved) => {
      client.setQueryData(accountKeys.channels, saved);
    },
    onError: () => client.invalidateQueries({ queryKey: accountKeys.channels }),
  });
}

export function usePushDevices(enabled: boolean) {
  const signedIn = useSignedIn();

  return useQuery({ queryKey: accountKeys.pushDevices, queryFn: () => accountServices.devices.listPushDevices(), enabled: signedIn && enabled, staleTime: 30_000 });
}

export function useUnregisterPushDevice() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => accountServices.devices.unregisterPushDevice(id),
    onSettled: () => client.invalidateQueries({ queryKey: accountKeys.pushDevices }),
  });
}

export function useSetTwoFactorStatus() {
  const client = useQueryClient();

  return (next?: TwoFactorStatus): void => {
    if (next !== undefined) client.setQueryData(accountKeys.twoFactor, next);
    void client.invalidateQueries({ queryKey: accountKeys.twoFactor });
  };
}
