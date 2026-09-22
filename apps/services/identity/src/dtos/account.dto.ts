// Mappers for the account, KYC and responsible-gaming answers. None reads a secret, a hash, a ciphertext or a storage key.

import type {
  AccountDeletion,
  AccountSession,
  KycDocument,
  LimitHistoryEntry,
  LimitKind,
  PushDevice,
  ResponsibleGamingLimit,
  SelfExclusion,
  SelfExclusionPeriod,
} from "@betng/contracts";
import type {
  AccountDeletion as DeletionRow,
  KycDocument as KycDocumentRow,
  LimitHistory as LimitHistoryRow,
  PushDevice as PushDeviceRow,
  ResponsibleGamingLimit as LimitRow,
  SelfExclusion as SelfExclusionRow,
  Session as SessionRow,
} from "../generated/prisma/client.js";

const iso = (date: Date): string => date.toISOString();

const optionalIso = <K extends string>(key: K, date: Date | null | undefined): Partial<Record<K, string>> =>
  date === null || date === undefined ? {} : ({ [key]: date.toISOString() } as Record<K, string>);

export function toAccountSession(row: SessionRow, currentId: string | undefined): AccountSession {
  return {
    id: row.id,
    current: row.id === currentId,
    ...(row.device === null ? {} : { device: row.device }),
    ...(row.browser === null ? {} : { browser: row.browser }),
    ...(row.platform === null ? {} : { platform: row.platform }),
    createdAt: iso(row.createdAt),
    lastActiveAt: iso(row.lastSeenAt),
    expiresAt: iso(row.expiresAt),
  };
}

export function toAccountDeletion(row: DeletionRow | undefined, blockers: readonly string[]): AccountDeletion {
  const shown = blockers.length === 0 ? {} : { blockers: [...blockers] };

  if (row === undefined) {
    return { status: "NONE", cancellable: false, ...shown };
  }

  return {
    status: row.status,
    requestedAt: iso(row.requestedAt),
    ...(row.status === "PENDING" ? { scheduledFor: iso(row.scheduledFor) } : {}),
    cancellable: row.status === "PENDING",
    ...(row.status === "PENDING" ? shown : {}),
  };
}

export function toPushDevice(row: PushDeviceRow, currentSessionId: string | undefined): PushDevice {
  return {
    id: row.id,
    platform: row.platform,
    label: row.label,
    current: currentSessionId !== undefined && row.sessionId === currentSessionId,
    registeredAt: iso(row.registeredAt),
    ...optionalIso("lastSeenAt", row.lastSeenAt),
  };
}

export function toKycDocument(row: KycDocumentRow): KycDocument {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    uploadedAt: iso(row.uploadedAt),
    ...optionalIso("reviewedAt", row.reviewedAt),
    ...(row.rejectionReason === null ? {} : { rejectionReason: row.rejectionReason.slice(0, 200) }),
  };
}

export function toLimit(row: LimitRow, usage: { readonly used: number; readonly resetsAt: Date | undefined } | undefined): ResponsibleGamingLimit {
  const status = row.removalEffectiveAt !== null ? "requested" : row.pendingValue !== null ? "pending" : "active";

  return {
    kind: row.kind as LimitKind,
    status,
    value: Number(row.value),
    ...(usage === undefined ? {} : { used: usage.used }),
    ...optionalIso("resetsAt", usage?.resetsAt),
    effectiveAt: iso(row.effectiveAt),
    ...(row.pendingValue === null ? {} : { pendingValue: Number(row.pendingValue) }),
    ...optionalIso("pendingEffectiveAt", row.removalEffectiveAt ?? row.pendingEffectiveAt),
  };
}

export function toSelfExclusion(row: SelfExclusionRow | undefined): SelfExclusion {
  if (row === undefined) {
    return { active: false };
  }

  return {
    active: true,
    period: row.period as SelfExclusionPeriod,
    startedAt: iso(row.startedAt),
    ...optionalIso("endsAt", row.endsAt),
    ...optionalIso("canCancelAt", row.canCancelAt),
  };
}

export function toLimitHistoryEntry(row: LimitHistoryRow): LimitHistoryEntry {
  return {
    id: row.id,
    kind: row.kind as LimitHistoryEntry["kind"],
    action: row.action as LimitHistoryEntry["action"],
    ...(row.previousValue === null ? {} : { previousValue: Number(row.previousValue) }),
    ...(row.value === null ? {} : { value: Number(row.value) }),
    at: iso(row.at),
  };
}
