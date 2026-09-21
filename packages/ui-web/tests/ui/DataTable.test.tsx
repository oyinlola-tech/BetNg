import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataSourceError } from "@betng/ui-core";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "../../src/ui/DataTable";
import type { Column } from "../../src/ui/DataTable";

interface Row {
  readonly id: string;
  readonly name: string;
  readonly stake: number;
}

const ROWS: readonly Row[] = [
  { id: "b", name: "Bravo", stake: 300 },
  { id: "a", name: "Alpha", stake: 100 },
  { id: "c", name: "Charlie", stake: 200 },
];

const COLUMNS: readonly Column<Row>[] = [
  { key: "name", header: "Name", cell: (r) => r.name, sortValue: (r) => r.name },
  {
    key: "stake",
    header: "Stake",
    cell: (r) => String(r.stake),
    sortValue: (r) => r.stake,
    numeric: true,
  },
];

function bodyRows(): HTMLElement[] {
  const [, body] = within(screen.getByRole("table")).getAllByRole("rowgroup");

  return body === undefined ? [] : within(body).getAllByRole("row");
}

function firstCells(): (string | null)[] {
  return bodyRows().map((row) => within(row).getAllByRole("cell")[0]?.textContent ?? null);
}

describe("DataTable", () => {
  it("has a caption and column scopes", () => {
    render(<DataTable caption="Bets" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);

    expect(screen.getByRole("table", { name: "Bets" })).toBeInTheDocument();

    for (const header of screen.getAllByRole("columnheader"))
      expect(header).toHaveAttribute("scope", "col");
  });

  it("sorts on the client and reports aria-sort", async () => {
    render(<DataTable caption="Bets" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);

    const header = screen.getByRole("columnheader", { name: /Name/ });

    expect(header).toHaveAttribute("aria-sort", "none");

    await userEvent.click(within(header).getByRole("button"));

    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(firstCells()).toEqual(["Alpha", "Bravo", "Charlie"]);

    await userEvent.click(within(header).getByRole("button"));

    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(firstCells()).toEqual(["Charlie", "Bravo", "Alpha"]);
  });

  it("leaves row order to the server when sorting is controlled", async () => {
    const onSortChange = vi.fn();

    render(
      <DataTable
        caption="Bets"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        sort={{ key: "stake", direction: "asc" }}
        onSortChange={onSortChange}
      />,
    );

    const header = screen.getByRole("columnheader", { name: /Stake/ });

    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(firstCells()).toEqual(["Bravo", "Alpha", "Charlie"]);

    await userEvent.click(within(header).getByRole("button"));

    expect(onSortChange).toHaveBeenCalledWith({ key: "stake", direction: "desc" });
    expect(firstCells()).toEqual(["Bravo", "Alpha", "Charlie"]);
  });

  it("calls the server pagination callback", async () => {
    const onPage = vi.fn();

    render(
      <DataTable
        caption="Bets"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        pagination={{ page: 1, pageSize: 3, total: 9, onPage }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(onPage).toHaveBeenCalledWith(2);
  });

  it("renders the empty state", () => {
    render(
      <DataTable
        caption="Bets"
        columns={COLUMNS}
        rows={[]}
        rowKey={(r) => r.id}
        empty={{ title: "No bets yet", description: "Placed bets appear here." }}
      />,
    );

    expect(screen.getByText("No bets yet")).toBeInTheDocument();
    expect(screen.getByText("Placed bets appear here.")).toBeInTheDocument();
  });

  it("renders the loading state", () => {
    render(
      <DataTable caption="Bets" columns={COLUMNS} rows={undefined} rowKey={(r) => r.id} loading />,
    );

    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("renders the error state with retry and keeps the toolbar", async () => {
    const onRetry = vi.fn();

    render(
      <DataTable
        caption="Bets"
        columns={COLUMNS}
        rows={undefined}
        rowKey={(r) => r.id}
        error={new DataSourceError("NETWORK", "fetch failed")}
        onRetry={onRetry}
        toolbar={<span>Filters</span>}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Connection problem");
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders row actions under an accessible header without triggering the row", async () => {
    const onRowClick = vi.fn();
    const onVoid = vi.fn();

    render(
      <DataTable
        caption="Bets"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        rowActions={(row) => (
          <button
            type="button"
            onClick={() => {
              onVoid(row.id);
            }}
          >
            Void {row.name}
          </button>
        )}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Void Alpha" }));

    expect(onVoid).toHaveBeenCalledWith("a");
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("moves between interactive rows with the keyboard", async () => {
    const onRowClick = vi.fn();

    render(
      <DataTable
        caption="Bets"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );

    const rows = bodyRows();

    expect(rows[0]).toHaveAttribute("tabindex", "0");
    expect(rows[1]).toHaveAttribute("tabindex", "-1");

    rows[0]?.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(rows[1]).toHaveFocus();

    await userEvent.keyboard("{End}");
    expect(rows[2]).toHaveFocus();

    await userEvent.keyboard("{ArrowUp}");
    expect(rows[1]).toHaveFocus();

    await userEvent.keyboard("{Home}");
    expect(rows[0]).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it("renders the card list alongside the table", () => {
    render(
      <DataTable
        caption="Bets"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        renderCard={(row) => <p>Card {row.name}</p>}
      />,
    );

    const list = screen.getByRole("list", { name: "Bets" });

    expect(list).toHaveClass("md:hidden");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByText("Card Alpha")).toBeInTheDocument();
  });

  it("hides a column from the visibility menu", async () => {
    render(
      <DataTable
        caption="Bets"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        columnVisibility
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose columns" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Stake" }));

    expect(screen.queryByRole("columnheader", { name: /Stake/ })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Name/ })).toBeInTheDocument();
  });
});
