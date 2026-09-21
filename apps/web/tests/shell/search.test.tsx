import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataSourceError, type SearchQuery, type SearchResults } from "@betng/ui-core";
import { SearchDialog, useSearchDialog } from "../../src/features/search";
import { fakeDataSource, renderApp } from "../helpers/runtime";

function openDialog(): void {
  act(() => {
    useSearchDialog.getState().show();
  });
}

afterEach(() => {
  useSearchDialog.getState().close();
});

describe("SearchDialog", () => {
  it("asks the data source and groups the hits by kind", async () => {
    const search = vi.fn(
      async (query: SearchQuery): Promise<SearchResults> => ({
        term: query.term,
        hits: [
          { kind: "TEAM", id: "t1", teamId: "t1", title: "Marrow Athletic", subtitle: "Zebra Invitational" },
          { kind: "LEAGUE", id: "league-a", leagueId: "league-a", title: "Zebra Invitational" },
        ],
      }),
    );

    renderApp(<SearchDialog />, { dataSource: fakeDataSource({ search, listTeams: async () => [] }) });
    openDialog();

    await userEvent.type(screen.getByRole("combobox"), "marrow");

    expect(await screen.findByRole("option", { name: /Marrow Athletic/ })).toHaveAttribute("href", "/teams/t1");
    expect(screen.getByRole("group", { name: "Teams" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Leagues" })).toBeInTheDocument();
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ term: "marrow" }));
  });

  it("does not search below two characters", async () => {
    const search = vi.fn(async (): Promise<SearchResults> => ({ term: "", hits: [] }));

    renderApp(<SearchDialog />, { dataSource: fakeDataSource({ search }) });
    openDialog();
    await userEvent.type(screen.getByRole("combobox"), "m");
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(search).not.toHaveBeenCalled();
  });

  it("says search is unavailable when the platform does not serve it", async () => {
    const search = vi.fn(async (): Promise<SearchResults> => {
      throw new DataSourceError("NOT_IMPLEMENTED", "not served");
    });

    renderApp(<SearchDialog />, { dataSource: fakeDataSource({ search }) });
    openDialog();
    await userEvent.type(screen.getByRole("combobox"), "marrow");

    expect(await screen.findByText("Search is not available yet")).toBeInTheDocument();
    expect(screen.queryByText("not served")).not.toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", async () => {
    renderApp(<SearchDialog />, { dataSource: fakeDataSource({ search: async (query) => ({ term: query.term, hits: [] }) }) });
    openDialog();
    await userEvent.type(screen.getByRole("combobox"), "zzzz");

    expect(await screen.findByText("No matches for that search")).toBeInTheDocument();
  });

  it("moves through the results with the arrow keys and opens one with Enter", async () => {
    const dataSource = fakeDataSource({
      listTeams: async () => [],
      search: async (query) => ({
        term: query.term,
        hits: [
          { kind: "TEAM", id: "t1", teamId: "t1", title: "Marrow Athletic" },
          { kind: "TEAM", id: "t2", teamId: "t2", title: "Marrow Rovers" },
        ],
      }),
    });
    const { router } = renderApp(<SearchDialog />, { dataSource });

    openDialog();

    const input = screen.getByRole("combobox");

    await userEvent.type(input, "marrow");
    await screen.findByRole("option", { name: /Marrow Rovers/ });
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");

    expect(screen.getByRole("option", { name: /Marrow Rovers/ })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/teams/t2");
    });
  });

  it("is absent when search is switched off", () => {
    renderApp(<SearchDialog />, { flags: { searchEnabled: false } });
    openDialog();

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
