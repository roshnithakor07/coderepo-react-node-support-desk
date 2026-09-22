import { useState } from "react";
import { formatRelativeTime, titleCase } from "../../shared/utils/format.js";

export function NotificationBell({ notifications, unreadCount, onMarkRead, onClear, onOpenTicket }) {
    const [isOpen, setIsOpen] = useState(false);

    function toggle() {
        const next = !isOpen;
        setIsOpen(next);
        if (next && unreadCount > 0) onMarkRead();
    }

    return (
        <div className="notification-bell">
            <button type="button" className="icon-button" onClick={toggle} aria-label="Notifications">
                <BellIcon />
                {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
            {isOpen && (
                <div className="notification-panel">
                    <div className="notification-panel-header">
                        <span>Notifications</span>
                        {notifications.length > 0 && (
                            <button type="button" className="link-button" onClick={onClear}>
                                Clear all
                            </button>
                        )}
                    </div>
                    <div className="notification-list">
                        {notifications.length === 0 && <p className="notification-empty">You're all caught up.</p>}
                        {notifications.map((notification) => (
                            <button
                                type="button"
                                key={notification._id}
                                className={`notification-item ${notification.isRead ? "" : "unread"}`}
                                onClick={() => {
                                    setIsOpen(false);
                                    onOpenTicket(notification.ticketId?._id || notification.ticketId);
                                }}
                            >
                                <span className="notification-type">{titleCase(notification.type)}</span>
                                <span className="notification-message">{notification.message}</span>
                                <span className="notification-time">{formatRelativeTime(notification.createdAt)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function BellIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    );
}
