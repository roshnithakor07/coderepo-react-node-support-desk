const base = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

export function HomeIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
        </svg>
    );
}

export function TicketIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
            <path d="M12 6v2m0 8v2m0-6.5v1" />
        </svg>
    );
}

export function UsersIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
            <circle cx="9" cy="7" r="3.5" />
            <path d="M22 19v-1a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}

export function MessageIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 20l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
        </svg>
    );
}

export function ChartIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <path d="M3 3v18h18" />
            <path d="M7 16v-4m5 4V8m5 8v-6" />
        </svg>
    );
}

export function SettingsIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
    );
}

export function InboxIcon(props) {
    return (
        <svg {...base} width={36} height={36} {...props} aria-hidden="true">
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
        </svg>
    );
}

export function CheckCircleIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12.5 2.3 2.3L15.5 9.5" />
        </svg>
    );
}

export function AlertCircleIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
        </svg>
    );
}

export function InfoIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <path d="M12 8h.01" />
        </svg>
    );
}

export function CloseIcon(props) {
    return (
        <svg {...base} width={16} height={16} {...props} aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}

export function SearchIcon(props) {
    return (
        <svg {...base} width={16} height={16} {...props} aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    );
}

export function ClockIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" />
        </svg>
    );
}

export function TagIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <path d="M20.59 13.41 12 22l-9-9V4a1 1 0 0 1 1-1h9Z" transform="rotate(180 12 12)" />
            <circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function PlusIcon(props) {
    return (
        <svg {...base} width={16} height={16} {...props} aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
        </svg>
    );
}

export function LogOutIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
        </svg>
    );
}

export function ArrowLeftIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
        </svg>
    );
}

export function LockIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
    );
}

export function TargetIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1" />
        </svg>
    );
}

// The Support Desk mark: a reply bubble with a check, on a tile in the accent color. Drawn inline
// so it follows the theme tokens; public/favicon.svg is the same drawing in the light theme colors.
export function LogoMark(props) {
    return (
        <svg className="logo-mark" viewBox="0 0 32 32" width={24} height={24} {...props} aria-hidden="true">
            <rect className="logo-mark-tile" width="32" height="32" rx="8" />
            <path
                className="logo-mark-bubble"
                d="M11 8h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-6l-4.4 3.5a.6.6 0 0 1-1-.5v-3.2A4 4 0 0 1 7 18v-6a4 4 0 0 1 4-4Z"
            />
            <path className="logo-mark-check" d="m11.8 15.2 2.8 2.8 5.6-5.6" />
        </svg>
    );
}

export function MenuIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
    );
}

// A sidebar panel; the arrow points the way the sidebar will move.
export function PanelIcon({ direction = "close", ...props }) {
    return (
        <svg {...base} width={16} height={16} {...props} aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
            <path d={direction === "close" ? "m16 10-2 2 2 2" : "m14 10 2 2-2 2"} />
        </svg>
    );
}

export function SunIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
    );
}

export function MoonIcon(props) {
    return (
        <svg {...base} {...props} aria-hidden="true">
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
    );
}
