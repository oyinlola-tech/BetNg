import { afterEach, describe, expect, it, vi } from "vitest";
import { installFocusKeeper, installRemote, nextFocusable } from "../../src/navigation/spatial";
import { backTarget } from "../../src/navigation/useRemote";

function place(id: string, rect: { x: number; y: number; w?: number; h?: number }): HTMLButtonElement {
  const el = document.createElement("button");

  el.id = id;
  el.setAttribute("data-tv-focusable", "");
  el.scrollIntoView = vi.fn();
  el.getBoundingClientRect = () => new DOMRect(rect.x, rect.y, rect.w ?? 100, rect.h ?? 40);
  document.body.append(el);

  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("TV spatial navigation", () => {
  it("moves to the nearest focusable in the pressed direction", () => {
    const a = place("a", { x: 0, y: 0 });
    place("b", { x: 200, y: 0 });
    place("c", { x: 0, y: 100 });

    expect(nextFocusable(a, "RIGHT")?.id).toBe("b");
    expect(nextFocusable(a, "DOWN")?.id).toBe("c");
    expect(nextFocusable(a, "LEFT")).toBeUndefined();
  });

  it("prefers an aligned target over a closer diagonal one", () => {
    const a = place("a", { x: 0, y: 0 });
    place("diagonal", { x: 160, y: 60 });
    place("aligned", { x: 0, y: 130 });

    expect(nextFocusable(a, "DOWN")?.id).toBe("aligned");
  });

  it("skips disabled and off-screen elements", () => {
    const a = place("a", { x: 0, y: 0 });
    const disabled = place("disabled", { x: 150, y: 0 });

    disabled.disabled = true;
    place("hidden", { x: 300, y: 0, w: 0, h: 0 });
    place("far", { x: 450, y: 0 });

    expect(nextFocusable(a, "RIGHT")?.id).toBe("far");
  });

  it("focuses with the arrow keys, selects with Enter and goes back with Escape", () => {
    const a = place("a", { x: 0, y: 0 });
    const b = place("b", { x: 200, y: 0 });
    const onBack = vi.fn();
    const clicked = vi.fn();

    b.addEventListener("click", clicked);

    const uninstall = installRemote({ onBack });

    a.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(document.activeElement).toBe(b);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(clicked).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onBack).toHaveBeenCalledTimes(1);

    uninstall();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("takes the screen's preferred target when an arrow is pressed with nothing focused", () => {
    place("nav", { x: 0, y: 0 });
    const preferred = place("preferred", { x: 0, y: 200 });

    preferred.setAttribute("data-tv-autofocus", "");

    const uninstall = installRemote({});

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(document.activeElement).toBe(preferred);
    uninstall();
  });

  it("falls back to the first focusable when there is no preferred target", () => {
    const first = place("first", { x: 0, y: 0 });

    place("second", { x: 200, y: 0 });

    const uninstall = installRemote({});

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(document.activeElement).toBe(first);
    uninstall();
  });

  it("leaves Backspace and the caret keys to a text field", () => {
    const input = document.createElement("input");
    const onBack = vi.fn();

    document.body.append(input);
    place("other", { x: 200, y: 0 });
    input.focus();

    const uninstall = installRemote({ onBack });
    const backspace = new KeyboardEvent("keydown", { key: "Backspace", cancelable: true });
    const left = new KeyboardEvent("keydown", { key: "ArrowLeft", cancelable: true });

    document.dispatchEvent(backspace);
    document.dispatchEvent(left);
    expect(onBack).not.toHaveBeenCalled();
    expect(backspace.defaultPrevented).toBe(false);
    expect(left.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
    uninstall();
  });

  it("ignores held-down OK and Back so one press is one action", () => {
    const a = place("a", { x: 0, y: 0 });
    const clicked = vi.fn();
    const onBack = vi.fn();

    a.addEventListener("click", clicked);
    a.focus();

    const uninstall = installRemote({ onBack });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", repeat: true }));
    expect(clicked).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    uninstall();
  });
});

describe("TV focus keeper", () => {
  it("moves focus to the nearest element when the focused one unmounts on a data refresh", async () => {
    place("far", { x: 800, y: 600 });
    const doomed = place("doomed", { x: 0, y: 100 });
    const near = place("near", { x: 0, y: 160 });
    const uninstall = installFocusKeeper({ path: () => "/" });

    doomed.focus();
    doomed.remove();

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(near);
    });
    uninstall();
  });

  it("focuses the new screen's preferred target after a route change, once it renders", async () => {
    let path = "/";
    const card = place("card", { x: 0, y: 100 });

    place("nav", { x: 0, y: 0 });

    const uninstall = installFocusKeeper({ path: () => path, settleMs: 5_000 });

    card.focus();
    path = "/live/1";
    card.remove();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.activeElement).toBe(document.body);

    const preferred = place("preferred", { x: 0, y: 400 });

    preferred.setAttribute("data-tv-autofocus", "");

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(preferred);
    });
    uninstall();
  });

  it("falls back to something focusable when a new screen has no preferred target", async () => {
    let path = "/";
    const card = place("card", { x: 0, y: 100 });
    const nav = place("nav", { x: 0, y: 0 });
    const uninstall = installFocusKeeper({ path: () => path, settleMs: 30 });

    card.focus();
    path = "/results";
    card.remove();

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(nav);
    });
    uninstall();
  });

  it("gives the first screen its preferred target at start-up", async () => {
    place("nav", { x: 0, y: 0 });
    const preferred = place("preferred", { x: 0, y: 300 });

    preferred.setAttribute("data-tv-autofocus", "");

    const uninstall = installFocusKeeper({ path: () => "/" });

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(preferred);
    });
    uninstall();
  });

  it("does not take focus away from an element that is still focused", async () => {
    const nav = place("nav", { x: 0, y: 0 });
    let path = "/";
    const uninstall = installFocusKeeper({ path: () => path });

    nav.focus();
    path = "/board";
    place("preferred", { x: 0, y: 300 }).setAttribute("data-tv-autofocus", "");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(document.activeElement).toBe(nav);
    uninstall();
  });
});

describe("TV Back", () => {
  it("does nothing at the root, goes back through history, and goes home when the display opened deep", () => {
    expect(backTarget("/", true)).toBe("stay");
    expect(backTarget("/", false)).toBe("stay");
    expect(backTarget("/live/1", true)).toBe("back");
    expect(backTarget("/live/1", false)).toBe("home");
  });
});
