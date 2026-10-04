import { categoryLabel, normalizeCategories } from "./ticket-teams.js";

// Planning what happens to an agent's open tickets when they are deactivated. Pure, with no database
// access: the service loads the facts and applies the plan, so the plan can be tested on its own.

// Tickets go to the least-loaded active agent who covers their category. Each ticket placed counts
// against that agent for the next one, so a long list spreads across the team instead of landing on
// whoever was lightest when the loop began. `candidates` arrive already sorted lightest first, with the
// id breaking ties, so the same board always produces the same plan.
export function planReassignments(tickets, candidates) {
    const load = new Map(candidates.map((candidate) => [String(candidate._id), candidate.openTicketCount ?? 0]));
    const moves = [];
    const toQueue = [];

    for (const ticket of tickets) {
        const category = String(ticket.category || "general").toLowerCase();
        const eligible = candidates.filter((candidate) => normalizeCategories(candidate.categories).includes(category));
        if (eligible.length === 0) {
            // Nobody covers it. It waits in the unassigned queue, where the admins are told about it.
            toQueue.push(ticket);
            continue;
        }
        const best = eligible.reduce((lightest, candidate) =>
            load.get(String(candidate._id)) < load.get(String(lightest._id)) ? candidate : lightest,
        );
        load.set(String(best._id), load.get(String(best._id)) + 1);
        moves.push({ ticket, to: best });
    }

    return { moves, toQueue };
}

// The agent is the last active cover for a category that still has open work. Letting them go would
// leave that work with nobody who may take it, so the deactivation is refused rather than quietly
// emptying a team.
export function lastCoverBlock(agent, coverCountsByCategory, openCountsByCategory) {
    return normalizeCategories(agent.categories)
        .filter((category) => (coverCountsByCategory[category] || 0) === 0 && (openCountsByCategory[category] || 0) > 0)
        .map((category) => ({ category, openTickets: openCountsByCategory[category] }));
}

export function lastCoverMessage(agent, blocked) {
    const parts = blocked.map(
        ({ category, openTickets }) => `${categoryLabel(category)} (${openTickets} open ${openTickets === 1 ? "ticket" : "tickets"})`,
    );
    const names = blocked.map(({ category }) => categoryLabel(category));
    return `${agent.name} is the only active agent covering ${parts.join(" and ")}. Add another agent to ${names.join(" and ")} first, or send that work to the unassigned queue.`;
}
