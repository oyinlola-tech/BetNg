import { useEffect } from "react";
import { useBlocker } from "react-router";

export interface UnsavedChangesGuard {
  /** True while an in-app navigation is held back; render a confirmation then. */
  readonly blocked: boolean;
  readonly proceed: () => void;
  readonly stay: () => void;
}

/** Guards against losing edits: the browser's own prompt on unload, and a held navigation inside the app. Needs a data router. */
export function useUnsavedChangesGuard(dirty: boolean): UnsavedChangesGuard {
  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty]);

  useEffect(() => {
    if (!dirty && blocker.state === "blocked") blocker.reset();
  }, [dirty, blocker]);

  return {
    blocked: blocker.state === "blocked",
    proceed: () => {
      if (blocker.state === "blocked") blocker.proceed();
    },
    stay: () => {
      if (blocker.state === "blocked") blocker.reset();
    },
  };
}
