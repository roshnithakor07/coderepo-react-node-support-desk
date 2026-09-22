import { useState } from "react";
import { Modal } from "../../shared/components/Modal.jsx";

const CATEGORIES = ["general", "billing", "technical", "account"];

export function NewTicketModal({ onClose, onCreate, isBusy, error }) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("medium");
    const [category, setCategory] = useState("general");

    function handleSubmit(event) {
        event.preventDefault();
        onCreate({ title, description, priority, category });
    }

    return (
        <Modal onClose={onClose} label="Create ticket" className="modal-form">
            <h2>New ticket</h2>
            <form onSubmit={handleSubmit}>
                <label>
                    Title
                    <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        maxLength={140}
                        autoFocus
                        placeholder="e.g. Cannot log into my account"
                    />
                </label>
                <label>
                    Description
                    <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        required
                        maxLength={5000}
                        rows={5}
                        placeholder="Describe what's happening, when it started, and any steps you've already tried."
                    />
                </label>
                <div className="form-row">
                    <label>
                        Priority
                        <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                    </label>
                    <label>
                        Category
                        <select value={category} onChange={(event) => setCategory(event.target.value)}>
                            {CATEGORIES.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                {error && <p className="form-error">{error}</p>}
                <div className="modal-actions">
                    <button type="button" className="button-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="submit" className="button-primary" disabled={isBusy}>
                        {isBusy ? "Creating..." : "Create ticket"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
