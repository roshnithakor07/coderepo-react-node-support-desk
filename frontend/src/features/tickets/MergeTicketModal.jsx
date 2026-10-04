import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "../../shared/components/Badge.jsx";
import { Modal } from "../../shared/components/Modal.jsx";
import { formatDateTime, ticketNumber } from "../../shared/utils/format.js";
import { friendlyErrorMessage } from "../../shared/utils/validate.js";
import { ticketApi } from "./ticket.api.js";

// Folding this ticket into the one the conversation should continue on. It offers only what the server
// would accept (the same customer's other tickets that are still in play and that this person can see),
// and says before anything happens what the merge does, because it closes this ticket for good.
export function MergeTicketModal({ ticket, onClose, onMerge }) {
    const [candidates, setCandidates] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [primaryId, setPrimaryId] = useState("");
    const [error, setError] = useState("");
    const [isBusy, setIsBusy] = useState(false);

    const load = useCallback(() => {
        setLoadError("");
        setCandidates(null);
        ticketApi
            .mergeCandidates(ticket._id)
            .then(setCandidates)
            .catch((problem) =>
                setLoadError(friendlyErrorMessage(problem, "Couldn't load this customer's other tickets. Please try again.")),
            );
    }, [ticket._id]);

    useEffect(() => {
        load();
    }, [load]);

    async function submit(event) {
        event.preventDefault();
        if (!primaryId) {
            setError("Choose the ticket to merge into.");
            return;
        }
        setIsBusy(true);
        setError("");
        try {
            await onMerge(primaryId);
        } catch (problem) {
            setError(friendlyErrorMessage(problem, "Couldn't merge these tickets. Please try again."));
            setIsBusy(false);
        }
    }

    const chosen = candidates?.find((candidate) => candidate._id === primaryId);

    return (
        <Modal onClose={onClose} label="Merge into another ticket" className="modal-form merge-modal">
            <h2>Merge {ticketNumber(ticket._id)} into another ticket</h2>
            <p className="merge-modal-intro">
                Every reply here moves to the ticket you choose, in the order it was written, and this ticket is closed with a link to it.{" "}
                {ticket.createdBy?.name || "The customer"} is told where the conversation continues. This can&rsquo;t be undone.
            </p>

            {loadError ? (
                <div className="form-error" role="alert">
                    {loadError}{" "}
                    <button type="button" className="link-button" onClick={load}>
                        Retry
                    </button>
                </div>
            ) : !candidates ? (
                <div aria-busy="true">
                    <span className="skeleton skeleton-block" style={{ height: "52px", marginBottom: "8px" }} />
                    <span className="skeleton skeleton-block" style={{ height: "52px" }} />
                </div>
            ) : candidates.length === 0 ? (
                <p className="merge-modal-empty">
                    {ticket.createdBy?.name || "This customer"} has no other open ticket you can see, so there is nothing to merge this
                    into. Only a customer&rsquo;s own tickets can be merged, and never a closed one.
                </p>
            ) : (
                <form id="merge-form" onSubmit={submit} noValidate>
                    <fieldset className="merge-options" disabled={isBusy}>
                        <legend className="visually-hidden">Ticket to merge into</legend>
                        {candidates.map((candidate) => (
                            <label key={candidate._id} className={`merge-option ${primaryId === candidate._id ? "is-chosen" : ""}`}>
                                <input
                                    type="radio"
                                    name="merge-primary"
                                    value={candidate._id}
                                    checked={primaryId === candidate._id}
                                    onChange={() => {
                                        setPrimaryId(candidate._id);
                                        setError("");
                                    }}
                                />
                                <span className="merge-option-body">
                                    <span className="merge-option-title">
                                        <span className="ticket-number">{ticketNumber(candidate._id)}</span> {candidate.title}
                                    </span>
                                    <span className="merge-option-meta">
                                        <StatusBadge status={candidate.status} /> Opened {formatDateTime(candidate.createdAt)} &middot;{" "}
                                        {candidate.replyCount} {candidate.replyCount === 1 ? "reply" : "replies"}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </fieldset>
                </form>
            )}

            {error && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}

            <div className="modal-actions">
                <button type="button" className="button-secondary" onClick={onClose} disabled={isBusy}>
                    Cancel
                </button>
                {candidates && candidates.length > 0 && (
                    <button type="submit" form="merge-form" className="button-danger" disabled={isBusy || !primaryId}>
                        {isBusy && <span className="spinner" aria-hidden="true" />}
                        {isBusy ? "Merging..." : chosen ? `Merge into ${ticketNumber(chosen._id)}` : "Merge"}
                    </button>
                )}
            </div>
        </Modal>
    );
}
