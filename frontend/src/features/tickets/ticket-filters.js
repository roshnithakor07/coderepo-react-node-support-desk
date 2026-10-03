// The ticket list's filters live in the URL query (#/tickets?status=open&page=2), so a refresh, Back,
// or a shared link shows the same list. Anything unknown in the query falls back to the default
// instead of reaching the API as a bad filter.

export const STATUS_OPTIONS = ["open", "in_progress", "pending", "resolved", "closed"];
export const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];

// Plain-language sort names; the values are the keys the API sorts by.
export const SORT_OPTIONS = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "title_asc", label: "Title A–Z" },
    { value: "title_desc", label: "Title Z–A" },
    { value: "priority_desc", label: "Priority: highest first" },
    { value: "status", label: "Status" },
];

export const DEFAULT_SORT = "newest";
const PAGE_SIZE = 20;

// The unassigned queue is a view of the same list, so it is part of the URL
// (#/tickets?view=unassigned) and comes back on a refresh, with Back, and in a shared link. Only the
// support team has one, so for a customer the parameter is simply not a view that exists.
export const UNASSIGNED_VIEW = "unassigned";

export function filtersFromQuery(search, role) {
    const params = new URLSearchParams(search);
    // Digits only: Number() would also accept "1e3", " 2" or "0x10" as a page.
    const rawPage = params.get("page") || "";
    const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 0;
    const status = params.get("status");
    const priority = params.get("priority");
    const sort = params.get("sort");
    const view = params.get("view");
    return {
        page: page >= 1 ? page : 1,
        pageSize: PAGE_SIZE,
        sort: SORT_OPTIONS.some((option) => option.value === sort) ? sort : DEFAULT_SORT,
        search: (params.get("search") || "").trim() ? params.get("search") : "",
        status: STATUS_OPTIONS.includes(status) ? status : "",
        priority: PRIORITY_OPTIONS.includes(priority) ? priority : "",
        view: view === UNASSIGNED_VIEW && role !== "customer" ? UNASSIGNED_VIEW : "",
    };
}

// Defaults are left out, so the plain list stays at a plain #/tickets.
export function queryFromFilters(filters) {
    return {
        view: filters.view === UNASSIGNED_VIEW ? UNASSIGNED_VIEW : "",
        search: filters.search || "",
        status: filters.status || "",
        priority: filters.priority || "",
        sort: filters.sort && filters.sort !== DEFAULT_SORT ? filters.sort : "",
        page: filters.page > 1 ? String(filters.page) : "",
    };
}
