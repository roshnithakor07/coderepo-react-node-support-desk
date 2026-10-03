import { AppError } from "../../shared/errors/app-error.js";
import { ACTIVE_STATUSES } from "./ticket-lifecycle.js";

// The second dimension of access, next to the role: an agent belongs to one or more ticket
// categories, and works only inside them. Pure rules, no database access, so the service reads as a
// sequence of decisions and every rule here can be tested on its own.

// Categories are stored in lower case and read back to people in title case.
export function categoryLabel(category) {
    const name = (category || "general").trim();
    return name.charAt(0).toUpperCase() + name.slice(1);
}

export function normalizeCategories(categories) {
    return [...new Set((categories || []).map((category) => String(category).trim().toLowerCase()).filter(Boolean))];
}

// An agent with no categories covers nothing. Treating "none" as "everything" would quietly undo the
// rule for exactly the accounts nobody has set up yet.
export function coversCategory(agent, category) {
    return normalizeCategories(agent?.categories).includes(String(category || "general").toLowerCase());
}

// A ticket nobody owns, still in the working queue, in one of this agent's categories: their queue's
// contents, and the only tickets they may claim.
export function isClaimableByTeam(ticket, actor) {
    if (actor.role !== "agent") return false;
    if (ticket.assignedTo) return false;
    if (!ACTIVE_STATUSES.includes(ticket.status)) return false;
    return coversCategory(actor, ticket.category);
}

// A ticket nobody owns that this agent's team does not cover. They are support staff looking at the
// shared backlog, so they hear which category it belongs to rather than a flat "no access": that is
// what tells them whether to ask for the category or leave it to the team that has it.
export function unownedOutsideTeamReason(ticket, actor) {
    if (actor.role !== "agent" || ticket.assignedTo) return null;
    if (!ACTIVE_STATUSES.includes(ticket.status)) return null;
    if (coversCategory(actor, ticket.category)) return null;
    const covered = normalizeCategories(actor.categories);
    const yours = covered.length > 0 ? `You work ${covered.map(categoryLabel).join(" and ")}.` : "You have no categories yet.";
    return `This ticket is in ${categoryLabel(ticket.category)}, which your team does not cover. ${yours}`;
}

// Why this agent cannot take this category, phrased for whoever is reading it: the agent themselves
// trying to claim, or an admin picking someone for the ticket.
export function teamBlockedReason(agent, category, actor) {
    if (coversCategory(agent, category)) return null;
    const label = categoryLabel(category);
    if (actor && String(agent._id || agent.id) === String(actor.id)) {
        return `You do not cover ${label} tickets, so you cannot claim this one. Ask an admin to add ${label} to your categories.`;
    }
    return `${agent.name} does not cover ${label} tickets. Add ${label} to their categories on the Agents page, or choose an agent who covers it.`;
}

// Claiming or being assigned a ticket outside your team is a permission failure, not a bad request:
// the agent and the ticket are both valid, the pairing is not.
export function assertInTeam(agent, category, actor) {
    const blocked = teamBlockedReason(agent, category, actor);
    if (blocked) throw new AppError(403, "OUTSIDE_TEAM", blocked);
}

// Moving a ticket to a category its assignee does not cover would leave it owned by someone outside
// the team, so the move conflicts with the ticket's current state rather than with a permission.
export function assertAssigneeCoversCategory(assignee, category) {
    if (!assignee || coversCategory(assignee, category)) return;
    const label = categoryLabel(category);
    throw new AppError(
        409,
        "ASSIGNEE_OUTSIDE_TEAM",
        `${assignee.name} does not cover ${label} tickets. Reassign this ticket before moving it to ${label}.`,
    );
}
