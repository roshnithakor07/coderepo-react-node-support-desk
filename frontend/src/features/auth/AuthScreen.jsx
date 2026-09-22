import { useState } from "react";

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
                            <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} autoComplete="name" />
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
                        />
                    </label>
                    {error && <p className="form-error">{error}</p>}
                    <button type="submit" className="button-primary" disabled={isBusy}>
                        {isBusy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
                    </button>
                </form>
                {mode === "register" && <p className="auth-hint">New accounts are created as customers. Agent and admin access is provisioned by an admin.</p>}
            </div>
        </div>
    );
}
