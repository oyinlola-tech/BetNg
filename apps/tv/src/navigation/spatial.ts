export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export const FOCUSABLE = "[data-tv-focusable]";

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

export function nextFocusable(
  current: HTMLElement | null,
  direction: Direction,
  root: ParentNode = document,
): HTMLElement | undefined {
  const all = candidates(root);

  if (current === null || !current.matches(FOCUSABLE)) return all[0]?.element;

  const from = current.getBoundingClientRect();
  let best:
    { readonly element: HTMLElement; readonly score: number } | undefined;

  for (const c of all) {
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

export interface RemoteHandlers {
  readonly onBack?: () => void;
  readonly onSelect?: (element: HTMLElement) => void;
}

export function installRemote(handlers: RemoteHandlers): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    const direction = KEY_TO_DIRECTION[event.key];
    const active = document.activeElement as HTMLElement | null;

    if (direction !== undefined) {
      event.preventDefault();

      const next = nextFocusable(active, direction);

      if (next !== undefined) {
        next.focus({ preventScroll: true });
        next.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        });
      }

      return;
    }

    if (event.key === "Enter" && active !== null && active.matches(FOCUSABLE)) {
      event.preventDefault();
      handlers.onSelect?.(active);
      active.click();

      return;
    }

    if (
      event.key === "Escape" ||
      event.key === "Backspace" ||
      event.key === "GoBack" ||
      event.key === "BrowserBack"
    ) {
      event.preventDefault();
      handlers.onBack?.();
    }
  };

  document.addEventListener("keydown", onKeyDown);

  return () => {
    document.removeEventListener("keydown", onKeyDown);
  };
}

export function focusInitial(root: ParentNode = document): void {
  const preferred = root.querySelector<HTMLElement>("[data-tv-autofocus]");
  const target = preferred ?? candidates(root)[0]?.element;

  target?.focus({ preventScroll: true });
}
