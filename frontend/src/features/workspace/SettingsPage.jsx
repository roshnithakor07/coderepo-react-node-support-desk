import { useEffect, useState } from "react";

const PRIORITIES = ["critical", "high", "medium", "low"];

export function SettingsPage({ settings, onSave, isBusy, error }) {
    const [slaHours, setSlaHours] = useState(settings?.slaHours || { critical: 1, high: 4, medium: 8, low: 24 });
    const [categories, setCategories] = useState((settings?.categories || []).join(", "));

    useEffect(() => {
        if (settings) {
            setSlaHours(settings.slaHours);
            setCategories(settings.categories.join(", "));
        }
    }, [settings]);

    function handleSubmit(event) {
        event.preventDefault();
        onSave({
            slaHours,
            categories: categories
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
        });
    }

    if (!settings) return null;

    return (
        <section className="panel">
            <h2>SLA & category settings</h2>
            <form onSubmit={handleSubmit} className="settings-form">
                <h3>SLA response targets (hours)</h3>
                <div className="form-row">
                    {PRIORITIES.map((priority) => (
                        <label key={priority}>
                            {priority}
                            <input
                                type="number"
                                min={1}
                                value={slaHours[priority]}
                                onChange={(event) => setSlaHours({ ...slaHours, [priority]: Number(event.target.value) })}
                            />
                        </label>
                    ))}
                </div>
                <label>
                    Categories (comma-separated)
                    <input value={categories} onChange={(event) => setCategories(event.target.value)} />
                </label>
                {error && <p className="form-error">{error}</p>}
                <button type="submit" className="button-primary" disabled={isBusy}>
                    {isBusy ? "Saving..." : "Save settings"}
                </button>
            </form>
        </section>
    );
}
