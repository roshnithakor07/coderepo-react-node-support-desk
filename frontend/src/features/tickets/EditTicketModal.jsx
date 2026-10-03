import { useState } from "react";
import { Modal } from "../../shared/components/Modal.jsx";
import { validateRequired } from "../../shared/utils/validate.js";

// Correcting what the ticket says. A requester gets this only while the ticket is open and unanswered
// (the server decides, and the page hides the button with the reason otherwise); the support team
// gets it for as long as the ticket is not closed.
export function EditTicketModal({ ticket, onClose, onSave, error, isBusy }) {
    const [title, setTitle] = useState(ticket.title);
    const [description, setDescription] = useState(ticket.description);
    const [fieldErrors, setFieldErrors] = useState({});

    const isDirty = title !== ticket.title || description !== ticket.description;

    function handleSubmit(event) {
        event.preventDefault();
        const errors = {};
        const titleError = validateRequired(title, "Title");
        const descriptionError = validateRequired(description, "Description");
        if (titleError) errors.title = titleError;
        if (descriptionError) errors.description = descriptionError;
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;
        onSave({ title: title.trim(), description: description.trim() });
    }

    return (
        <Modal onClose={onClose} label="Edit ticket" className="modal-form">
            <h2>Edit ticket</h2>
            <form onSubmit={handleSubmit} noValidate>
                <label htmlFor="edit-ticket-title">
                    <span className="label-row">
                        Title<span className="required-mark">*</span>
                    </span>
                    <input
                        id="edit-ticket-title"
                        value={title}
                        onChange={(event) => {
                            setTitle(event.target.value);
                            if (fieldErrors.title) setFieldErrors((current) => ({ ...current, title: undefined }));
                        }}
                        maxLength={140}
                        autoFocus
                        aria-invalid={Boolean(fieldErrors.title)}
                        aria-describedby={fieldErrors.title ? "edit-ticket-title-error" : undefined}
                        className={fieldErrors.title ? "field-invalid" : ""}
                        disabled={isBusy}
                    />
                    {fieldErrors.title && (
                        <span className="field-error" id="edit-ticket-title-error">
                            {fieldErrors.title}
                        </span>
                    )}
                </label>
                <label htmlFor="edit-ticket-description">
                    <span className="label-row">
                        Description<span className="required-mark">*</span>
                    </span>
                    <textarea
                        id="edit-ticket-description"
                        value={description}
                        onChange={(event) => {
                            setDescription(event.target.value);
                            if (fieldErrors.description) setFieldErrors((current) => ({ ...current, description: undefined }));
                        }}
                        rows={6}
                        maxLength={5000}
                        aria-invalid={Boolean(fieldErrors.description)}
                        aria-describedby={fieldErrors.description ? "edit-ticket-description-error" : undefined}
                        className={fieldErrors.description ? "field-invalid" : ""}
                        disabled={isBusy}
                    />
                    {fieldErrors.description && (
                        <span className="field-error" id="edit-ticket-description-error">
                            {fieldErrors.description}
                        </span>
                    )}
                </label>
                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="modal-actions">
                    <button type="button" className="button-secondary" onClick={onClose} disabled={isBusy}>
                        Cancel
                    </button>
                    <button type="submit" className="button-primary" disabled={isBusy || !isDirty}>
                        {isBusy && <span className="spinner" aria-hidden="true" />}
                        {isBusy ? "Saving..." : "Save changes"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
