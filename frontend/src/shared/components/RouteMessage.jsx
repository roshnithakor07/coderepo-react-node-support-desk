import { AlertCircleIcon, LockIcon, SearchIcon } from "./Icon.jsx";
import { toHash } from "../utils/router.js";
import { HOME_PATH } from "../utils/routes.js";

const MESSAGES = {
    forbidden: {
        Icon: LockIcon,
        title: "You don't have access",
        description: "Your account can't open this page. If you think it should, ask an admin.",
    },
    "ticket-forbidden": {
        Icon: LockIcon,
        title: "You don't have access",
        description: "This ticket belongs to someone else, or it is no longer assigned to you.",
    },
    "not-found": {
        Icon: SearchIcon,
        title: "Page not found",
        description: "There is nothing at this address. The link may be mistyped or out of date.",
    },
    "ticket-not-found": {
        Icon: SearchIcon,
        title: "Ticket not found",
        description: "This ticket doesn't exist. The link may be mistyped or out of date.",
    },
    "load-failed": {
        Icon: AlertCircleIcon,
        title: "Couldn't load this page",
        description: "Something went wrong on our side or the connection dropped.",
    },
};

// The page shown instead of a blank screen when a URL can't be opened: it says why, and always
// offers a way back.
export function RouteMessage({ kind, detail, onRetry }) {
    const { Icon, title, description } = MESSAGES[kind];
    return (
        <section className="panel route-message" role={kind === "load-failed" ? "alert" : undefined}>
            <div className="empty-state">
                <Icon className="empty-state-icon" />
                <h2 className="empty-state-title">{title}</h2>
                <p className="empty-state-description">{detail || description}</p>
                <div className="route-message-actions">
                    {onRetry && (
                        <button type="button" className="button-primary" onClick={onRetry}>
                            Try again
                        </button>
                    )}
                    <a className={onRetry ? "button-secondary" : "button-primary"} href={toHash(HOME_PATH)}>
                        Go to dashboard
                    </a>
                </div>
            </div>
        </section>
    );
}
