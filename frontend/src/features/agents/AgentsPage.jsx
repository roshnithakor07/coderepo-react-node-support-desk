import { useMemo, useState } from "react";
import { Modal } from "../../shared/components/Modal.jsx";
import { Table } from "../../shared/components/Table.jsx";
import { Badge } from "../../shared/components/Badge.jsx";
import { validateEmail, validatePassword, validateRequired } from "../../shared/utils/validate.js";

export function AgentsPage({ agents, onCreateAgent, onSetActive, isAdmin, error, isBusy, isLoading }) {
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [sort, setSort] = useState({ key: "openTicketCount", direction: "asc" });

    const sortedAgents = useMemo(() => {
        const copy = [...agents];
        copy.sort((a, b) => {
            const left = a[sort.key] ?? 0;
            const right = b[sort.key] ?? 0;
            const comparison = typeof left === "string" ? left.localeCompare(right) : left - right;
            return sort.direction === "asc" ? comparison : -comparison;
        });
        return copy;
    }, [agents, sort]);

    function validate() {
        const errors = {};
        const nameError = validateRequired(name, "Full name");
        const emailError = validateEmail(email);
        const passwordError = validatePassword(password, 8);
        if (nameError) errors.name = nameError;
        if (emailError) errors.email = emailError;
        if (passwordError) errors.password = passwordError;
        return errors;
    }

    function handleSubmit(event) {
        event.preventDefault();
        const errors = validate();
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;
        onCreateAgent({ name: name.trim(), email: email.trim(), password })
            .then(() => {
                setShowCreate(false);
                setName("");
                setEmail("");
                setPassword("");
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

    function handleToggleActive(agent) {
        const verb = agent.isActive ? "deactivate" : "activate";
        if (agent.isActive && !window.confirm(`Deactivate ${agent.name}? They will no longer be able to sign in or receive new ticket assignments.`)) {
            return;
        }
        onSetActive(agent._id, !agent.isActive, verb);
    }

    return (
        <section className="panel">
            <div className="panel-header">
                <div>
                    <h2>Agents</h2>
                    <p className="panel-subtitle">Manage who can be assigned tickets and see live workload at a glance.</p>
                </div>
                {isAdmin && (
                    <button type="button" className="button-primary" onClick={() => setShowCreate(true)}>
                        Add agent
                    </button>
                )}
            </div>

            <Table
                rowKey={(row) => row._id}
                emptyTitle="No agents yet"
                emptyDescription="Add your first agent so tickets can be assigned and worked on."
                emptyAction={isAdmin ? { label: "Add agent", onClick: () => setShowCreate(true) } : undefined}
                rows={sortedAgents}
                isLoading={isLoading}
                sort={sort}
                onSortChange={setSort}
                columns={[
                    { key: "name", header: "Name", sortable: true },
                    { key: "email", header: "Email" },
                    { key: "openTicketCount", header: "Open tickets", sortable: true, render: (row) => <span className="mono">{row.openTicketCount ?? 0}</span> },
                    {
                        key: "isActive",
                        header: "Status",
                        render: (row) => <Badge tone={row.isActive ? "success" : "neutral"}>{row.isActive ? "Active" : "Inactive"}</Badge>,
                    },
                    {
                        key: "actions",
                        header: "",
                        render: (row) =>
                            isAdmin ? (
                                <div className="row-actions">
                                    <button type="button" className="link-button row-action" onClick={() => handleToggleActive(row)}>
                                        {row.isActive ? "Deactivate" : "Activate"}
                                    </button>
                                </div>
                            ) : null,
                    },
                ]}
            />

            {showCreate && (
                <Modal onClose={closeCreate} label="Add agent" className="modal-form">
                    <h2>Add agent</h2>
                    <form onSubmit={handleSubmit} noValidate>
                        <label htmlFor="agent-name">
                            <span className="label-row">
                                Full name<span className="required-mark">*</span>
                            </span>
                            <input
                                id="agent-name"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                maxLength={80}
                                autoFocus
                                placeholder="Jordan Lee"
                                aria-invalid={Boolean(fieldErrors.name)}
                                aria-describedby={fieldErrors.name ? "agent-name-error" : undefined}
                                className={fieldErrors.name ? "field-invalid" : ""}
                                disabled={isBusy}
                            />
                            {fieldErrors.name && (
                                <span className="field-error" id="agent-name-error">
                                    {fieldErrors.name}
                                </span>
                            )}
                        </label>
                        <label htmlFor="agent-email">
                            <span className="label-row">
                                Email<span className="required-mark">*</span>
                            </span>
                            <input
                                id="agent-email"
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                maxLength={160}
                                placeholder="jordan.lee@supportdesk.io"
                                aria-invalid={Boolean(fieldErrors.email)}
                                aria-describedby={fieldErrors.email ? "agent-email-error" : undefined}
                                className={fieldErrors.email ? "field-invalid" : ""}
                                disabled={isBusy}
                            />
                            {fieldErrors.email && (
                                <span className="field-error" id="agent-email-error">
                                    {fieldErrors.email}
                                </span>
                            )}
                        </label>
                        <label htmlFor="agent-password">
                            <span className="label-row">
                                Temporary password<span className="required-mark">*</span>
                            </span>
                            <input
                                id="agent-password"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                maxLength={100}
                                placeholder="At least 8 characters"
                                aria-invalid={Boolean(fieldErrors.password)}
                                aria-describedby={fieldErrors.password ? "agent-password-error" : undefined}
                                className={fieldErrors.password ? "field-invalid" : ""}
                                disabled={isBusy}
                            />
                            {fieldErrors.password && (
                                <span className="field-error" id="agent-password-error">
                                    {fieldErrors.password}
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
                                {isBusy ? "Adding..." : "Add agent"}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </section>
    );
}
