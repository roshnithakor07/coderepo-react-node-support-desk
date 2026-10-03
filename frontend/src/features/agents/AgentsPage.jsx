import { useMemo, useState } from "react";
import { Modal } from "../../shared/components/Modal.jsx";
import { Table } from "../../shared/components/Table.jsx";
import { Badge } from "../../shared/components/Badge.jsx";
import { ConfirmationDialog } from "../../shared/components/ConfirmationDialog.jsx";
import { titleCase } from "../../shared/utils/format.js";
import { validateEmail, validatePassword, validateRequired } from "../../shared/utils/validate.js";

// An agent's team: the categories they work. The checkboxes come from Settings, which is the only
// place a category can exist, so a team can never point at one that does not.
function CategoryPicker({ idPrefix, categories, selected, onToggle, error, disabled }) {
    return (
        <fieldset className="category-picker">
            <legend className="label-row">
                Categories<span className="required-mark">*</span>
            </legend>
            <p className="category-picker-hint">They are assigned and can claim tickets only in these categories.</p>
            {categories.length === 0 ? (
                <p className="field-error">There are no categories yet. Add one on the Settings page first.</p>
            ) : (
                <div className="category-picker-options">
                    {categories.map((category) => (
                        <label key={category} className="category-picker-option" htmlFor={`${idPrefix}-${category}`}>
                            <input
                                id={`${idPrefix}-${category}`}
                                type="checkbox"
                                checked={selected.includes(category)}
                                onChange={() => onToggle(category)}
                                disabled={disabled}
                            />
                            {titleCase(category)}
                        </label>
                    ))}
                </div>
            )}
            {error && <span className="field-error">{error}</span>}
        </fieldset>
    );
}

// A team of none is what an agent added before teams existed looks like. Nothing can reach them, so
// the row says so and the admin has one click to fix it.
function CategoryCell({ agent, isAdmin, onEdit }) {
    if ((agent.categories || []).length === 0) {
        return (
            <span className="category-cell">
                <Badge tone="warning">No categories</Badge>
                {isAdmin && (
                    <button type="button" className="link-button row-action" onClick={() => onEdit(agent)}>
                        Set
                    </button>
                )}
            </span>
        );
    }
    return (
        <span className="category-cell">
            {agent.categories.map((category) => (
                <span key={category} className="tag">
                    {titleCase(category)}
                </span>
            ))}
        </span>
    );
}

// Plain-language sort names, each paired with how it compares two agents.
const SORT_OPTIONS = [
    { value: "name_asc", label: "Name A\u2013Z", compare: (a, b) => a.name.localeCompare(b.name) },
    { value: "name_desc", label: "Name Z\u2013A", compare: (a, b) => b.name.localeCompare(a.name) },
    { value: "open_desc", label: "Most open tickets", compare: (a, b) => (b.openTicketCount ?? 0) - (a.openTicketCount ?? 0) },
    { value: "open_asc", label: "Fewest open tickets", compare: (a, b) => (a.openTicketCount ?? 0) - (b.openTicketCount ?? 0) },
];

const DEFAULT_SORT = "name_asc";

export function AgentsPage({
    agents,
    categories = [],
    onCreateAgent,
    onSetActive,
    onSetCategories,
    isAdmin,
    error,
    loadError,
    isBusy,
    isLoading,
    isRefreshing,
    onRetry,
}) {
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [newCategories, setNewCategories] = useState([]);
    const [fieldErrors, setFieldErrors] = useState({});
    const [sortValue, setSortValue] = useState(DEFAULT_SORT);
    const [agentToDeactivate, setAgentToDeactivate] = useState(null);
    const [agentToEdit, setAgentToEdit] = useState(null);
    const [editCategories, setEditCategories] = useState([]);
    const [editError, setEditError] = useState("");

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
        if (newCategories.length === 0) errors.categories = "Choose at least one category for this agent.";
        return errors;
    }

    function handleSubmit(event) {
        event.preventDefault();
        const errors = validate();
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;
        onCreateAgent({ name: name.trim(), email: email.trim(), password, categories: newCategories })
            .then(() => {
                setShowCreate(false);
                setName("");
                setEmail("");
                setPassword("");
                setNewCategories([]);
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

    function toggle(list, category) {
        return list.includes(category) ? list.filter((existing) => existing !== category) : [...list, category];
    }

    function openEdit(agent) {
        setAgentToEdit(agent);
        setEditCategories(agent.categories || []);
        setEditError("");
    }

    function submitCategories(event) {
        event.preventDefault();
        if (editCategories.length === 0) {
            setEditError("Choose at least one category for this agent.");
            return;
        }
        onSetCategories(agentToEdit._id, editCategories)
            .then(() => setAgentToEdit(null))
            .catch((problem) => setEditError(problem.message));
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
                            key: "categories",
                            header: "Categories",
                            render: (row) => <CategoryCell agent={row} isAdmin={isAdmin} onEdit={openEdit} />,
                        },
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
                                        <button type="button" className="link-button row-action" onClick={() => openEdit(row)}>
                                            Categories
                                        </button>
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
                        <CategoryPicker
                            idPrefix="new-agent-category"
                            categories={categories}
                            selected={newCategories}
                            onToggle={(category) => {
                                setNewCategories((current) => toggle(current, category));
                                setFieldErrors((current) => ({ ...current, categories: undefined }));
                            }}
                            error={fieldErrors.categories}
                            disabled={isBusy}
                        />
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
            {agentToEdit && (
                <Modal onClose={() => setAgentToEdit(null)} label={`Categories for ${agentToEdit.name}`} className="modal-form">
                    <h2>{agentToEdit.name}&rsquo;s categories</h2>
                    <form onSubmit={submitCategories} noValidate>
                        <CategoryPicker
                            idPrefix="edit-agent-category"
                            categories={categories}
                            selected={editCategories}
                            onToggle={(category) => {
                                setEditCategories((current) => toggle(current, category));
                                setEditError("");
                            }}
                            error={editError}
                            disabled={isBusy}
                        />
                        <p className="settings-section-description">
                            Tickets already assigned to {agentToEdit.name.split(" ")[0]} stay with them. This decides what they can be given
                            or claim next.
                        </p>
                        <div className="modal-actions">
                            <button type="button" className="button-secondary" onClick={() => setAgentToEdit(null)} disabled={isBusy}>
                                Cancel
                            </button>
                            <button type="submit" className="button-primary" disabled={isBusy}>
                                {isBusy && <span className="spinner" aria-hidden="true" />}
                                {isBusy ? "Saving..." : "Save categories"}
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
