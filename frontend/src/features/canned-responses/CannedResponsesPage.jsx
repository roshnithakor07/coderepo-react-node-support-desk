import { useState } from "react";
import { Modal } from "../../shared/components/Modal.jsx";
import { Badge } from "../../shared/components/Badge.jsx";
import { ConfirmationDialog } from "../../shared/components/ConfirmationDialog.jsx";
import { InboxIcon } from "../../shared/components/Icon.jsx";
import { validateMaxLength, validateRequired } from "../../shared/utils/validate.js";

export function CannedResponsesPage({ responses, onCreate, onDelete, currentUser, error, loadError, onRetry, isLoading, isBusy }) {
    const [showCreate, setShowCreate] = useState(false);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [category, setCategory] = useState("general");
    const [fieldErrors, setFieldErrors] = useState({});
    const [responseToDelete, setResponseToDelete] = useState(null);

    function validate() {
        const errors = {};
        const titleError = validateRequired(title, "Title") || validateMaxLength(title, 120, "Title");
        const bodyError = validateRequired(body, "Body");
        const categoryError = validateRequired(category, "Category");
        if (titleError) errors.title = titleError;
        if (bodyError) errors.body = bodyError;
        if (categoryError) errors.category = categoryError;
        return errors;
    }

    function handleSubmit(event) {
        event.preventDefault();
        const errors = validate();
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;
        onCreate({ title: title.trim(), body: body.trim(), category: category.trim() })
            .then(() => {
                setShowCreate(false);
                setTitle("");
                setBody("");
                setCategory("general");
                setFieldErrors({});
            })
            .catch(() => {
                // Failure is already surfaced inline via the `error` prop.
            });
    }

    function closeCreate() {
        setShowCreate(false);
        setFieldErrors({});
    }

    function confirmDelete() {
        onDelete(responseToDelete._id);
        setResponseToDelete(null);
    }

    return (
        <section className="panel">
            <div className="panel-header">
                <div>
                    <p className="panel-count">
                        {responses.length} {responses.length === 1 ? "template" : "templates"}
                    </p>
                    <p className="panel-subtitle">
                        {currentUser.role === "admin"
                            ? "Reusable reply text. Templates you create are shared with every agent."
                            : "Reusable reply text you can insert into any ticket. Your own templates are private to you."}
                    </p>
                </div>
                <button type="button" className="button-primary" onClick={() => setShowCreate(true)}>
                    New template
                </button>
            </div>

            {loadError ? (
                <div className="form-error" role="alert">
                    {loadError}{" "}
                    <button type="button" className="link-button" onClick={onRetry}>
                        Retry
                    </button>
                </div>
            ) : isLoading ? (
                <div className="canned-response-grid" aria-busy="true">
                    {[0, 1, 2, 3].map((card) => (
                        <article key={card} className="canned-response-card">
                            <span className="skeleton skeleton-block" style={{ height: "18px", width: "60%" }} />
                            <span className="skeleton skeleton-block" style={{ height: "14px", width: "30%" }} />
                            <span className="skeleton skeleton-block" style={{ height: "56px" }} />
                        </article>
                    ))}
                </div>
            ) : responses.length === 0 ? (
                <div className="empty-state">
                    <InboxIcon className="empty-state-icon" />
                    <p className="empty-state-title">No canned responses yet</p>
                    <p className="empty-state-description">Create your first template to speed up replies for common questions.</p>
                    <button type="button" className="button-primary" onClick={() => setShowCreate(true)}>
                        New template
                    </button>
                </div>
            ) : (
                <div className="canned-response-grid">
                    {responses.map((response) => {
                        const canDelete = currentUser.role === "admin" || response.createdBy === currentUser.id;
                        return (
                            <article key={response._id} className="canned-response-card">
                                <header>
                                    <h3>{response.title}</h3>
                                    <Badge tone={response.isGlobal ? "info" : "neutral"}>{response.isGlobal ? "Global" : "Personal"}</Badge>
                                </header>
                                <span className="tag">{response.category}</span>
                                <p className="canned-response-body">{response.body}</p>
                                {canDelete && (
                                    <button
                                        type="button"
                                        className="link-button link-button-danger"
                                        onClick={() => setResponseToDelete(response)}
                                    >
                                        Delete
                                    </button>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}

            {showCreate && (
                <Modal onClose={closeCreate} label="New canned response" className="modal-form">
                    <h2>New template</h2>
                    <form onSubmit={handleSubmit} noValidate>
                        <label htmlFor="canned-title">
                            <span className="label-row">
                                Title<span className="required-mark">*</span>
                            </span>
                            <input
                                id="canned-title"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                maxLength={120}
                                autoFocus
                                placeholder="e.g. Billing - Refund Processed"
                                aria-invalid={Boolean(fieldErrors.title)}
                                aria-describedby={fieldErrors.title ? "canned-title-error" : undefined}
                                className={fieldErrors.title ? "field-invalid" : ""}
                                disabled={isBusy}
                            />
                            {fieldErrors.title && (
                                <span className="field-error" id="canned-title-error">
                                    {fieldErrors.title}
                                </span>
                            )}
                        </label>
                        <label htmlFor="canned-category">
                            <span className="label-row">
                                Category<span className="required-mark">*</span>
                            </span>
                            <input
                                id="canned-category"
                                value={category}
                                onChange={(event) => setCategory(event.target.value)}
                                maxLength={60}
                                placeholder="billing"
                                aria-invalid={Boolean(fieldErrors.category)}
                                aria-describedby={fieldErrors.category ? "canned-category-error" : undefined}
                                className={fieldErrors.category ? "field-invalid" : ""}
                                disabled={isBusy}
                            />
                            {fieldErrors.category && (
                                <span className="field-error" id="canned-category-error">
                                    {fieldErrors.category}
                                </span>
                            )}
                        </label>
                        <label htmlFor="canned-body">
                            <span className="label-row">
                                Body<span className="required-mark">*</span>
                            </span>
                            <textarea
                                id="canned-body"
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                maxLength={3000}
                                rows={5}
                                placeholder="Write the reusable reply text agents will insert into the reply box."
                                aria-invalid={Boolean(fieldErrors.body)}
                                aria-describedby={fieldErrors.body ? "canned-body-error" : undefined}
                                className={fieldErrors.body ? "field-invalid" : ""}
                                disabled={isBusy}
                            />
                            {fieldErrors.body && (
                                <span className="field-error" id="canned-body-error">
                                    {fieldErrors.body}
                                </span>
                            )}
                        </label>
                        {error && (
                            <p className="form-error" role="alert">
                                {error}
                            </p>
                        )}
                        <div className="modal-actions">
                            <button type="button" className="button-secondary" onClick={closeCreate} disabled={isBusy}>
                                Cancel
                            </button>
                            <button type="submit" className="button-primary" disabled={isBusy}>
                                {isBusy && <span className="spinner" aria-hidden="true" />}
                                {isBusy ? "Saving..." : "Save template"}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
            {responseToDelete && (
                <ConfirmationDialog
                    title="Delete this template?"
                    message={`"${responseToDelete.title}" will be permanently deleted${responseToDelete.isGlobal ? " for every agent" : ""}. This can't be undone.`}
                    confirmLabel="Delete"
                    danger
                    onCancel={() => setResponseToDelete(null)}
                    onConfirm={confirmDelete}
                />
            )}
        </section>
    );
}
