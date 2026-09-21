import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_FLAGS, type FeatureFlag, type FeatureFlags } from "@betng/ui-core";

const FlagsContext = createContext<FeatureFlags>(DEFAULT_FLAGS);

export interface FeatureFlagsProviderProps {
  readonly flags: FeatureFlags;
  readonly children: ReactNode;
}

export function FeatureFlagsProvider({
  flags,
  children,
}: FeatureFlagsProviderProps): React.JSX.Element {
  return <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>;
}

export function useFeatureFlags(): FeatureFlags {
  return useContext(FlagsContext);
}

export function useFlag(flag: FeatureFlag): boolean {
  return useContext(FlagsContext)[flag];
}

export interface FeatureGateProps {
  readonly flag: FeatureFlag;
  readonly fallback?: ReactNode;
  readonly children: ReactNode;
}

export function FeatureGate({
  flag,
  fallback = null,
  children,
}: FeatureGateProps): React.JSX.Element {
  return <>{useFlag(flag) ? children : fallback}</>;
}
