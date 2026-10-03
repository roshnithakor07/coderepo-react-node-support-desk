import { afterEach, describe, expect, test } from "bun:test";
import {
    DEFAULT_SORT,
    filtersFromQuery,
    PRIORITY_OPTIONS,
    queryFromFilters,
    SORT_OPTIONS,
    STATUS_OPTIONS,
    UNASSIGNED_VIEW,
} from "../src/features/tickets/ticket-filters.js";
import { navigate, parseHash, toHash } from "../src/shared/utils/router.js";
import { canOpen, HOME_PATH, matchRoute, ROUTES, routeForView, safeReturnPath, ticketPath } from "../src/shared/utils/routes.js";

const TICKET_ID = "66f1a2b3c4d5e6f708192a3b";

describe("hash parsing and building", () => {
    test("splits the path from the query", () => {
        expect(parseHash("#/tickets?status=open&page=2")).toEqual({ path: "/tickets", search: "status=open&page=2" });
    });

    test("two spellings of one URL give one path", () => {
        for (const spelling of ["#/tickets", "#tickets", "#/tickets/", "#//tickets"]) expect(parseHash(spelling).path).toBe("/tickets");
    });

    test("an empty hash is the root", () => {
        expect(parseHash("")).toEqual({ path: "/", search: "" });
        expect(parseHash("#")).toEqual({ path: "/", search: "" });
    });

    test("empty query values are left out, so a cleared filter leaves the URL", () => {
        expect(toHash("/tickets", { search: "", status: "open", page: "" })).toBe("#/tickets?status=open");
        expect(toHash("/tickets", {})).toBe("#/tickets");
        expect(toHash("/tickets")).toBe("#/tickets");
    });

    test("a query string passes through, and what is built can be parsed back", () => {
        expect(toHash("/tickets", "status=open")).toBe("#/tickets?status=open");
        const built = toHash("/tickets", { search: "refund & invoice", priority: "high" });
        expect(parseHash(built)).toEqual({
            path: "/tickets",
            search: new URLSearchParams({ search: "refund & invoice", priority: "high" }).toString(),
        });
    });
});

describe("route table", () => {
    test("every page from the brief has its own URL", () => {
        const paths = [
            "/dashboard",
            "/tickets",
            `/tickets/${TICKET_ID}`,
            "/agents",
            "/canned-responses",
            "/activity",
            "/analytics",
            "/settings",
            "/profile",
        ];
        for (const path of paths) expect(matchRoute(path)?.route.path.replace(":ticketId", TICKET_ID)).toBe(path);
    });

    test("the ticket id is read from the URL, and /tickets is not a ticket", () => {
        expect(matchRoute(`/tickets/${TICKET_ID}`)).toMatchObject({ route: { view: "ticket-detail" }, params: { ticketId: TICKET_ID } });
        expect(matchRoute("/tickets").route.view).toBe("tickets");
    });

    test("an unknown URL matches nothing", () => {
        for (const path of ["/", "/nope", "/tickets/a/b", "/settings/extra", "/dashboard/1"]) expect(matchRoute(path)).toBeNull();
    });

    test("views and paths are unique", () => {
        expect(new Set(ROUTES.map((route) => route.view)).size).toBe(ROUTES.length);
        expect(new Set(ROUTES.map((route) => route.path)).size).toBe(ROUTES.length);
        expect(routeForView("settings").path).toBe("/settings");
        expect(ticketPath(TICKET_ID)).toBe(`/tickets/${TICKET_ID}`);
    });

    test("who may open what", () => {
        const allowed = (role) => ROUTES.filter((route) => canOpen(route, role)).map((route) => route.view);
        expect(allowed("admin")).toEqual(ROUTES.map((route) => route.view));
        expect(allowed("agent")).toEqual(["dashboard", "tickets", "ticket-detail", "agents", "canned-responses", "profile"]);
        expect(allowed("customer")).toEqual(["dashboard", "tickets", "ticket-detail", "profile"]);
    });
});

describe("where signing in sends you", () => {
    test("back to the page that was asked for, query included", () => {
        expect(safeReturnPath(`/tickets/${TICKET_ID}`)).toBe(`/tickets/${TICKET_ID}`);
        expect(safeReturnPath("/tickets?status=open&page=2")).toBe("/tickets?status=open&page=2");
    });

    test("anything that is not an in-app path goes home", () => {
        for (const value of [null, undefined, "", "tickets", "https://evil.example/x", "//evil.example", "javascript:alert(1)"]) {
            expect(safeReturnPath(value)).toBe(HOME_PATH);
        }
    });

    test("never back to the sign-in page or the bare root", () => {
        for (const value of ["/", "/sign-in", "/sign-in?next=%2Ftickets"]) expect(safeReturnPath(value)).toBe(HOME_PATH);
    });
});

describe("ticket list filters in the URL", () => {
    test("read from the query", () => {
        expect(filtersFromQuery("status=open&priority=high&sort=oldest&page=3&search=refund")).toEqual({
            page: 3,
            pageSize: 20,
            sort: "oldest",
            search: "refund",
            status: "open",
            priority: "high",
            view: "",
        });
    });

    test("an empty query is the plain list", () => {
        expect(filtersFromQuery("")).toEqual({ page: 1, pageSize: 20, sort: DEFAULT_SORT, search: "", status: "", priority: "", view: "" });
        expect(queryFromFilters(filtersFromQuery(""))).toEqual({ view: "", search: "", status: "", priority: "", sort: "", page: "" });
    });

    test("anything unknown falls back instead of reaching the API", () => {
        const filters = filtersFromQuery("status=banana&priority=urgent&sort=chaos&page=-4");
        expect(filters).toMatchObject({ status: "", priority: "", sort: DEFAULT_SORT, page: 1 });
        for (const page of ["0", "abc", "2.5", "", "1e3", " 2", "0x10", "+3", "-1"]) expect(filtersFromQuery(`page=${page}`).page).toBe(1);
        expect(filtersFromQuery("search=%20%20").search).toBe("");
    });

    test("every option survives a trip through the URL", () => {
        for (const status of STATUS_OPTIONS) {
            for (const priority of PRIORITY_OPTIONS) {
                for (const { value: sort } of SORT_OPTIONS) {
                    const filters = { page: 4, pageSize: 20, sort, search: "a b&c", status, priority, view: "" };
                    const url = toHash("/tickets", queryFromFilters(filters));
                    expect(filtersFromQuery(parseHash(url).search)).toEqual(filters);
                }
            }
        }
    });

    test("the default sort and the first page stay out of the URL", () => {
        expect(toHash("/tickets", queryFromFilters({ page: 1, sort: DEFAULT_SORT, status: "open" }))).toBe("#/tickets?status=open");
    });
});

describe("the unassigned queue is a view in the URL", () => {
    test("the support team's queue survives a refresh and keeps the filters with it", () => {
        const filters = filtersFromQuery("view=unassigned&priority=high&page=2", "agent");
        expect(filters).toMatchObject({ view: UNASSIGNED_VIEW, priority: "high", page: 2 });
        expect(toHash("/tickets", queryFromFilters(filters))).toBe("#/tickets?view=unassigned&priority=high&page=2");
        // The round trip is what a refresh does.
        expect(filtersFromQuery(parseHash(toHash("/tickets", queryFromFilters(filters))).search, "agent")).toEqual(filters);
    });

    test("an admin has the same queue", () => {
        expect(filtersFromQuery("view=unassigned", "admin").view).toBe(UNASSIGNED_VIEW);
    });

    test("a customer has no such view, so the URL gives them their own list", () => {
        expect(filtersFromQuery("view=unassigned", "customer").view).toBe("");
        expect(queryFromFilters(filtersFromQuery("view=unassigned", "customer")).view).toBe("");
    });

    test("a view nobody has falls back to the plain list", () => {
        expect(filtersFromQuery("view=everything", "admin").view).toBe("");
        expect(filtersFromQuery("view=", "agent").view).toBe("");
    });
});

describe("navigate", () => {
    const original = globalThis.window;
    afterEach(() => {
        globalThis.window = original;
    });

    function fakeWindow(hash) {
        const calls = [];
        globalThis.window = {
            location: { hash },
            history: { state: null, replaceState: (_state, _title, href) => calls.push(["replace", href]) },
            dispatchEvent: (event) => calls.push(["event", event.type]),
        };
        globalThis.HashChangeEvent ??= class HashChangeEvent extends Event {
            constructor() {
                super("hashchange");
            }
        };
        return calls;
    }

    test("a push sets the hash, which adds a history entry", () => {
        fakeWindow("#/tickets");
        navigate("#/agents");
        expect(window.location.hash).toBe("#/agents");
    });

    test("a replace rewrites the entry and tells the app", () => {
        const calls = fakeWindow("#/tickets");
        navigate("#/tickets?status=open", { replace: true });
        expect(calls).toEqual([
            ["replace", "#/tickets?status=open"],
            ["event", "hashchange"],
        ]);
    });

    test("going to where you already are does nothing", () => {
        const calls = fakeWindow("#/tickets");
        navigate("#/tickets");
        navigate("#/tickets", { replace: true });
        expect(calls).toEqual([]);
    });
});
