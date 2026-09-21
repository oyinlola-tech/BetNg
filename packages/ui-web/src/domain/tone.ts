import type { StateTone } from "@betng/design-tokens";

export const TONE_SUBTLE: Readonly<Record<StateTone, string>> = {
  live: "bg-live-subtle text-live",
  brand: "bg-brand-subtle text-brand",
  neutral: "bg-surface-sunken text-text-secondary",
  muted: "bg-surface-sunken text-text-muted",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
  pending: "bg-pending-subtle text-pending",
  void: "bg-void-subtle text-void",
  suspended: "bg-suspended-subtle text-suspended",
};

export const TONE_SOLID: Readonly<Record<StateTone, string>> = {
  live: "bg-live text-text-on-live",
  brand: "bg-brand text-text-on-brand",
  neutral: "bg-text-secondary text-background",
  muted: "bg-text-muted text-background",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  danger: "bg-danger text-white",
  info: "bg-info text-white",
  pending: "bg-pending text-white",
  void: "bg-void text-white",
  suspended: "bg-suspended text-white",
};

export const TONE_TEXT: Readonly<Record<StateTone, string>> = {
  live: "text-live",
  brand: "text-brand",
  neutral: "text-text-secondary",
  muted: "text-text-muted",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  pending: "text-pending",
  void: "text-void",
  suspended: "text-suspended",
};
