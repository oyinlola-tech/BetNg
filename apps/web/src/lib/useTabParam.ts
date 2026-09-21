import { useUrlState } from "./urlState";

/** The active tab lives in `?tab=`; the first tab is the default and leaves the URL clean. */
export function useTabParam<T extends string>(tabs: readonly T[], fallback: T): readonly [T, (next: T) => void] {
  const [params, patch] = useUrlState();
  const raw = params.get("tab");
  const active = tabs.find((tab) => tab === raw) ?? fallback;

  return [
    active,
    (next) => {
      patch({ tab: next === fallback ? undefined : next });
    },
  ];
}
