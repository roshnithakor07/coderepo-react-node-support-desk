import { useState } from "react";
import { Modal } from "../../shared/components/Modal.jsx";
import { Badge } from "../../shared/components/Badge.jsx";

export function CannedResponsesPage({ responses, onCreate, onDelete, currentUser, error, isBusy }) {
    const [showCreate, setShowCreate] = useState(false);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [category, setCategory] = useState("general");

    function handleSubmit(event) {
        event.preventDefault();
        onCreate({ title, body, category }).then(() => {
            setShowCreate(false);
            setTitle("");
            setBody("");
            setCategory("general");
        });
    }

    return (
        <section className="panel">
            <div className="panel-header">
                <h2>Canned responses</h2>
                <button type="button" className="button-primary" onClick={() => setShowCreate(true)}>
                    New template
                </button>
            </div>

            <div className="canned-response-grid">
                {responses.length === 0 && <p className="table-empty">No canned responses yet.</p>}
                {responses.map((response) => {
                    const canDelete = currentUser.role === "admin" || response.createdBy === currentUser.id;
                    return (
                        <article key={response._id} className="canned-response-card">
                            <header>
                                <h3>{response.title}</h3>
                                <Badge tone={response.isGlobal ? "info" : "neutral"}>{response.isGlobal ? "Global" : "Personal"}</Badge>
                            </header>
                            <p className="canned-response-category">{response.category}</p>
                            <p>{response.body}</p>
                            {canDelete && (
                                <button type="button" className="link-button" onClick={() => onDelete(response._id)}>
                                    Delete
                                </button>
                            )}
                        </article>
                    );
                })}
            </div>

            {showCreate && (
                <Modal onClose={() => setShowCreate(false)} label="New canned response" className="modal-form">
                    <h2>New template</h2>
                    <form onSubmit={handleSubmit}>
                        <label>
                            Title
                            <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} autoFocus />
                        </label>
                        <label>
                            Category
                            <input value={category} onChange={(event) => setCategory(event.target.value)} required maxLength={60} />
                        </label>
                        <label>
                            Body
                            <textarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={3000} rows={5} />
                        </label>
                        {error && <p className="form-error">{error}</p>}
                        <div className="modal-actions">
                            <button type="button" className="button-secondary" onClick={() => setShowCreate(false)}>
                                Cancel
                            </button>
                            <button type="submit" className="button-primary" disabled={isBusy}>
                                {isBusy ? "Saving..." : "Save template"}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </section>
    );
}
