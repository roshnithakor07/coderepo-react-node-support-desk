import { useEffect, useRef, useState } from "react";
import { formatRelativeTime } from "../../shared/utils/format.js";
import { AlertCircleIcon, ClockIcon, InboxIcon, InfoIcon, MessageIcon, TicketIcon } from "../../shared/components/Icon.jsx";

const TYPE_ICONS = {
    ticket_assigned: TicketIcon,
    ticket_unassigned: InboxIcon,
    ticket_reply: MessageIcon,
    sla_warning: ClockIcon,
    sla_breached: AlertCircleIcon,
    status_changed: InfoIcon,
    ticket_merged: TicketIcon,
};

export function NotificationBell({ notifications, unreadCount, onMarkAllRead, onClear, onOpenNotification }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Opening the panel marks nothing: a glance at the bell is not having read anything, and a row that
    // is still unread is the only way back to what has not been dealt with.
    function toggle() {
        setIsOpen((open) => !open);
    }

    useEffect(() => {
        if (!isOpen) return undefined;
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
        }
        function handleEscape(event) {
            if (event.key === "Escape") setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen]);

    return (
        <div className="notification-bell" ref={containerRef}>
            <button
                type="button"
                className="icon-button"
                onClick={toggle}
                aria-label="Notifications"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <BellIcon />
                {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
            {isOpen && (
                <div className="notification-panel" role="region" aria-label="Notifications">
                    <div className="notification-panel-header">
                        <span>Notifications</span>
                        <div className="notification-panel-actions">
                            {unreadCount > 0 && (
                                <button type="button" className="link-button" onClick={onMarkAllRead}>
                                    Mark all as read
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button type="button" className="link-button" onClick={onClear}>
                                    Clear all
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="notification-list">
                        {notifications.length === 0 && (
                            <div className="notification-empty">
                                <InboxIcon className="table-empty-icon" />
                                <p>You&rsquo;re all caught up.</p>
                            </div>
                        )}
                        {notifications.map((notification) => {
                            const TypeIcon = TYPE_ICONS[notification.type] || InfoIcon;
                            return (
                                <button
                                    type="button"
                                    key={notification._id}
                                    className={`notification-item ${notification.isRead ? "" : "unread"}`}
                                    aria-label={`${notification.isRead ? "" : "Unread: "}${notification.message}`}
                                    onClick={() => {
                                        setIsOpen(false);
                                        onOpenNotification(notification);
                                    }}
                                >
                                    <span className="notification-item-icon">
                                        <TypeIcon />
                                    </span>
                                    <span className="notification-item-body">
                                        <span className="notification-message">{notification.message}</span>
                                        <span className="notification-time">{formatRelativeTime(notification.createdAt)}</span>
                                    </span>
                                    {!notification.isRead && <span className="notification-unread-dot" aria-hidden="true" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function BellIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    );
}
