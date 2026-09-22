import { useState } from "react";
import { Modal } from "../../shared/components/Modal.jsx";
import { validateMaxLength, validateRequired } from "../../shared/utils/validate.js";

const CATEGORIES = ["general", "billing", "technical", "account"];

export function NewTicketModal({ onClose, onCreate, isBusy, error }) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("medium");
    const [category, setCategory] = useState("general");
    const [fieldErrors, setFieldErrors] = useState({});

    function validate() {
        const errors = {};
        const titleError = validateRequired(title, "Title") || validateMaxLength(title, 140, "Title");
        const descriptionError = validateRequired(description, "Description") || validateMaxLength(description, 5000, "Description");
        if (titleError) errors.title = titleError;
        if (descriptionError) errors.description = descriptionError;
        return errors;
    }

    function handleSubmit(event) {
        event.preventDefault();
        const errors = validate();
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;
        onCreate({ title: title.trim(), description: description.trim(), priority, category });
    }

    return (
        <Modal onClose={onClose} label="Create ticket" className="modal-form">
            <h2>New ticket</h2>
            <form onSubmit={handleSubmit} noValidate>
                <label htmlFor="ticket-title">
                    <span className="label-row">
                        Title<span className="required-mark">*</span>
                    </span>
                    <input
                        id="ticket-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        maxLength={140}
                        autoFocus
                        placeholder="e.g. Cannot log into my account"
                        aria-invalid={Boolean(fieldErrors.title)}
                        aria-describedby={fieldErrors.title ? "ticket-title-error" : undefined}
                        className={fieldErrors.title ? "field-invalid" : ""}
                        disabled={isBusy}
                    />
                    {fieldErrors.title && (
                        <span className="field-error" id="ticket-title-error">
                            {fieldErrors.title}
                        </span>
                    )}
                </label>
                <label htmlFor="ticket-description">
                    <span className="label-row">
                        Description<span className="required-mark">*</span>
                    </span>
                    <textarea
                        id="ticket-description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        maxLength={5000}
                        rows={5}
                        placeholder="Describe what's happening, when it started, and any steps you've already tried."
                        aria-invalid={Boolean(fieldErrors.description)}
                        aria-describedby={fieldErrors.description ? "ticket-description-error" : undefined}
                        className={fieldErrors.description ? "field-invalid" : ""}
                        disabled={isBusy}
                    />
                    {fieldErrors.description && (
                        <span className="field-error" id="ticket-description-error">
                            {fieldErrors.description}
                        </span>
                    )}
                </label>
                <div className="form-row">
                    <label htmlFor="ticket-priority">
                        Priority
                        <select id="ticket-priority" value={priority} onChange={(event) => setPriority(event.target.value)} disabled={isBusy}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                    </label>
                    <label htmlFor="ticket-category">
                        Category
                        <select id="ticket-category" value={category} onChange={(event) => setCategory(event.target.value)} disabled={isBusy}>
                            {CATEGORIES.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="modal-actions">
                    <button type="button" className="button-secondary" onClick={onClose} disabled={isBusy}>
                        Cancel
                    </button>
                    <button type="submit" className="button-primary" disabled={isBusy}>
                        {isBusy && <span className="spinner" aria-hidden="true" />}
                        {isBusy ? "Creating..." : "Create ticket"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
