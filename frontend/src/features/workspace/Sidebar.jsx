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
import { toHash } from "../../shared/utils/router.js";
import { canOpen, routeForView } from "../../shared/utils/routes.js";

const NAV_SECTIONS = [
    {
        label: "Tickets",
        items: [
            { view: "dashboard", label: "Dashboard", Icon: HomeIcon },
            { view: "tickets", label: "Tickets", Icon: TicketIcon },
        ],
    },
    {
        label: "Manage",
        items: [
            { view: "agents", label: "Agents", Icon: UsersIcon },
            { view: "canned-responses", label: "Canned responses", Icon: MessageIcon },
            { view: "analytics", label: "Analytics", Icon: ChartIcon },
            { view: "activity", label: "Activity", Icon: ClockIcon },
            { view: "settings", label: "Settings", Icon: SettingsIcon },
        ],
    },
].map((section) => ({ ...section, items: section.items.map((item) => ({ ...item, route: routeForView(item.view) })) }));

// Below 1000px the sidebar is a drawer: isOpen shows it, and onClose hides it again. Nav items are
// links, so they open in a new tab too; following one changes the URL, and the app follows the URL.
export function Sidebar({ currentUser, activeView, onOpenProfile, onLogout, isCollapsed, onToggleCollapse, isOpen, onClose }) {
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
                    const visibleItems = section.items.filter((item) => canOpen(item.route, currentUser.role));
                    if (visibleItems.length === 0) return null;
                    return (
                        <div key={section.label}>
                            {!isCollapsed && <div className="sidebar-section-label">{section.label}</div>}
                            {visibleItems.map((item) => (
                                <a
                                    key={item.view}
                                    href={toHash(item.route.path)}
                                    className={activeView === item.view ? "active" : ""}
                                    onClick={onClose}
                                    aria-current={activeView === item.view ? "page" : undefined}
                                    title={isCollapsed ? item.label : undefined}
                                >
                                    <item.Icon />
                                    {!isCollapsed && <span>{item.label}</span>}
                                </a>
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
