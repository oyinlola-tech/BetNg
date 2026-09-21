import { act, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "../../src/hooks/useDebouncedValue";
import { useDocumentMeta } from "../../src/hooks/useDocumentMeta";
import type { DocumentMeta } from "../../src/hooks/useDocumentMeta";
import { useOnline } from "../../src/hooks/useOnline";

function Meta(props: DocumentMeta): null {
  useDocumentMeta(props);

  return null;
}

const meta = (selector: string): string | null =>
  document.head.querySelector(selector)?.getAttribute("content") ?? null;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.head.innerHTML = "";
  document.title = "";
});

describe("useDocumentMeta", () => {
  it("sets noindex and removes it on unmount", () => {
    const { unmount } = render(<Meta title="Wallet" noindex />);

    expect(meta('meta[name="robots"]')).toBe("noindex, nofollow");

    unmount();

    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it("leaves robots alone for indexable routes", () => {
    render(<Meta title="Live football" />);

    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it("sets title, description, canonical and Open Graph tags", () => {
    render(
      <Meta
        title="Lagos City v Kano Pillars"
        description="Live score and markets."
        canonical="https://betng.example/match/42"
        og={{ image: "https://betng.example/og/42.png", type: "website" }}
      />,
    );

    expect(document.title).toBe("Lagos City v Kano Pillars");
    expect(meta('meta[name="description"]')).toBe("Live score and markets.");
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://betng.example/match/42",
    );
    expect(meta('meta[property="og:title"]')).toBe("Lagos City v Kano Pillars");
    expect(meta('meta[property="og:url"]')).toBe("https://betng.example/match/42");
    expect(meta('meta[property="og:image"]')).toBe("https://betng.example/og/42.png");
  });

  it("restores the previous title and existing tags on unmount", () => {
    document.head.innerHTML = '<meta name="description" content="Site default">';
    document.title = "BETNG";

    const { unmount } = render(<Meta title="Results" description="Final scores." />);

    expect(meta('meta[name="description"]')).toBe("Final scores.");
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);

    unmount();

    expect(document.title).toBe("BETNG");
    expect(meta('meta[name="description"]')).toBe("Site default");
  });
});

describe("useOnline", () => {
  it("follows the browser's online and offline events", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useOnline());

    expect(result.current).toBe(true);

    act(() => {
      onLine.mockReturnValue(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(false);
  });
});

describe("useDebouncedValue", () => {
  it("holds the value until the delay passes", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: "la" },
    });

    rerender({ value: "lagos" });
    expect(result.current).toBe("la");

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe("lagos");
  });
});
