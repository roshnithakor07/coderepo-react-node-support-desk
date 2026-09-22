import { useState } from "react";

const DEMO_PASSWORD = "SupportDesk@2026";
const DEMO_ACCOUNTS = [
    { role: "Admin", email: "admin1@supportdesk.io" },
    { role: "Agent", email: "agent1@supportdesk.io" },
    { role: "Customer", email: "customer1@supportdesk.io" },
];

export function AuthScreen({ onLogin, onRegister, error, isBusy }) {
    const [mode, setMode] = useState("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    function handleSubmit(event) {
        event.preventDefault();
        if (mode === "login") onLogin({ email, password });
        else onRegister({ name, email, password });
    }

    function handleQuickFill(account) {
        setMode("login");
        setEmail(account.email);
        setPassword(DEMO_PASSWORD);
    }

    return (
        <div className="auth-screen">
            <div className="auth-card">
                <div className="auth-brand">
                    <img src="/favicon.svg" alt="" className="auth-brand-icon" />
                    <span>Support Desk</span>
                </div>
                <div className="auth-tabs">
                    <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
                        Sign in
                    </button>
                    <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
                        Create account
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="auth-form">
                    {mode === "register" && (
                        <label>
                            Full name
                            <input
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                required
                                maxLength={80}
                                autoComplete="name"
                                placeholder="Jordan Lee"
                            />
                        </label>
                    )}
                    <label>
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            maxLength={160}
                            autoComplete="email"
                            placeholder="admin1@supportdesk.io"
                        />
                    </label>
                    <label>
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            minLength={8}
                            maxLength={100}
                            autoComplete={mode === "login" ? "current-password" : "new-password"}
                            placeholder={mode === "login" ? "SupportDesk@2026" : "At least 8 characters"}
                        />
                    </label>
                    {error && <p className="form-error">{error}</p>}
                    <button type="submit" className="button-primary" disabled={isBusy}>
                        {isBusy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
                    </button>
                </form>
                {mode === "register" && <p className="auth-hint">New accounts are created as customers. Agent and admin access is provisioned by an admin.</p>}

                {mode === "login" && (
                    <div className="demo-accounts">
                        <p className="auth-hint">Demo accounts for testing (password: {DEMO_PASSWORD}):</p>
                        <div className="demo-account-list">
                            {DEMO_ACCOUNTS.map((account) => (
                                <button type="button" key={account.role} className="demo-account-chip" onClick={() => handleQuickFill(account)}>
                                    <span className="demo-account-role">{account.role}</span>
                                    <span className="demo-account-email">{account.email}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
