import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { useAdminList } from "../../src/hooks/useAdminList";
import { Providers, installSources } from "../helpers/render";

function Probe(): React.JSX.Element {
  const list = useAdminList("users", { defaults: { sort: "lastActiveAt", direction: "desc" }, filterKeys: ["status"] });
  const location = useLocation();

  return (
    <div>
      <output data-testid="search">{location.search}</output>
      <input aria-label="Search" value={list.searchInput} onChange={(event) => list.setSearchInput(event.target.value)} />
      <button onClick={() => list.setPage(3)}>page 3</button>
      <button onClick={() => list.setSort({ key: "balance", direction: "asc" })}>sort balance</button>
      <button onClick={() => list.setFilter("status", "SUSPENDED")}>suspended</button>
      <button onClick={() => list.setPageSize(50)}>50 rows</button>
      <button onClick={list.clear}>clear</button>
    </div>
  );
}

function mount(entry: string) {
  const adminSource = installSources();

  render(
    <Providers>
      <MemoryRouter initialEntries={[entry]}>
        <Probe />
      </MemoryRouter>
    </Providers>,
  );

  return adminSource.calls("queryList");
}

const search = (): URLSearchParams => new URLSearchParams(screen.getByTestId("search").textContent);

describe("useAdminList", () => {
  it("sends the page, size, sort, search and filters in the address to queryList", async () => {
    const queryList = mount("/users?page=2&size=10&sort=balance&dir=desc&q=ada&status=ACTIVE");

    await waitFor(() => {
      expect(queryList).toHaveBeenCalledWith("users", { page: 2, pageSize: 10, sort: "balance", direction: "desc", search: "ada", filters: { status: "ACTIVE" } });
    });
    expect(screen.getByLabelText("Search")).toHaveValue("ada");
  });

  it("uses the screen's defaults when the address says nothing", async () => {
    const queryList = mount("/users");

    await waitFor(() => {
      expect(queryList).toHaveBeenCalledWith("users", { page: 1, pageSize: 25, sort: "lastActiveAt", direction: "desc", filters: {} });
    });
  });

  it("writes every change back to the address and asks the platform again", async () => {
    const user = userEvent.setup();
    const queryList = mount("/users");

    await user.click(screen.getByRole("button", { name: "sort balance" }));
    await user.click(screen.getByRole("button", { name: "suspended" }));
    await user.click(screen.getByRole("button", { name: "50 rows" }));
    await user.click(screen.getByRole("button", { name: "page 3" }));

    expect(Object.fromEntries(search())).toEqual({ sort: "balance", dir: "asc", status: "SUSPENDED", size: "50", page: "3" });
    await waitFor(() => {
      expect(queryList).toHaveBeenLastCalledWith("users", { page: 3, pageSize: 50, sort: "balance", direction: "asc", filters: { status: "SUSPENDED" } });
    });
  });

  it("debounces the search box into the address and returns to the first page", async () => {
    const user = userEvent.setup();
    const queryList = mount("/users?page=4");

    await user.type(screen.getByLabelText("Search"), "obi");

    expect(search().get("q")).toBeNull();
    await waitFor(() => {
      expect(search().get("q")).toBe("obi");
    });
    expect(search().get("page")).toBeNull();
    await waitFor(() => {
      expect(queryList).toHaveBeenLastCalledWith("users", expect.objectContaining({ page: 1, search: "obi" }));
    });
    expect(queryList).not.toHaveBeenCalledWith("users", expect.objectContaining({ search: "ob" }));
  });

  it("clears search and filters together", async () => {
    const user = userEvent.setup();

    mount("/users?q=ada&status=ACTIVE&sort=balance&dir=asc");
    await user.click(screen.getByRole("button", { name: "clear" }));

    expect(Object.fromEntries(search())).toEqual({ sort: "balance", dir: "asc" });
    expect(screen.getByLabelText("Search")).toHaveValue("");
  });
});
