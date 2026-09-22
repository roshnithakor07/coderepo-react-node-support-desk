import { useState } from "react";
import { Modal } from "../../shared/components/Modal.jsx";
import { Table } from "../../shared/components/Table.jsx";
import { Badge } from "../../shared/components/Badge.jsx";

export function AgentsPage({ agents, onCreateAgent, onSetActive, isAdmin, error, isBusy }) {
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    function handleSubmit(event) {
        event.preventDefault();
        onCreateAgent({ name, email, password }).then(() => {
            setShowCreate(false);
            setName("");
            setEmail("");
            setPassword("");
        });
    }

    return (
        <section className="panel">
            <div className="panel-header">
                <h2>Agents</h2>
                {isAdmin && (
                    <button type="button" className="button-primary" onClick={() => setShowCreate(true)}>
                        Add agent
                    </button>
                )}
            </div>

            <Table
                rowKey={(row) => row._id}
                emptyMessage="No agents yet."
                rows={agents}
                columns={[
                    { key: "name", header: "Name" },
                    { key: "email", header: "Email" },
                    { key: "openTicketCount", header: "Open tickets", render: (row) => row.openTicketCount ?? 0 },
                    { key: "isActive", header: "Status", render: (row) => <Badge tone={row.isActive ? "success" : "neutral"}>{row.isActive ? "Active" : "Inactive"}</Badge> },
                    {
                        key: "actions",
                        header: "",
                        render: (row) =>
                            isAdmin ? (
                                <button type="button" className="link-button" onClick={() => onSetActive(row._id, !row.isActive)}>
                                    {row.isActive ? "Deactivate" : "Activate"}
                                </button>
                            ) : null,
                    },
                ]}
            />

            {showCreate && (
                <Modal onClose={() => setShowCreate(false)} label="Add agent" className="modal-form">
                    <h2>Add agent</h2>
                    <form onSubmit={handleSubmit}>
                        <label>
                            Full name
                            <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} autoFocus placeholder="Jordan Lee" />
                        </label>
                        <label>
                            Email
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                                maxLength={160}
                                placeholder="jordan.lee@supportdesk.io"
                            />
                        </label>
                        <label>
                            Temporary password
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                                minLength={8}
                                maxLength={100}
                                placeholder="At least 8 characters"
                            />
                        </label>
                        {error && <p className="form-error">{error}</p>}
                        <div className="modal-actions">
                            <button type="button" className="button-secondary" onClick={() => setShowCreate(false)}>
                                Cancel
                            </button>
                            <button type="submit" className="button-primary" disabled={isBusy}>
                                {isBusy ? "Adding..." : "Add agent"}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </section>
    );
}
