export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export const FOCUSABLE = "[data-tv-focusable]";
const AUTOFOCUS = "[data-tv-autofocus]";

interface Candidate {
  readonly element: HTMLElement;
  readonly rect: DOMRect;
}

function visible(el: HTMLElement): boolean {
  if (
    el.getAttribute("aria-disabled") === "true" ||
    (el as HTMLButtonElement).disabled
  )
    return false;

  const rect = el.getBoundingClientRect();

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.top < window.innerHeight
  );
}

function candidates(root: ParentNode): Candidate[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter(visible)
    .map((element) => ({ element, rect: element.getBoundingClientRect() }));
}

function center(rect: DOMRect): { readonly x: number; readonly y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Distance in the travel direction, weighted so off-axis drift costs more than forward travel. */
function score(
  from: DOMRect,
  to: DOMRect,
  direction: Direction,
): number | undefined {
  const a = center(from);
  const b = center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  let forward: number;
  let lateral: number;

  switch (direction) {
    case "UP":
      forward = -dy;
      lateral = Math.abs(dx);
      break;
    case "DOWN":
      forward = dy;
      lateral = Math.abs(dx);
      break;
    case "LEFT":
      forward = -dx;
      lateral = Math.abs(dy);
      break;
    case "RIGHT":
      forward = dx;
      lateral = Math.abs(dy);
      break;
  }

  if (forward <= 1) return undefined;

  const overlaps =
    direction === "UP" || direction === "DOWN"
      ? to.right > from.left && to.left < from.right
      : to.bottom > from.top && to.top < from.bottom;

  return forward + lateral * (overlaps ? 0.6 : 2.5);
}

function autofocusTarget(root: ParentNode = document): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>(AUTOFOCUS)].find(
    (el) => el.matches(FOCUSABLE) && visible(el),
  );
}

export function nearestFocusable(
  to: DOMRect,
  root: ParentNode = document,
): HTMLElement | undefined {
  const target = center(to);
  let best: { readonly element: HTMLElement; readonly distance: number } | undefined;

  for (const c of candidates(root)) {
    const at = center(c.rect);
    const distance = Math.hypot(at.x - target.x, at.y - target.y);

    if (best === undefined || distance < best.distance)
      best = { element: c.element, distance };
  }

  return best?.element;
}

export function nextFocusable(
  current: HTMLElement | null,
  direction: Direction,
  root: ParentNode = document,
): HTMLElement | undefined {
  if (current === null || !current.isConnected || !current.matches(FOCUSABLE))
    return autofocusTarget(root) ?? candidates(root)[0]?.element;

  const from = current.getBoundingClientRect();
  let best:
    { readonly element: HTMLElement; readonly score: number } | undefined;

  for (const c of candidates(root)) {
    if (c.element === current) continue;

    const s = score(from, c.rect, direction);

    if (s !== undefined && (best === undefined || s < best.score))
      best = { element: c.element, score: s };
  }

  return best?.element;
}

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
};

const BACK_KEYS = new Set(["Escape", "Backspace", "GoBack", "BrowserBack"]);

function isEditable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)
    return true;

  return (
    el instanceof HTMLInputElement &&
    !["button", "checkbox", "radio", "submit", "reset", "range", "color", "file", "image"].includes(el.type)
  );
}

function focusElement(el: HTMLElement): void {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

export interface RemoteHandlers {
  readonly onBack?: () => void;
  readonly onSelect?: (element: HTMLElement) => void;
}

export function installRemote(handlers: RemoteHandlers): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

    const direction = KEY_TO_DIRECTION[event.key];
    const active = document.activeElement as HTMLElement | null;
    const editing = isEditable(active);

    if (direction !== undefined) {
      // Left and right move the caret inside a text field.
      if (editing && (direction === "LEFT" || direction === "RIGHT")) return;

      event.preventDefault();

      const next = nextFocusable(active, direction);

      if (next !== undefined) focusElement(next);

      return;
    }

    if (event.key === "Enter" && active !== null && active.matches(FOCUSABLE)) {
      event.preventDefault();
      if (event.repeat) return;
      handlers.onSelect?.(active);
      active.click();

      return;
    }

    if (BACK_KEYS.has(event.key)) {
      if (editing && event.key === "Backspace") return;

      event.preventDefault();
      if (event.repeat) return;
      handlers.onBack?.();
    }
  };

  document.addEventListener("keydown", onKeyDown);

  return () => {
    document.removeEventListener("keydown", onKeyDown);
  };
}

export function focusInitial(root: ParentNode = document): void {
  const target = autofocusTarget(root) ?? candidates(root)[0]?.element;

  target?.focus({ preventScroll: true });
}

export interface FocusKeeperOptions {
  /** How long a new screen has to render its preferred target before focus falls back. */
  readonly settleMs?: number;
  readonly path?: () => string;
}

/**
 * Keeps the remote's focus on the screen. When the focused element unmounts (a data refresh,
 * a route change) or focus drops to the body, focus returns to the new screen's preferred
 * target after a route change, or to the element nearest the old one otherwise.
 */
export function installFocusKeeper(options: FocusKeeperOptions = {}): () => void {
  const settleMs = options.settleMs ?? 800;
  const path = options.path ?? (() => window.location.pathname);
  let last: { readonly element: HTMLElement; readonly rect: DOMRect; readonly path: string } | undefined;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let scheduled = false;

  const lost = (): boolean => {
    const active = document.activeElement;

    return active === null || active === document.body || !active.isConnected;
  };

  const cancelFallback = (): void => {
    if (fallback !== undefined) clearTimeout(fallback);
    fallback = undefined;
  };

  const restore = (): void => {
    if (!lost()) return;

    const target =
      autofocusTarget() ??
      (last === undefined ? undefined : nearestFocusable(last.rect)) ??
      candidates(document)[0]?.element;

    target?.focus({ preventScroll: true });
  };

  const check = (): void => {
    scheduled = false;

    if (!lost()) {
      cancelFallback();

      return;
    }

    if (last === undefined || last.path !== path()) {
      const preferred = autofocusTarget();

      if (preferred !== undefined) {
        cancelFallback();
        preferred.focus({ preventScroll: true });
      } else if (fallback === undefined) {
        fallback = setTimeout(() => {
          fallback = undefined;
          restore();
        }, settleMs);
      }

      return;
    }

    const target =
      last.element.isConnected && visible(last.element)
        ? last.element
        : (nearestFocusable(last.rect) ?? autofocusTarget());

    target?.focus({ preventScroll: true });
  };

  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(check);
  };

  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target;

    if (target instanceof HTMLElement && target.matches(FOCUSABLE)) {
      cancelFallback();
      last = { element: target, rect: target.getBoundingClientRect(), path: path() };
    }
  };

  const onFocusOut = (): void => {
    setTimeout(schedule, 0);
  };

  const observer = new MutationObserver(schedule);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-tv-autofocus", "disabled", "aria-disabled"],
  });
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  schedule();

  return () => {
    observer.disconnect();
    cancelFallback();
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
  };
}
