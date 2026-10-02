import { useEffect, useRef } from "react";
import {
    ChartIcon,
    CloseIcon,
    HomeIcon,
    LogoMark,
    LogOutIcon,
    MessageIcon,
    PanelIcon,
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
            { key: "settings", label: "Settings", roles: ["admin"], Icon: SettingsIcon },
        ],
    },
];

// mode: "sidebar" (wide screens), "rail" (tablets: icons with short labels) or "drawer" (phones,
// opened from the top bar menu). On wide screens the user can collapse the sidebar to an
// icon-only rail, where each label becomes the button's tooltip and accessible name.
export function Sidebar({
    currentUser,
    activeView,
    mode,
    isCollapsed,
    isOpen,
    onNavigate,
    onOpenProfile,
    onLogout,
    onToggleCollapse,
    onClose,
}) {
    const isDrawer = mode === "drawer";
    const isIconRail = mode === "sidebar" && isCollapsed;
    const isRail = mode === "rail" || isIconRail;
    const navReference = useRef(null);

    useEffect(() => {
        if (!isDrawer || !isOpen) return undefined;
        const current = navReference.current?.querySelector("[aria-current='page']") || navReference.current?.querySelector("button");
        current?.focus();
        const handleKeyDown = (event) => {
            if (event.key === "Escape") onClose({ restoreFocus: true });
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isDrawer, isOpen, onClose]);

    const classes = [
        "sidebar",
        `sidebar-${mode}`,
        isRail && "sidebar-rail",
        isIconRail && "sidebar-icon-rail",
        isDrawer && isOpen && "sidebar-open",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <>
            {isDrawer && isOpen && <div className="sidebar-backdrop" onClick={() => onClose({ restoreFocus: true })} aria-hidden="true" />}
            <aside id="app-sidebar" className={classes} aria-label={isDrawer ? "Menu" : undefined}>
                <div className="sidebar-brand">
                    <LogoMark />
                    {!isRail && <span className="sidebar-brand-name">Support Desk</span>}
                    {isDrawer && (
                        <button
                            type="button"
                            className="sidebar-icon-button"
                            onClick={() => onClose({ restoreFocus: true })}
                            aria-label="Close menu"
                        >
                            <CloseIcon />
                        </button>
                    )}
                </div>
                <nav aria-label="Main" ref={navReference}>
                    {NAV_SECTIONS.map((section) => {
                        const visibleItems = section.items.filter((item) => item.roles.includes(currentUser.role));
                        if (visibleItems.length === 0) return null;
                        return (
                            <div key={section.label} className="sidebar-section">
                                {!isRail && <div className="sidebar-section-label">{section.label}</div>}
                                {visibleItems.map((item) => (
                                    <button
                                        type="button"
                                        key={item.key}
                                        className={activeView === item.key ? "active" : ""}
                                        onClick={() => onNavigate(item.key)}
                                        aria-current={activeView === item.key ? "page" : undefined}
                                        title={isIconRail ? item.label : undefined}
                                    >
                                        <item.Icon />
                                        <span className={isIconRail ? "visually-hidden" : "sidebar-nav-label"}>{item.label}</span>
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
                        aria-label={isRail ? `${currentUser.name}, ${currentUser.role}: profile` : undefined}
                        title={isRail ? `${currentUser.name} (${currentUser.role})` : undefined}
                    >
                        <span className="sidebar-profile-avatar">{initials(currentUser.name)}</span>
                        {!isRail && (
                            <span className="sidebar-profile-meta">
                                <span className="sidebar-profile-name">{currentUser.name}</span>
                                <span className="sidebar-profile-role">{currentUser.role}</span>
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        className="sidebar-icon-button sidebar-logout"
                        onClick={onLogout}
                        aria-label="Sign out"
                        title="Sign out"
                    >
                        <LogOutIcon />
                    </button>
                    {mode === "sidebar" && (
                        <button
                            type="button"
                            className="sidebar-collapse-toggle"
                            onClick={onToggleCollapse}
                            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            <PanelIcon direction={isCollapsed ? "open" : "close"} />
                        </button>
                    )}
                </div>
            </aside>
        </>
    );
}
