import { useMemo, useState } from "react";
import { Modal } from "../../shared/components/Modal.jsx";
import { Table } from "../../shared/components/Table.jsx";
import { Badge } from "../../shared/components/Badge.jsx";
import { ConfirmationDialog } from "../../shared/components/ConfirmationDialog.jsx";
import { validateEmail, validatePassword, validateRequired } from "../../shared/utils/validate.js";

// Plain-language sort names, each paired with how it compares two agents.
const SORT_OPTIONS = [
    { value: "name_asc", label: "Name A\u2013Z", compare: (a, b) => a.name.localeCompare(b.name) },
    { value: "name_desc", label: "Name Z\u2013A", compare: (a, b) => b.name.localeCompare(a.name) },
    { value: "open_desc", label: "Most open tickets", compare: (a, b) => (b.openTicketCount ?? 0) - (a.openTicketCount ?? 0) },
    { value: "open_asc", label: "Fewest open tickets", compare: (a, b) => (a.openTicketCount ?? 0) - (b.openTicketCount ?? 0) },
];

const DEFAULT_SORT = "name_asc";

export function AgentsPage({ agents, onCreateAgent, onSetActive, isAdmin, error, loadError, isBusy, isLoading, isRefreshing, onRetry }) {
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [sortValue, setSortValue] = useState(DEFAULT_SORT);
    const [agentToDeactivate, setAgentToDeactivate] = useState(null);

    const sortedAgents = useMemo(() => {
        const compare = (SORT_OPTIONS.find((option) => option.value === sortValue) || SORT_OPTIONS[0]).compare;
        return [...agents].sort(compare);
    }, [agents, sortValue]);

    const activeCount = agents.filter((agent) => agent.isActive).length;

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

    // Deactivation asks first; reactivation is not destructive, so it happens at once.
    function handleToggleActive(agent) {
        if (agent.isActive) setAgentToDeactivate(agent);
        else onSetActive(agent._id, true, "activate");
    }

    function confirmDeactivation() {
        onSetActive(agentToDeactivate._id, false, "deactivate");
        setAgentToDeactivate(null);
    }

    function deactivationMessage(agent) {
        const openTickets = agent.openTicketCount ?? 0;
        const ticketNote =
            openTickets > 0
                ? ` Their ${openTickets} open ${openTickets === 1 ? "ticket stays" : "tickets stay"} assigned to them until you reassign ${openTickets === 1 ? "it" : "them"}.`
                : "";
        return `${agent.name} will be signed out, won't be able to sign in, and won't get new tickets.${ticketNote} You can activate them again later.`;
    }

    return (
        <section className="panel">
            <div className="panel-header">
                <div>
                    <p className="panel-count">
                        {agents.length} {agents.length === 1 ? "agent" : "agents"}
                        {agents.length > 0 ? ` \u00b7 ${activeCount} active` : ""}
                    </p>
                    <p className="panel-subtitle">
                        {isAdmin
                            ? "Add agents, see their live workload, and deactivate anyone who should stop receiving tickets."
                            : "Your team and how much each agent currently has open."}
                    </p>
                </div>
                {isAdmin && (
                    <button type="button" className="button-primary" onClick={() => setShowCreate(true)}>
                        Add agent
                    </button>
                )}
            </div>

            {loadError ? (
                <div className="form-error" role="alert">
                    {loadError}{" "}
                    <button type="button" className="link-button" onClick={onRetry}>
                        Retry
                    </button>
                </div>
            ) : (
                <Table
                    rowKey={(row) => row._id}
                    emptyTitle="No agents yet"
                    emptyDescription={
                        isAdmin
                            ? "Add your first agent so tickets can be assigned and worked on."
                            : "An admin has not added any agents yet."
                    }
                    emptyAction={isAdmin ? { label: "Add agent", onClick: () => setShowCreate(true) } : undefined}
                    rows={sortedAgents}
                    isLoading={isLoading}
                    isRefreshing={isRefreshing}
                    sortValue={sortValue}
                    sortOptions={SORT_OPTIONS}
                    onSortChange={setSortValue}
                    columns={[
                        { key: "name", header: "Name", sort: ["name_asc", "name_desc"] },
                        { key: "email", header: "Email" },
                        {
                            key: "openTicketCount",
                            header: "Open tickets",
                            sort: ["open_asc", "open_desc"],
                            render: (row) => <span className="mono">{row.openTicketCount ?? 0}</span>,
                        },
                        {
                            key: "isActive",
                            header: "Status",
                            render: (row) => (
                                <Badge tone={row.isActive ? "success" : "neutral"}>{row.isActive ? "Active" : "Inactive"}</Badge>
                            ),
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
            )}

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
                                placeholder="jordan.lee@example.com"
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
            {agentToDeactivate && (
                <ConfirmationDialog
                    title={`Deactivate ${agentToDeactivate.name}?`}
                    message={deactivationMessage(agentToDeactivate)}
                    confirmLabel="Deactivate"
                    danger
                    onCancel={() => setAgentToDeactivate(null)}
                    onConfirm={confirmDeactivation}
                />
            )}
        </section>
    );
}
