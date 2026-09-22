const NAV_ITEMS = [
    { key: "dashboard", label: "Dashboard", roles: ["admin", "agent", "customer"] },
    { key: "tickets", label: "Tickets", roles: ["admin", "agent", "customer"] },
    { key: "agents", label: "Agents", roles: ["admin", "agent"] },
    { key: "canned-responses", label: "Canned responses", roles: ["admin", "agent"] },
    { key: "analytics", label: "Analytics", roles: ["admin"] },
    { key: "settings", label: "Settings", roles: ["admin"] },
];

export function Sidebar({ currentUser, activeView, onNavigate, isCollapsed, onToggleCollapse }) {
    return (
        <aside className={`sidebar ${isCollapsed ? "sidebar-collapsed" : ""}`}>
            <div className="sidebar-brand">
                <img src="/favicon.svg" alt="" />
                {!isCollapsed && <span>Support Desk</span>}
            </div>
            <nav>
                {NAV_ITEMS.filter((item) => item.roles.includes(currentUser.role)).map((item) => (
                    <button
                        type="button"
                        key={item.key}
                        className={activeView === item.key ? "active" : ""}
                        onClick={() => onNavigate(item.key)}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>
            <button type="button" className="sidebar-collapse-toggle" onClick={onToggleCollapse} aria-label="Toggle sidebar">
                {isCollapsed ? "»" : "«"}
            </button>
        </aside>
    );
}
