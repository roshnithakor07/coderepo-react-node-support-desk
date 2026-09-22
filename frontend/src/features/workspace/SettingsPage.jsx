import { useEffect, useState } from "react";

const PRIORITIES = ["critical", "high", "medium", "low"];

export function SettingsPage({ settings, onSave, isBusy, error }) {
    const [slaHours, setSlaHours] = useState(settings?.slaHours || { critical: 1, high: 4, medium: 8, low: 24 });
    const [categories, setCategories] = useState((settings?.categories || []).join(", "));
    const [fieldErrors, setFieldErrors] = useState({});

    useEffect(() => {
        if (settings) {
            setSlaHours(settings.slaHours);
            setCategories(settings.categories.join(", "));
        }
    }, [settings]);

    function validate(parsedCategories) {
        const errors = {};
        PRIORITIES.forEach((priority) => {
            const value = slaHours[priority];
            if (!Number.isFinite(value) || value < 1) errors[priority] = "Must be at least 1 hour.";
        });
        if (parsedCategories.length === 0) errors.categories = "Add at least one category.";
        return errors;
    }

    function handleSubmit(event) {
        event.preventDefault();
        const parsedCategories = categories
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
        const errors = validate(parsedCategories);
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;
        onSave({ slaHours, categories: parsedCategories });
    }

    if (!settings) {
        return (
            <section className="panel">
                <h2>SLA &amp; category settings</h2>
                <div className="settings-form">
                    <span className="skeleton skeleton-block" />
                    <span className="skeleton skeleton-block" style={{ width: "60%" }} />
                </div>
            </section>
        );
    }

    return (
        <section className="panel">
            <h2>SLA &amp; category settings</h2>
            <p className="panel-subtitle">Response-time targets apply to every new ticket, based on its priority.</p>
            <form onSubmit={handleSubmit} className="settings-form" noValidate>
                <h3>SLA response targets (hours)</h3>
                <div className="form-row">
                    {PRIORITIES.map((priority) => (
                        <label key={priority} htmlFor={`sla-${priority}`}>
                            {priority}
                            <input
                                id={`sla-${priority}`}
                                type="number"
                                min={1}
                                value={slaHours[priority]}
                                onChange={(event) => setSlaHours({ ...slaHours, [priority]: Number(event.target.value) })}
                                aria-invalid={Boolean(fieldErrors[priority])}
                                aria-describedby={fieldErrors[priority] ? `sla-${priority}-error` : undefined}
                                className={fieldErrors[priority] ? "field-invalid" : ""}
                                disabled={isBusy}
                            />
                            {fieldErrors[priority] && (
                                <span className="field-error" id={`sla-${priority}-error`}>
                                    {fieldErrors[priority]}
                                </span>
                            )}
                        </label>
                    ))}
                </div>
                <label htmlFor="settings-categories">
                    Categories (comma-separated)
                    <input
                        id="settings-categories"
                        value={categories}
                        onChange={(event) => setCategories(event.target.value)}
                        placeholder="general, billing, technical, account"
                        aria-invalid={Boolean(fieldErrors.categories)}
                        aria-describedby={fieldErrors.categories ? "settings-categories-error" : undefined}
                        className={fieldErrors.categories ? "field-invalid" : ""}
                        disabled={isBusy}
                    />
                    {fieldErrors.categories && (
                        <span className="field-error" id="settings-categories-error">
                            {fieldErrors.categories}
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
                    {isBusy ? "Saving..." : "Save settings"}
                </button>
            </form>
        </section>
    );
}
