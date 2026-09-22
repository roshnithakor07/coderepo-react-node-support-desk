import { initials } from "../../shared/utils/format.js";

export function ProfilePage({ currentUser, onLogout, theme, onToggleTheme }) {
    return (
        <section className="panel profile-page">
            <div className="profile-header">
                <div className="profile-avatar">{initials(currentUser.name)}</div>
                <div>
                    <h2>{currentUser.name}</h2>
                    <p className="ticket-meta">{currentUser.email}</p>
                    <span className={`badge badge-info`}>{currentUser.role}</span>
                </div>
            </div>

            <div className="profile-actions">
                <label className="internal-toggle">
                    <input type="checkbox" checked={theme === "light"} onChange={onToggleTheme} />
                    Light theme
                </label>
                <button type="button" className="button-secondary" onClick={onLogout}>
                    Sign out
                </button>
            </div>
        </section>
    );
}
