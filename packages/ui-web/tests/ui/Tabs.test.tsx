import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TabPanel } from "../../src/ui/TabPanel";
import { Tabs } from "../../src/ui/Tabs";

type Tab = "overview" | "stats" | "markets";

const ITEMS = [
  { value: "overview", label: "Overview" },
  { value: "stats", label: "Stats" },
  { value: "markets", label: "Markets", count: 12 },
] as const;

function Harness({ scrollable = false }: { readonly scrollable?: boolean }): React.JSX.Element {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <>
      <Tabs<Tab>
        id="match"
        label="Match sections"
        items={ITEMS}
        value={tab}
        onChange={setTab}
        scrollable={scrollable}
      />
      <TabPanel tabsId="match" value="overview" active={tab}>
        Overview content
      </TabPanel>
      <TabPanel tabsId="match" value="stats" active={tab}>
        Stats content
      </TabPanel>
      <TabPanel tabsId="match" value="markets" active={tab}>
        Markets content
      </TabPanel>
    </>
  );
}

describe("Tabs", () => {
  it("wires tabs to their panel", () => {
    render(<Harness />);

    const tab = screen.getByRole("tab", { name: "Overview" });
    const panel = screen.getByRole("tabpanel");

    expect(screen.getByRole("tablist", { name: "Match sections" })).toBeInTheDocument();
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    expect(panel).toHaveTextContent("Overview content");
  });

  it("moves with arrow keys, Home and End using a roving tabindex", async () => {
    render(<Harness />);

    screen.getByRole("tab", { name: "Overview" }).focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Stats" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Stats" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Stats content");

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: /Markets/ })).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: /Markets/ })).toHaveFocus();

    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
  });

  it("selects on click", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("tab", { name: /Markets/ }));

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Markets content");
  });

  it("renders the scrollable variant as one scrolling row", () => {
    render(<Harness scrollable />);

    expect(screen.getByRole("tablist")).toHaveClass("overflow-x-auto");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("omits aria-controls when no id links it to panels", () => {
    render(<Tabs items={ITEMS} value="overview" onChange={() => undefined} />);

    expect(screen.getByRole("tab", { name: "Overview" })).not.toHaveAttribute("aria-controls");
  });
});
