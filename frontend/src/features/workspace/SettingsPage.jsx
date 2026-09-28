import { useEffect, useState } from "react";
import { PriorityBadge } from "../../shared/components/Badge.jsx";
import { ClockIcon, CloseIcon, PlusIcon, TagIcon } from "../../shared/components/Icon.jsx";
import { titleCase } from "../../shared/utils/format.js";

const PRIORITIES = ["critical", "high", "medium", "low"];
const MAX_SLA_HOURS = 720;
const MAX_CATEGORIES = 20;

export function SettingsPage({ settings, onSave, isBusy, error }) {
    const [slaHours, setSlaHours] = useState(settings?.slaHours || { critical: 1, high: 4, medium: 8, low: 24 });
    const [categories, setCategories] = useState(settings?.categories || []);
    const [newCategory, setNewCategory] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});

    useEffect(() => {
        if (settings) {
            setSlaHours(settings.slaHours);
            setCategories(settings.categories);
        }
    }, [settings]);

    const isDirty =
        settings &&
        (JSON.stringify(slaHours) !== JSON.stringify(settings.slaHours) ||
            JSON.stringify(categories) !== JSON.stringify(settings.categories));

    function updateHours(priority, value) {
        setSlaHours({ ...slaHours, [priority]: value === "" ? "" : Number(value) });
        setFieldErrors((current) => ({ ...current, [priority]: undefined }));
    }

    function handleAddCategory(event) {
        event.preventDefault();
        const value = newCategory.trim();
        if (!value) {
            setFieldErrors((current) => ({ ...current, newCategory: "Enter a category name." }));
            return;
        }
        if (categories.some((category) => category.toLowerCase() === value.toLowerCase())) {
            setFieldErrors((current) => ({ ...current, newCategory: "That category already exists." }));
            return;
        }
        if (categories.length >= MAX_CATEGORIES) {
            setFieldErrors((current) => ({ ...current, newCategory: `You can have up to ${MAX_CATEGORIES} categories.` }));
            return;
        }
        setCategories([...categories, value]);
        setNewCategory("");
        setFieldErrors((current) => ({ ...current, newCategory: undefined, categories: undefined }));
    }

    function handleRemoveCategory(category) {
        setCategories(categories.filter((existing) => existing !== category));
    }

    function validate() {
        const errors = {};
        PRIORITIES.forEach((priority) => {
            const value = slaHours[priority];
            if (!Number.isFinite(value) || value < 1) errors[priority] = "Must be at least 1 hour.";
            else if (!Number.isInteger(value)) errors[priority] = "Use whole hours.";
            else if (value > MAX_SLA_HOURS) errors[priority] = `Must be ${MAX_SLA_HOURS} hours (30 days) or less.`;
        });
        if (categories.length === 0) errors.categories = "Add at least one category.";
        return errors;
    }

    function handleSubmit(event) {
        event.preventDefault();
        const errors = validate();
        setFieldErrors((current) => ({ ...current, ...errors }));
        if (Object.keys(errors).length > 0) return;
        onSave({ slaHours, categories });
    }

    function handleReset() {
        setSlaHours(settings.slaHours);
        setCategories(settings.categories);
        setFieldErrors({});
        setNewCategory("");
    }

    if (!settings) {
        return (
            <section className="panel">
                <h2>SLA &amp; category settings</h2>
                <div className="settings-form">
                    <span className="skeleton skeleton-block" style={{ height: "140px" }} />
                    <span className="skeleton skeleton-block" style={{ height: "120px" }} />
                </div>
            </section>
        );
    }

    return (
        <section className="panel">
            <h2>SLA &amp; category settings</h2>
            <p className="panel-subtitle">Response-time targets apply to every new ticket, based on its priority.</p>
            <form onSubmit={handleSubmit} className="settings-form" noValidate>
                <div className="settings-section">
                    <div className="settings-section-header">
                        <ClockIcon className="settings-section-icon" />
                        <div>
                            <h3>SLA response targets</h3>
                            <p className="settings-section-description">
                                How quickly agents must respond after a ticket comes in, per priority.
                            </p>
                        </div>
                    </div>
                    <div className="sla-rows">
                        {PRIORITIES.map((priority) => (
                            <div className="sla-row" key={priority}>
                                <PriorityBadge priority={priority} />
                                <label htmlFor={`sla-${priority}`} className="visually-hidden">
                                    {priority} response target, in hours
                                </label>
                                <div className="sla-row-input">
                                    <input
                                        id={`sla-${priority}`}
                                        type="number"
                                        min={1}
                                        max={MAX_SLA_HOURS}
                                        step={1}
                                        value={slaHours[priority]}
                                        onChange={(event) => updateHours(priority, event.target.value)}
                                        aria-invalid={Boolean(fieldErrors[priority])}
                                        aria-describedby={fieldErrors[priority] ? `sla-${priority}-error` : undefined}
                                        className={fieldErrors[priority] ? "field-invalid" : ""}
                                        disabled={isBusy}
                                    />
                                    <span className="sla-row-unit">hours</span>
                                </div>
                                {fieldErrors[priority] && (
                                    <span className="field-error" id={`sla-${priority}-error`}>
                                        {fieldErrors[priority]}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="settings-section">
                    <div className="settings-section-header">
                        <TagIcon className="settings-section-icon" />
                        <div>
                            <h3>Categories</h3>
                            <p className="settings-section-description">The categories tickets can be organized under.</p>
                        </div>
                    </div>

                    {categories.length > 0 ? (
                        <ul className="category-tag-list">
                            {categories.map((category) => (
                                <li key={category}>
                                    <span className="tag category-tag">
                                        {titleCase(category)}
                                        <button
                                            type="button"
                                            className="category-tag-remove"
                                            onClick={() => handleRemoveCategory(category)}
                                            aria-label={`Remove ${category} category`}
                                            disabled={isBusy}
                                        >
                                            <CloseIcon />
                                        </button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="settings-section-description">No categories yet - add one below.</p>
                    )}

                    <div className="category-add-row">
                        <label htmlFor="new-category" className="visually-hidden">
                            New category name
                        </label>
                        <input
                            id="new-category"
                            value={newCategory}
                            onChange={(event) => {
                                setNewCategory(event.target.value);
                                if (fieldErrors.newCategory) setFieldErrors((current) => ({ ...current, newCategory: undefined }));
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") handleAddCategory(event);
                            }}
                            placeholder="e.g. shipping"
                            maxLength={30}
                            aria-invalid={Boolean(fieldErrors.newCategory)}
                            aria-describedby={fieldErrors.newCategory ? "new-category-error" : undefined}
                            className={fieldErrors.newCategory ? "field-invalid" : ""}
                            disabled={isBusy}
                        />
                        <button type="button" className="button-secondary" onClick={handleAddCategory} disabled={isBusy}>
                            <PlusIcon /> Add
                        </button>
                    </div>
                    {fieldErrors.newCategory && <span className="field-error">{fieldErrors.newCategory}</span>}
                    {fieldErrors.categories && <span className="field-error">{fieldErrors.categories}</span>}
                </div>

                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}

                <div className="settings-form-actions">
                    {isDirty && !isBusy && (
                        <button type="button" className="button-secondary" onClick={handleReset}>
                            Discard changes
                        </button>
                    )}
                    <button type="submit" className="button-primary" disabled={isBusy || !isDirty}>
                        {isBusy && <span className="spinner" aria-hidden="true" />}
                        {isBusy ? "Saving..." : "Save settings"}
                    </button>
                </div>
            </form>
        </section>
    );
}
