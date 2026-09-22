import { useState } from "react";
import { validateEmail, validatePassword, validateRequired } from "../../shared/utils/validate.js";

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
    const [fieldErrors, setFieldErrors] = useState({});
    const [touched, setTouched] = useState({});

    function validateField(field, values = { name, email, password }) {
        if (field === "name") return mode === "register" ? validateRequired(values.name, "Full name") : "";
        if (field === "email") return validateEmail(values.email);
        if (field === "password") return validatePassword(values.password, mode === "login" ? 1 : 8);
        return "";
    }

    function validateAll() {
        const fields = mode === "register" ? ["name", "email", "password"] : ["email", "password"];
        const errors = {};
        fields.forEach((field) => {
            const message = validateField(field);
            if (message) errors[field] = message;
        });
        return errors;
    }

    function handleBlur(field) {
        setTouched((current) => ({ ...current, [field]: true }));
        setFieldErrors((current) => ({ ...current, [field]: validateField(field) }));
    }

    function handleChange(field, value) {
        if (field === "name") setName(value);
        if (field === "email") setEmail(value);
        if (field === "password") setPassword(value);
        if (touched[field]) {
            const values = { name, email, password, [field]: value };
            setFieldErrors((current) => ({ ...current, [field]: validateField(field, values) }));
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        const errors = validateAll();
        setFieldErrors(errors);
        setTouched({ name: true, email: true, password: true });
        if (Object.keys(errors).length > 0) return;
        if (mode === "login") onLogin({ email: email.trim(), password });
        else onRegister({ name: name.trim(), email: email.trim(), password });
    }

    function switchMode(nextMode) {
        setMode(nextMode);
        setFieldErrors({});
        setTouched({});
    }

    function handleQuickFill(account) {
        switchMode("login");
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
                <div className="auth-tabs" role="tablist" aria-label="Sign in or create an account">
                    <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>
                        Sign in
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === "register"}
                        className={mode === "register" ? "active" : ""}
                        onClick={() => switchMode("register")}
                    >
                        Create account
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="auth-form" noValidate>
                    {mode === "register" && (
                        <label htmlFor="auth-name">
                            Full name
                            <input
                                id="auth-name"
                                value={name}
                                onChange={(event) => handleChange("name", event.target.value)}
                                onBlur={() => handleBlur("name")}
                                maxLength={80}
                                autoComplete="name"
                                placeholder="Jordan Lee"
                                aria-invalid={Boolean(fieldErrors.name)}
                                aria-describedby={fieldErrors.name ? "auth-name-error" : undefined}
                                className={fieldErrors.name ? "field-invalid" : ""}
                            />
                            {fieldErrors.name && (
                                <span className="field-error" id="auth-name-error">
                                    {fieldErrors.name}
                                </span>
                            )}
                        </label>
                    )}
                    <label htmlFor="auth-email">
                        Email
                        <input
                            id="auth-email"
                            type="email"
                            value={email}
                            onChange={(event) => handleChange("email", event.target.value)}
                            onBlur={() => handleBlur("email")}
                            maxLength={160}
                            autoComplete="email"
                            placeholder="admin1@supportdesk.io"
                            aria-invalid={Boolean(fieldErrors.email)}
                            aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
                            className={fieldErrors.email ? "field-invalid" : ""}
                        />
                        {fieldErrors.email && (
                            <span className="field-error" id="auth-email-error">
                                {fieldErrors.email}
                            </span>
                        )}
                    </label>
                    <label htmlFor="auth-password">
                        Password
                        <input
                            id="auth-password"
                            type="password"
                            value={password}
                            onChange={(event) => handleChange("password", event.target.value)}
                            onBlur={() => handleBlur("password")}
                            maxLength={100}
                            autoComplete={mode === "login" ? "current-password" : "new-password"}
                            placeholder={mode === "login" ? "SupportDesk@2026" : "At least 8 characters"}
                            aria-invalid={Boolean(fieldErrors.password)}
                            aria-describedby={fieldErrors.password ? "auth-password-error" : undefined}
                            className={fieldErrors.password ? "field-invalid" : ""}
                        />
                        {fieldErrors.password && (
                            <span className="field-error" id="auth-password-error">
                                {fieldErrors.password}
                            </span>
                        )}
                    </label>
                    {error && (
                        <p className="form-error" role="alert">
                            {error}
                        </p>
                    )}
                    <button type="submit" className="button-primary" disabled={isBusy}>
                        {isBusy && <span className="spinner" aria-hidden="true" />}
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
