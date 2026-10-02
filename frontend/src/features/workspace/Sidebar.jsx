import {
    ChartIcon,
    ClockIcon,
    CloseIcon,
    HomeIcon,
    LogOutIcon,
    MessageIcon,
    SettingsIcon,
    TicketIcon,
    UsersIcon,
} from "../../shared/components/Icon.jsx";
import { initials } from "../../shared/utils/format.js";

const NAV_SECTIONS = [
    {
        label: "Tickets",
        items: [
            { key: "dashboard", label: "Dashboard", roles: ["admin", "agent", "customer"], Icon: HomeIcon },
            { key: "tickets", label: "Tickets", roles: ["admin", "agent", "customer"], Icon: TicketIcon },
        ],
    },
    {
        label: "Manage",
        items: [
            { key: "agents", label: "Agents", roles: ["admin", "agent"], Icon: UsersIcon },
            { key: "canned-responses", label: "Canned responses", roles: ["admin", "agent"], Icon: MessageIcon },
            { key: "analytics", label: "Analytics", roles: ["admin"], Icon: ChartIcon },
            { key: "activity", label: "Activity", roles: ["admin"], Icon: ClockIcon },
            { key: "settings", label: "Settings", roles: ["admin"], Icon: SettingsIcon },
        ],
    },
];

// Below 1000px the sidebar is a drawer: isOpen shows it, and onClose hides it again.
export function Sidebar({ currentUser, activeView, onNavigate, onOpenProfile, onLogout, isCollapsed, onToggleCollapse, isOpen, onClose }) {
    return (
        <aside id="app-sidebar" className={`sidebar ${isCollapsed ? "sidebar-collapsed" : ""} ${isOpen ? "sidebar-open" : ""}`}>
            <div className="sidebar-brand">
                <img src="/favicon.svg" alt="" />
                {!isCollapsed && <span>Support Desk</span>}
                <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close navigation">
                    <CloseIcon />
                </button>
            </div>
            <nav aria-label="Main">
                {NAV_SECTIONS.map((section) => {
                    const visibleItems = section.items.filter((item) => item.roles.includes(currentUser.role));
                    if (visibleItems.length === 0) return null;
                    return (
                        <div key={section.label}>
                            {!isCollapsed && <div className="sidebar-section-label">{section.label}</div>}
                            {visibleItems.map((item) => (
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
                        </div>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
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
                <button type="button" className="sidebar-logout" onClick={onLogout} aria-label="Sign out" title="Sign out">
                    <LogOutIcon />
                </button>
            </div>

            <button
                type="button"
                className="sidebar-collapse-toggle"
                onClick={onToggleCollapse}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {isCollapsed ? "»" : "«"}
            </button>
        </aside>
    );
}
