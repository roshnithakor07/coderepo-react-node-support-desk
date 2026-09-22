import { ChartIcon, HomeIcon, MessageIcon, SettingsIcon, TicketIcon, UsersIcon } from "../../shared/components/Icon.jsx";
import { initials } from "../../shared/utils/format.js";

const NAV_ITEMS = [
    { key: "dashboard", label: "Dashboard", roles: ["admin", "agent", "customer"], Icon: HomeIcon },
    { key: "tickets", label: "Tickets", roles: ["admin", "agent", "customer"], Icon: TicketIcon },
    { key: "agents", label: "Agents", roles: ["admin", "agent"], Icon: UsersIcon },
    { key: "canned-responses", label: "Canned responses", roles: ["admin", "agent"], Icon: MessageIcon },
    { key: "analytics", label: "Analytics", roles: ["admin"], Icon: ChartIcon },
    { key: "settings", label: "Settings", roles: ["admin"], Icon: SettingsIcon },
];

export function Sidebar({ currentUser, activeView, onNavigate, onOpenProfile, isCollapsed, onToggleCollapse }) {
    return (
        <aside className={`sidebar ${isCollapsed ? "sidebar-collapsed" : ""}`}>
            <div className="sidebar-brand">
                <img src="/favicon.svg" alt="" />
                {!isCollapsed && <span>Support Desk</span>}
            </div>
            <nav aria-label="Main">
                {NAV_ITEMS.filter((item) => item.roles.includes(currentUser.role)).map((item) => (
                    <button
                        type="button"
                        key={item.key}
                        className={activeView === item.key ? "active" : ""}
                        onClick={() => onNavigate(item.key)}
                        aria-current={activeView === item.key ? "page" : undefined}
                        title={isCollapsed ? item.label : undefined}
                    >
                        <item.Icon />
                        {!isCollapsed && <span>{item.label}</span>}
                    </button>
                ))}
            </nav>

            <button
                type="button"
                className="sidebar-profile"
                onClick={onOpenProfile}
                aria-current={activeView === "profile" ? "page" : undefined}
                title={isCollapsed ? `${currentUser.name} (${currentUser.role})` : undefined}
            >
                <span className="sidebar-profile-avatar">{initials(currentUser.name)}</span>
                {!isCollapsed && (
                    <span className="sidebar-profile-meta">
                        <span className="sidebar-profile-name">{currentUser.name}</span>
                        <span className="sidebar-profile-role">{currentUser.role}</span>
                    </span>
                )}
            </button>

            <button type="button" className="sidebar-collapse-toggle" onClick={onToggleCollapse} aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
                {isCollapsed ? "»" : "«"}
            </button>
        </aside>
    );
}
