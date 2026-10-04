# Support Desk

A full-stack customer support ticketing platform. Teams create, triage, and resolve support tickets with role-based access control, SLA tracking and breach alerts, canned responses, a full activity log, and an analytics dashboard.

## Built With

- [React 19](https://react.dev/) + [Vite 8](https://vite.dev/) — frontend UI, built with plain CSS (no component library)
- [Express 5](https://expressjs.com/) — REST API (`/api/v1`)
- [MongoDB](https://www.mongodb.com/) + [Mongoose](https://mongoosejs.com/) — persistence
- [JWT](https://github.com/auth0/node-jsonwebtoken) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — authentication
- [Zod](https://zod.dev/) — request validation
- [Bun](https://bun.sh/) — package manager and workspace runner

Notifications reach the browser through short-interval polling rather than WebSockets, and stay in the app rather than going out by email, to work within the platform's constraints.

### Dependencies

The dependencies are exactly the reference calendar app's, at the same pinned versions; nothing was added, removed, or replaced. Everything else uses the platform:

- The SLA breach/warning sweep runs every minute on a `setInterval` timer started with the API (`shared/jobs/sla-checker.js`); a sweep still running when the next one is due is skipped, not doubled.
- Sign-in and registration rate limits are kept in the API process's memory; signed-out tokens are stored in MongoDB (as hashes, removed automatically when they would have expired), so a restart doesn't undo a sign-out.
- Tests use Bun's built-in `bun test`.

## Product rules

The rules below are enforced in the service layer, not in the request handlers. Each one returns the
status code in the table with a message written for the person who hit it, the UI hides or disables
the action and shows the reason, and each has a `bun test` that proves it. Endpoints are relative to
`/api/v1`.

**At a glance:** 40 distinct product rules across nine areas (the lifecycle, SLA integrity, agent
teams, the requester's edit window, internal notes, the size of a conversation, notifications,
multi-record actions and access). Each rule is numbered once, with the cases that prove it listed
under it, 132 in all,
each with its test. The 11 input and resilience checks at the end are listed separately and not
counted as rules.

**Screens that change several records at once, or move something through a status:**

| Screen | What it does | Rules |
|---|---|---|
| Ticket list, bulk bar | Select tickets (one by one or the whole page), then assign, set the status or set the priority of all of them at once, all or nothing | Acting on several records at once |
| Ticket list, Unassigned queue (`#/tickets?view=unassigned`) | An agent claims a ticket nobody owns, limited to their team's categories | Agent teams |
| Ticket list, filters (`#/tickets?assignee=…`) | Search, status, priority and "Assigned to" narrow the list in the database and live in the URL, so a refresh, Back and a shared link all show the same list | Access, agent teams |
| Ticket detail, status control and history | Moves a ticket one step through `open -> in_progress -> pending -> resolved -> closed`, with every move on its status history | Ticket lifecycle, SLA integrity |
| Ticket detail, merge | Folds a duplicate into the primary: the replies move, the duplicate closes, both histories record it | Acting on several records at once |
| Ticket detail, requester actions | The customer closes, reopens or edits their own ticket within the rules | Ticket lifecycle, the requester's edit window |
| Agents, deactivate | Deactivating an agent hands every open ticket to someone on the right team, or to the unassigned queue on the admin's explicit choice | Acting on several records at once |
| Settings, categories | Removing a category is refused while agents or open tickets still use it, with the counts | Access |
| Notification panel (bell, every role) | Opening it reads nothing; a row reads itself and opens its ticket; "Mark all as read" marks every unread one at once | Notifications |

### Ticket lifecycle

The only path through the board is one step at a time:

```text
open -> in_progress -> pending <-> in_progress -> resolved -> closed
                                                     |           |
                                                     +-> open <--+   (reopen, 14 days)
```

| Rule | Case | Endpoint | Code | Test |
|---|---|---|---|---|
| **1.** A ticket moves one step at a time, forward, and only a finished ticket goes back to open | Nothing skips a step: an open ticket cannot jump to closed | `PUT /tickets/:id` | 409 `INVALID_TRANSITION` | "an open ticket cannot jump to closed" |
|  | An open ticket cannot be resolved without passing through in progress | `PUT /tickets/:id` | 409 `INVALID_TRANSITION` | "an open ticket cannot be resolved without going through in progress" |
|  | A pending ticket goes back to in progress before it can be resolved | `PUT /tickets/:id` | 409 `INVALID_TRANSITION` | "a pending ticket cannot be resolved until it is back in progress" |
|  | Nothing runs backwards except the reopen | `PUT /tickets/:id` | 409 `INVALID_TRANSITION` | "nothing runs backwards except the reopen" |
|  | Only a resolved or closed ticket can be reopened, and only to open | `PUT /tickets/:id` | 409 `INVALID_TRANSITION` | "only a finished ticket can be reopened" |
|  | Re-sending the status a ticket already has changes nothing | `PUT /tickets/:id` | 200 | "re-sending the status a ticket already has is accepted and changes nothing" |
| **2.** A finished ticket can be reopened for 14 days | A ticket closed more than 14 days ago cannot be reopened; the message says to open a new one | `PUT /tickets/:id` | 422 `REOPEN_WINDOW_EXPIRED` | "a ticket closed over fourteen days ago cannot be reopened, and says to open a new one" |
|  | Records written before the close stamp existed measure the window from their resolve stamp | `PUT /tickets/:id` | 422 `REOPEN_WINDOW_EXPIRED` | "a ticket closed before the close stamp existed measures the window from its resolve stamp" |
| **3.** Resolving needs a public reply from the support team | Resolving requires at least one public staff reply | `PUT /tickets/:id` | 422 `RESOLUTION_REQUIRES_REPLY` | "an in-progress ticket with nothing the customer can read cannot be resolved" |
|  | An internal note does not count as that reply | `PUT /tickets/:id` | 422 `RESOLUTION_REQUIRES_REPLY` | "an internal note does not count as an answer" |
| **4.** A closed ticket is read-only | A closed ticket takes no replies | `POST /tickets/:id/replies` | 409 `TICKET_CLOSED` | "no reply can be added" |
|  | A closed ticket's fields and priority are read-only | `PUT /tickets/:id` | 409 `TICKET_CLOSED` | "no field can be edited", "the priority cannot be changed either" |
|  | A closed ticket cannot be reassigned | `POST /tickets/:id/assign` | 409 `TICKET_CLOSED` | "it cannot be reassigned" |
| **5.** A reply moves the ticket on: the customer's hands it back or reopens it, the team's starts work | A customer's reply on a pending ticket hands it back to the team; the SLA clock and any breach carry on unchanged, because only a reopen starts a fresh period | `POST /tickets/:id/replies` | 201 | "a reply on a pending ticket hands it back to the team and keeps the breach and the clock" |
|  | A customer's reply on a resolved ticket reopens it, with a fresh SLA period and a `reopened` entry | `POST /tickets/:id/replies` | 201 | "a reply on a resolved ticket reopens it" |
|  | Only a public staff reply moves an open ticket to in progress; an internal note never moves it | `POST /tickets/:id/replies` | 201 | "a staff reply on an open ticket starts work, and an internal note never moves it" |

### SLA integrity

| Rule | Case | Endpoint | Code | Test |
|---|---|---|---|---|
| **6.** The deadline moves only for a reopen, or a priority change on a live ticket | A reopen restarts the SLA from the reopen moment, clears the breach, warning and resolve stamp, and is logged as `reopened` | `PUT /tickets/:id` | 200 | "a ticket resolved 46 hours ago comes back with a fresh window and is not breached by the next sweep" |
|  | A staff reply leaves the SLA clock alone | `POST /tickets/:id/replies` | 201 | "the SLA clock is untouched by a staff reply" |
|  | A priority change on a live ticket recomputes the deadline from the change moment, not from creation | `PUT /tickets/:id` | 200 | "changing the priority never clears the breach, and the new window runs from the change" |
|  | The audit entry for a priority change records the old and the new deadline | `GET /tickets/:id/audit` | 200 | "the audit entry records the old and the new deadline" |
|  | A finished ticket's deadline is left where it was | `PUT /tickets/:id` | 200 | "a resolved ticket's deadline is left where it was when its priority changes" |
|  | A move between two live statuses leaves the clock alone | `PUT /tickets/:id` | 200 | "a move between two active statuses leaves the clock alone" |
| **7.** A breach is permanent | A breach is permanent: changing the priority never clears it | `PUT /tickets/:id` | 200 | "changing the priority never clears the breach, and the new window runs from the change" |
| **8.** Breaches are found by the system and reported to every admin | The sweep flags an overdue ticket as the system, never as a person | background sweep | - | "flags an overdue ticket and records the breach as the system, not the customer" |
|  | Admins are told about every breach, not only the assignee | background sweep | - | "an SLA breach reaches every admin, not only the assignee" |
| **9.** A ticket nobody owns is reported to the admins once | A ticket with no assignee is reported to the admins once, not every minute | background sweep | - | "the sweep reports a ticket with no assignee once, not every minute" |

### Agent teams, the second kind of access rule

Access is decided twice: by role, and by team. Every agent covers one or more of the categories from
Settings, and works only inside them. An agent with no categories yet covers nothing, which is what an
account created before teams existed looks like until an admin sets them on the Agents page.

| Rule | Case | Endpoint | Code | Test |
|---|---|---|---|---|
| **10.** The unassigned queue and claiming follow the team: an agent sees and claims only their categories | An agent sees their own tickets plus an unassigned queue limited to their categories | `GET /tickets?view=unassigned` | 200 | "an agent sees the tickets nobody owns in their own categories, and no others" |
|  | Another team's queue holds the rest; an admin's queue is the whole backlog | `GET /tickets?view=unassigned` | 200 | "another team's queue holds the other tickets", "an admin's queue is the whole backlog" |
|  | A customer has no unassigned queue | `GET /tickets?view=unassigned` | 403 `FORBIDDEN` | "a customer has no unassigned queue" |
|  | A filter inside the queue narrows it and never reaches past the team | `GET /tickets?view=unassigned` | 200 | "a filter inside the queue narrows it and never reaches past the team" |
|  | An agent can open and claim an unowned ticket in their categories | `GET`/`POST /tickets/:id/assign` | 200 | "claiming takes the ticket, clears the unassigned alert and is recorded as a claim" |
|  | An agent cannot open an unowned ticket outside them, and hears which team has it | `GET /tickets/:id` | 403 `OUTSIDE_TEAM` | "an agent cannot open an unowned ticket outside their categories, and hears which team has it" |
|  | An agent cannot claim a ticket outside their categories; the message names the category | `POST /tickets/:id/assign` | 403 `OUTSIDE_TEAM` | "an agent cannot claim a ticket outside their categories, and the message names it" |
|  | The rule holds on tickets seeded days ago, and on agents who have no categories yet | `POST /tickets/:id/assign` | 403 `OUTSIDE_TEAM` | "the rule holds on a ticket seeded days ago, not only on new ones", "an agent with no categories yet covers nothing" |
| **11.** A ticket's assignee always covers its category | An admin cannot assign a ticket to an agent whose team does not cover it | `POST /tickets/:id/assign` | 403 `OUTSIDE_TEAM` | "an admin cannot hand a billing ticket to an agent who covers only general" |
|  | Refiling a ticket cannot leave it with an assignee outside that category's team | `PUT /tickets/:id` | 409 `ASSIGNEE_OUTSIDE_TEAM` | "moving it to a category the assignee does not cover is refused" |
| **12.** A new ticket goes to the least-loaded agent covering its category, or waits in the queue with the admins told | Auto-assignment picks the least-loaded active agent in the ticket's category | `POST /tickets` | 201 | "the ticket goes to somebody whose team covers it" |
|  | With nobody covering the category the ticket waits in the queue and every admin is told | `POST /tickets` | 201 | "with nobody covering the category the ticket waits in the queue and the admins are told" |
| **13.** Only an admin sets a team, from the Settings categories, with at least one | Only an admin sets an agent's categories | `PATCH /agents/:id/categories` | 403 `FORBIDDEN` | "an agent cannot change a team" |
|  | An agent's categories must exist in Settings | `POST /agents`, `PATCH /agents/:id/categories` | 422 `UNKNOWN_CATEGORY` | "a category that is not in Settings is refused, and the message says where to add it" |
|  | An agent must be on at least one category | `POST /agents`, `PATCH /agents/:id/categories` | 400 `VALIDATION_ERROR` | "an empty team is refused: an agent nothing can reach is not a team" |
| **14.** Changing a team never moves the work an agent already holds | Changing a team never moves what the agent already holds | `PATCH /agents/:id/categories` | 200 | "an admin sets them, and what the agent already holds stays with them" |
| **38.** The "Assigned to" filter can only narrow what the viewer may already see | An admin filters by any agent, and the count is that agent's own | `GET /tickets?assignee=<id>` | 200 | "asking for one agent returns their tickets and nobody else's", "another agent's filter returns a different set" |
|  | It combines with the search, the status and the paging, and the page is a page of the filter | `GET /tickets?assignee=<id>&status=&search=` | 200 | "it combines with the status filter, and with the search", "a page of filtered results is a page of that filter, not of the whole list" |
|  | An agent may ask only for themselves; another agent's name shows nothing, never their tickets | `GET /tickets?assignee=<id>` | 200 | "asking for themselves is their own list", "asking for another agent shows nothing, and never their tickets" |
|  | "Unassigned" means what it means in the queue: unowned tickets still in play, an agent's own categories only | `GET /tickets?assignee=unassigned` | 200 | "unassigned returns the tickets nobody owns, still in play", "unassigned is their team's queue, never another team's" |
|  | Inside the queue a named agent matches nothing, because nobody owns those tickets | `GET /tickets?view=unassigned&assignee=<id>` | 200 | "inside the queue, asking for an agent matches nothing, because nobody owns those tickets" |
|  | A customer cannot filter by assignee at all, and their own list is untouched | `GET /tickets?assignee=<id>` | 403 `FORBIDDEN` | "a customer cannot filter by assignee at all" |
|  | A malformed assignee is a bad filter, not an empty list | `GET /tickets?assignee=not-an-id` | 400 `VALIDATION_ERROR` | "a malformed assignee is a 400, not an empty list" |

### The requester's edit window

| Rule | Case | Endpoint | Code | Test |
|---|---|---|---|---|
| **15.** A requester edits the title and description until the team answers or starts work; the team edits until close | A requester can correct the title and description while the ticket is open and unanswered | `PUT /tickets/:id` | 200 | "the title and description can be corrected on an open ticket nobody has answered" |
|  | An internal note does not close the window, because the customer never sees it | `PUT /tickets/:id` | 200 | "an internal note does not count as an answer, because the customer never sees it" |
|  | A public staff reply closes it; the reason given is the answer, not the status move it caused | `PUT /tickets/:id` | 409 `TICKET_LOCKED` | "a public staff reply locks the title and description, and the message says why" |
|  | Work starting on the ticket closes it too, with its own reason | `PUT /tickets/:id` | 409 `TICKET_LOCKED` | "work starting on the ticket locks it too, with its own reason" |
|  | The page hides the edit button and shows the same reason | `GET /tickets/:id` | 200 | "the page hides the edit button and shows the same reason" |
|  | The support team edits a ticket for as long as it is not closed | `PUT /tickets/:id` | 200 | "an admin can rename a ticket the customer no longer can", "so can the agent the ticket is assigned to" |

### Internal notes are editable for fifteen minutes

| Rule | Case | Endpoint | Code | Test |
|---|---|---|---|---|
| **16.** An internal note is editable by its author or an admin for 15 minutes | The author, or an admin, can edit a note within 15 minutes; the ticket then shows it as edited | `PUT /tickets/:id/replies/:replyId` | 200 | "editing it changes the text, marks it edited and leaves the posting time alone" |
|  | They can delete it in the same window | `DELETE /tickets/:id/replies/:replyId` | 200 | "deleting it takes it off the ticket" |
|  | After 15 minutes it is part of the ticket's record | `PUT`/`DELETE /tickets/:id/replies/:replyId` | 422 `EDIT_WINDOW_EXPIRED` | "a note posted 16 minutes ago can no longer be edited or deleted" |
|  | Nobody else can change it, and the page gives them no controls for it | `PUT`/`DELETE /tickets/:id/replies/:replyId` | 403 `FORBIDDEN` | "another agent on the same ticket cannot touch it, and sees no trace of the controls" |
|  | An admin can remove any note, because somebody has to be able to | `DELETE /tickets/:id/replies/:replyId` | 200 | "an admin can remove any note, because somebody has to be able to" |
|  | Customers cannot reach these routes at all | `PUT`/`DELETE /tickets/:id/replies/:replyId` | 403 `FORBIDDEN` | "a customer cannot reach these routes at all" |
|  | A reply id that is not on the ticket is a 404, and a malformed one a 400 | `PUT /tickets/:id/replies/:replyId` | 404 `REPLY_NOT_FOUND` / 400 | "a reply id that is not on the ticket is a 404, never a 500" |
| **17.** A public reply is never edited or deleted | A public reply the customer has read is never edited or deleted | `PUT`/`DELETE /tickets/:id/replies/:replyId` | 403 `FORBIDDEN` | "a public reply the customer has read stays as it was sent" |

### A conversation holds at most 500 replies

Replies live inside the ticket document, and a MongoDB document cannot pass 16 MB, so a conversation is
capped: public replies and internal notes together, 500 of them. The cap is applied by the write itself
(the push matches only while the array is still under 500), so two replies sent in the same moment cannot
both get past it without a transaction, which this single-node MongoDB does not offer. A full ticket
refuses the next reply with the message above and the page offers the requester a follow-up ticket,
already named after this one and filed in the same category.

Reading follows the same shape: `GET /tickets/:id` carries the **latest 50** replies with `replyCount`,
and `GET /tickets/:id/replies?before=<replyId>&limit=50` walks back through the older pages under the
same view rules as the ticket, internal notes stripped for customers exactly as they are on it. The
ticket page shows "Show earlier replies (N more)" above the conversation and keeps the reader's place
when a page is added above them.

| Rule | Case | Endpoint | Code | Test |
|---|---|---|---|---|
| **37.** A ticket holds at most 500 replies, counted together, and is read one page of 50 at a time | The 500th reply is accepted and the 501st refused, leaving the ticket at 500 | `POST /tickets/:id/replies` | 422 `REPLY_LIMIT_REACHED` | "the 500th reply is accepted and the 501st is refused, with the ticket left at 500" |
|  | Two replies sent at the same moment on a ticket with 499 leave exactly 500 | `POST /tickets/:id/replies` | 201 + 422 `REPLY_LIMIT_REACHED` | "two replies sent at the same moment on a ticket with 499 leave exactly 500" |
|  | A refused reply changes nothing else: the status and the SLA clock stay as they were | `POST /tickets/:id/replies` | 422 `REPLY_LIMIT_REACHED` | "the refused reply leaves the ticket's status and SLA clock alone" |
|  | The page is told the conversation is full, so the composer is replaced by the reason and a follow-up | `GET /tickets/:id` | 200 | "the ticket page is told the conversation is full, so the composer is replaced" |
|  | A merge that would carry the primary past the limit is refused before anything moves | `POST /tickets/:id/merge` | 422 `MERGE_REPLY_LIMIT` | "a merge that would take the primary past the limit is refused" |
|  | The ticket carries the latest 50 replies and the count of them all | `GET /tickets/:id` | 200 | "the ticket carries the latest 50 replies and the count of them all" |
|  | Paging before the oldest one on screen returns the previous 50, in the order written | `GET /tickets/:id/replies` | 200 | "paging before the oldest one on screen returns the previous 50, in order" |
|  | Internal notes stay out of a customer's pages, as they do on the ticket | `GET /tickets/:id/replies` | 200 | "internal notes stay out of a customer's pages, as they do on the ticket" |
|  | A customer cannot page another customer's conversation, and hears exactly what they hear of the ticket | `GET /tickets/:id/replies` | 403 `FORBIDDEN` | "a customer cannot page the replies of someone else's ticket, and hears what they hear of it" |
|  | A page is at most 50; a malformed cursor is a 400 and one that is not on the ticket a 404 | `GET /tickets/:id/replies` | 400 `VALIDATION_ERROR` / 404 `REPLY_NOT_FOUND` | "the page size is capped, and a malformed or unknown cursor is a 400 or a 404" |
|  | Resolving still needs an answer the customer can read, even when it is pages behind the latest 50 | `GET /tickets/:id` | 200 | "resolving still needs a staff reply the customer can read, even when it is pages back" |
|  | A list row carries `replyCount` and none of the replies; a customer's count leaves out internal notes | `GET /tickets` | 200 | "a row has no replies in it, only the count", "a customer is told only the replies they can read, so the count gives no note away" |

### Notifications

A notification is read by being opened, not by the panel being glanced at: the bell's count is what has
not been dealt with, so it survives opening the panel and goes down one row at a time. Both marks answer
with the list as it then stands, so the badge and the rows settle without waiting for the next poll
(notifications are polled every 15 seconds; there are no WebSockets, per `GUIDELINES.md:186`).

| Rule | Case | Endpoint | Code | Test |
|---|---|---|---|---|
| **39.** A notification is read by being opened, one at a time, and only by the person it belongs to | Listing the panel marks nothing: the unread count is the same before and after | `GET /notifications` | 200 | "listing the panel changes nothing: the count is the same before and after" |
|  | Opening one row marks that one and leaves the rest unread; re-reading it changes nothing | `PATCH /notifications/:id/read` | 200 | "opening one marks that one, and leaves the rest unread" |
|  | "Mark all as read" clears the count in one request | `PATCH /notifications/read-all` | 200 | "mark all as read clears the count in one request" |
|  | Somebody else's notification cannot be marked, and is not even said to exist | `PATCH /notifications/:id/read` | 404 `NOTIFICATION_NOT_FOUND` | "nobody can mark somebody else's notification, and it is not even said to exist" |
|  | A malformed id is a 400, an unknown one a 404, and both marks need a session | `PATCH /notifications/:id/read`, `/read-all` | 400 `INVALID_ID` / 404 / 401 | "a malformed notification id is a 400, and an unknown one a 404", "both marks need a session" |
| **40.** A reply notification names who replied; an internal note notifies nobody | A public reply reaches the requester (or the agent it is with) and names its author | `POST /tickets/:id/replies` | 201 | "a staff reply reaches the requester and says who replied" |
|  | An internal note notifies nobody at all, least of all the customer who must not know it exists | `POST /tickets/:id/replies` | 201 | "an internal note notifies nobody, least of all the customer" |

### Acting on several records at once

Bulk actions are **all or nothing**. Every selected ticket is first checked against the same rules the
single action enforces (the lifecycle, closed tickets being read-only, the team rule, the reply needed
to resolve, who may make each move); if any one fails, nothing changes and the answer lists each failing
ticket with its title and reason, which the ticket list shows with a way to deselect them and try again.
Each ticket that changes gets its own audit entry, and a toast sums up the result.

**How the writes are applied:** the development MongoDB that `setup.sh` starts is a single standalone
node, which does not support transactions (checked: "Transaction numbers are only allowed on a replica
set member or mongos"). Making it a replica set would change the setup flow the reference repository
defines, so bulk actions, merges and deactivations **validate everything first and then apply the
writes one after another**. A ticket changed by someone else in that short gap is re-checked by the
single action as it is written and reported, never silently overwritten.

| Rule | Case | Endpoint | Code | Test |
|---|---|---|---|---|
| **18.** A bulk action is all or nothing, and a refusal lists every failing ticket | Bulk status: one illegal move refuses the whole action and nothing changes | `POST /tickets/bulk/status` | 422 `BULK_REJECTED` | "one illegal move refuses the whole action, and nothing changes" |
|  | The refusal lists every failing ticket with its title and the reason | `POST /tickets/bulk/status` | 422 `BULK_REJECTED` | "the answer lists every failing ticket with its title and the reason" |
|  | Each ticket that moves is saved and gets its own audit entry | `POST /tickets/bulk/status` | 200 | "every ticket moves, is saved, and is recorded on its own audit trail" |
|  | A ticket that does not exist is reported with the rest, never a 404 for the whole request | `POST /tickets/bulk/status` | 422 `BULK_REJECTED` | "a ticket that does not exist is reported with the others" |
| **19.** Every ticket in a bulk action passes the single action's own rules | Bulk moves follow the single move's lifecycle, including the reply needed to resolve | `POST /tickets/bulk/status` | 422 `BULK_REJECTED` | "the lifecycle rules are the single move's, including the reply needed to resolve" |
|  | A ticket already in the target state is counted as unchanged, not an error | `POST /tickets/bulk/status`, `/bulk/priority`, `/bulk/assign` | 200 | "a ticket already in that status is left alone and counted as unchanged" |
|  | Bulk assign: one ticket outside the agent's team refuses the lot, naming the category | `POST /tickets/bulk/assign` | 422 `BULK_REJECTED` (`OUTSIDE_TEAM`) | "one ticket outside the agent's team refuses the whole action, naming the category" |
|  | A closed ticket in a bulk assign or bulk priority refuses the lot | `POST /tickets/bulk/assign`, `/bulk/priority` | 422 `BULK_REJECTED` (`TICKET_CLOSED`) | "a closed ticket in the selection refuses the action", "a closed ticket is read-only, so one in the selection refuses the lot" |
|  | Bulk priority gives each ticket a fresh SLA window from now; a breach stays on the record | `POST /tickets/bulk/priority` | 200 | "each ticket gets the new priority and a fresh SLA window from now", "on a breached ticket seeded hours ago, the breach stays on the record" |
|  | An agent can include only tickets they can see | `POST /tickets/bulk/status` | 422 `BULK_REJECTED` (`FORBIDDEN`) | "an agent can include only tickets they can see" |
| **20.** Only staff use bulk actions, on at most 50 distinct tickets | Customers cannot reach the bulk actions | `POST /tickets/bulk/*` | 403 `FORBIDDEN` | "customers cannot reach either action" |
|  | At most 50 tickets, each once, with well-formed ids | `POST /tickets/bulk/*` | 400 `VALIDATION_ERROR` | "nothing selected, too many, the same ticket twice and a malformed id are all 400" |
| **21.** Deactivating an agent hands their open work to their team, previewed first | Deactivating an agent hands each open ticket to the least-loaded active agent covering its category | `PATCH /agents/:id/status` | 200 | "each goes to an active agent whose team covers its category, and finished tickets stay put" |
|  | Every handed-on ticket is on its audit trail, and its new holder is told | `PATCH /agents/:id/status` | 200 | "every move is on the ticket's audit trail and the new holder is told" |
|  | The confirmation shows the count and where each ticket goes before anything changes | `GET /agents/:id/deactivation-preview` | 200 | "it counts the open tickets and where each would go" |
|  | Work nobody covers (an agent from before teams) goes to the unassigned queue, never outside the team | `PATCH /agents/:id/status` | 200 | "an agent from before teams existed, deactivated with a ticket nobody covers" |
|  | Reactivating an agent moves nothing back | `PATCH /agents/:id/status` | 200 | "reactivating moves nothing back" |
| **22.** The last active cover for a category with open work stays, unless the admin sends that work to the queue | The last active cover for a category with open work cannot be deactivated | `PATCH /agents/:id/status` | 409 `AGENT_LAST_COVER` | "the refusal names the category and the open tickets, and nothing moves" |
|  | ...unless the admin explicitly sends that work to the unassigned queue, where every admin is told | `PATCH /agents/:id/status` | 200 | "with that choice the deactivation goes through, and the work waits in the queue with the admins told" |
| **23.** A merge folds a duplicate into its primary and leaves the primary as it was | Merge moves every reply into the primary in the order written, the duplicate's opening message with them | `POST /tickets/:id/merge` | 200 | "the replies move over in the order they were written" |
|  | The duplicate is closed with a link to the primary, and both histories record the merge | `POST /tickets/:id/merge` | 200 | "the duplicate is closed with a link to the primary", "both histories record it" |
|  | Merging seeded tickets leaves the primary's clock, status, priority and assignee alone | `POST /tickets/:id/merge` | 200 | "the primary keeps its own clock, status, priority and assignee" |
| **24.** Only two live tickets from the same customer merge, by staff who can see both | A ticket cannot be merged into itself | `POST /tickets/:id/merge` | 422 `MERGE_INTO_ITSELF` | "a ticket into itself" |
|  | Two customers' tickets cannot be merged | `POST /tickets/:id/merge` | 422 `MERGE_DIFFERENT_CUSTOMERS` | "two different customers' tickets" |
|  | A closed ticket on either side cannot be merged | `POST /tickets/:id/merge` | 409 `TICKET_CLOSED` | "a closed ticket on either side" |
|  | Only staff merge, and only tickets they can see; the page offers only valid targets | `POST /tickets/:id/merge`, `GET /tickets/:id/merge-candidates` | 403 `FORBIDDEN` | "only the support team can merge", "the same customer's other tickets still in play" |
| **25.** A merged duplicate stays closed | A merged duplicate cannot be reopened | `PUT /tickets/:id` | 409 `TICKET_MERGED` | "the duplicate cannot be reopened, because its conversation lives elsewhere" |

### Access

| Rule | Case | Endpoint | Code | Test |
|---|---|---|---|---|
| **26.** Only customers raise tickets | Only customers raise tickets | `POST /tickets` | 403 `FORBIDDEN` | "an agent may not", "an admin may not" |
| **27.** A customer acts only on their own tickets, and only to close or reopen them | A customer sees and touches only their own tickets | `PUT /tickets/:id` | 403 `FORBIDDEN` | "a customer cannot touch someone else's ticket" |
|  | A customer may close or reopen their own ticket, and nothing else in the lifecycle | `PUT /tickets/:id` | 403 `FORBIDDEN` | "a customer cannot move a ticket anywhere else in the lifecycle" |
|  | A customer cannot set a ticket's priority, category or tags | `PUT /tickets/:id` | 403 `FORBIDDEN` | "a customer cannot set a ticket's priority, category or tags" |
| **28.** Internal notes are for staff only | Internal notes never reach a customer, on any endpoint that returns a ticket | `GET /tickets`, `GET /tickets/:id` | 200 | "ticket detail omits internal note content but keeps public replies", "ticket list omits internal note content" |
|  | A customer cannot post an internal note | `POST /tickets/:id/replies` | 201 (forced public) | "a customer cannot post an internal note" |
| **29.** An agent assigns only tickets they can see, and only to active agents | An agent may assign only a ticket they can see; an admin any ticket | `POST /tickets/:id/assign` | 403 `FORBIDDEN` | "an agent cannot reassign a ticket assigned to another agent" |
|  | Only an existing, active agent can be assigned | `POST /tickets/:id/assign` | 400 `INVALID_AGENT` | "an inactive agent cannot be assigned", "a non-agent account cannot be assigned" |
|  | Auto-assignment skips inactive agents | `POST /tickets` | 201 | "never assigns a new ticket to an inactive agent" |
| **30.** A ticket's history and audit trail are shown only to those allowed | The status history is readable only by people who can see the ticket | `GET /tickets/:id/history` | 403 `FORBIDDEN` | "nobody can read the history of a ticket they cannot see" |
|  | The full audit trail is admin-only | `GET /tickets/:id/audit`, `GET /audit-logs` | 403 `FORBIDDEN` | "agents and customers cannot read it" |
| **31.** Sign-up makes a customer, with one account per email | Sign-up always creates a customer; the role cannot be chosen | `POST /auth/register` | 201 | "a newly registered customer cannot reach admin-only routes" |
|  | One account per email address | `POST /auth/register`, `POST /agents` | 409 `EMAIL_TAKEN` | "signing up with an email already in use is refused", "adding an agent with an email already in use is refused" |
| **32.** Sign-in tells a deactivated account so only with the right password; otherwise one generic answer | A deactivated account with the right password is told it is deactivated, and gets no session | `POST /auth/login` | 403 `ACCOUNT_DEACTIVATED` | "the right password is told the account is deactivated (403)", "an inactive agent cannot sign in" |
|  | A wrong password or an unknown email gets one generic answer, after the same password check, so neither the answer nor its timing reveals which emails have accounts | `POST /auth/login` | 401 `INVALID_CREDENTIALS` | "a wrong password gets the generic answer (401)", "an unknown email gets the same generic answer (401), after a password check" |
| **33.** Signing out revokes the token everywhere | Signing out revokes the token everywhere, across restarts | `POST /auth/logout` | 401 `AUTH_REQUIRED` | "a signed-out token is still refused by a freshly started process (nothing held in memory)" |
| **34.** Canned responses are for staff; a template is personal unless an admin publishes it | Canned responses are unreachable for customers | `GET`/`POST /canned-responses` | 403 `FORBIDDEN` | "customers cannot reach them at all" |
|  | An agent's template is personal; only an admin can publish a global one | `POST /canned-responses` | 201 | "an agent's template is personal, whatever they ask for" |
|  | A template is deletable only by its author or an admin | `DELETE /canned-responses/:id` | 403 `FORBIDDEN` | "an agent cannot delete a template somebody else owns" |
| **35.** Only admins change settings | Only admins change settings | `PUT /settings` | 403 `FORBIDDEN` | "only admins can change settings" |
| **36.** A category in use cannot be removed, and the page says why | A category agents are on, or open tickets are filed under, cannot be removed; the message counts both | `PUT /settings` | 409 `CATEGORY_IN_USE` | "the refusal names the category and counts what is using it" |
|  | The Settings page is told what is in use, so the remove button says why it is disabled | `GET /settings` | 200 | "the settings page is told what is in use, so the remove button can say why" |
|  | Finished tickets do not hold a category open | `PUT /settings` | 200 | "closed and resolved tickets do not hold a category open" |

### Input and resilience

| Rule | Endpoint | Code | Test |
|---|---|---|---|
| A status outside the list is a validation error, not a conflict | `PUT /tickets/:id` | 400 `VALIDATION_ERROR` | "a value outside the status list is still a validation error" |
| A malformed id anywhere in a path or query is rejected, never a 500 | all `/tickets/:id` routes | 400 `VALIDATION_ERROR` | "a malformed agentId is rejected with 400, not 500", "filtering tickets by a malformed assignee id returns 400" |
| A well-formed id that matches nothing is a 404 | all `/tickets/:id` routes | 404 `TICKET_NOT_FOUND` | "a well-formed id that does not exist still returns 404" |
| Malformed JSON is a 400 | all `POST`/`PUT` routes | 400 `INVALID_JSON` | "malformed JSON returns 400 INVALID_JSON" |
| A body over 100 KB is refused | all `POST`/`PUT` routes | 413 `PAYLOAD_TOO_LARGE` | "a body over the 100 KB limit returns 413 PAYLOAD_TOO_LARGE" |
| An invalid or backwards analytics date range is refused | `GET /analytics` | 400 `VALIDATION_ERROR` | "a non-date start returns 400", "a start after the end returns 400" |
| A rejected settings update leaves the stored settings untouched | `PUT /settings` | 400 `VALIDATION_ERROR` | "a rejected update leaves the stored settings unchanged" |
| A partial SLA update keeps the other priorities | `PUT /settings` | 200 | "a partial SLA update keeps the other priorities" |
| Sign-in is rate limited per address | `POST /auth/login` | 429 `RATE_LIMITED` | "the 11th sign-in attempt within a minute is refused" |
| Sign-up is rate limited per address | `POST /auth/register` | 429 `RATE_LIMITED` | "the 11th registration attempt within 10 minutes is refused" |
| The API answers only the configured frontend origin | all routes | - | "does not allow other origins" |

## Changes from the approved proposal

The proposal was written before the submission guidelines were applied to it. Where the two
disagreed, the guidelines won. Each change below is a deliberate decision, with the line it follows.

| Proposal item | What we built | Why |
|---|---|---|
| TypeScript across frontend and backend | JavaScript with ES modules, as the reference calendar repo is written | The sample stack is kept as declared (`AGENTS.md:238`). A TypeScript toolchain also means new build dependencies, which `GUIDELINES.md:65` forbids: "Do not add or replace any external runtime or development dependency". |
| Redis caching for analytics and sessions | No caching layer at all: analytics is aggregated in MongoDB per request, rate limits live in the API process's memory, and revoked tokens live in MongoDB | `GUIDELINES.md:65`. `ioredis` is not in the reference repo, so adding it would be a new runtime dependency. The dashboard is fast enough without it, and dropping the cache removed a class of stale-data bugs. |
| WebSockets for live ticket and notification updates | Notifications and counts are polled every 15 seconds | `GUIDELINES.md:186`: "The core product must not depend on capabilities unavailable in the HackerRank environment, such as outbound email, WebSockets, server-side file uploads, external hosted services". |
| Inbound email webhook that turns mail into tickets | Removed, along with its route and secret | `GUIDELINES.md:186`, same line: it needs an external sender and outbound mail to be useful, and it left a route with no screen behind it. Tickets are raised in the app instead. |
| Cursor pagination on the ticket list | Page-number pagination (`page` and `pageSize`) with the sort applied in MongoDB, so the order holds across pages | The list is filtered, sorted and counted server-side and the UI shows "Page N of M", which needs a total. Cursor pagination cannot produce that count, and the volume here does not need it. |
| A reference to real help-desk products in the README | Removed; the product is described in its own words, and the seeded data uses `@example.com` addresses | `GUIDELINES.md:146` |

## Project Structure

```text
coderepo-react-node-support-desk/
├── backend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/                # register/login/logout, User model
│   │   │   ├── tickets/              # CRUD, status transitions, SLA, auto-assign
│   │   │   ├── agents/                # agent roster + workload
│   │   │   ├── canned-responses/     # reusable reply templates
│   │   │   ├── audit-logs/           # immutable action trail
│   │   │   ├── notifications/        # in-app notifications (polled)
│   │   │   ├── analytics/            # aggregated dashboard
│   │   │   └── settings/             # SLA hours + categories
│   │   ├── shared/
│   │   │   ├── config/               # env, Mongo
│   │   │   ├── middleware/           # auth, RBAC, rate limit, error handler
│   │   │   └── jobs/                 # SLA sweep, every minute
│   │   ├── scripts/seed.js
│   │   ├── app.js
│   │   └── index.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── features/                 # one folder per product feature (api client + pages)
│   │   ├── shared/                   # api client, reusable components, utils
│   │   ├── App.jsx
│   │   └── styles.css
│   └── package.json
├── skills/
│   ├── validate/                     # HackerRank submission validator (copied, reference only)
│   └── submission-gate/              # our own strict pre-submission gate: run it last, in a fresh session
├── transcripts/                      # exported AI build session log
├── AGENTS.md / GUIDELINES.md         # HackerRank submission contract (copied, reference only)
├── hackerrank.yml
└── setup.sh
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.4
- [MongoDB](https://www.mongodb.com/try/download/community) reachable at `127.0.0.1:27017` (or set `MONGODB_URI`)

### Development setup

```bash
bun install
bash setup.sh --seed   # copies .env files, verifies Mongo is reachable, seeds the database
bun start              # runs backend (:8000) and frontend (:3000) together
```

Visit `http://localhost:3000`. The frontend proxies `/api/*` to the backend automatically in development.

MongoDB behavior: `setup.sh` checks `127.0.0.1:27017` and starts a local `mongod` (via `.mongodb/`) if nothing is listening. The seed script always clears every collection and re-inserts a deterministic baseline, so re-running `bun run seed` (or restarting via `bun start`, which reseeds on every `prestart`) restores a known-good state.

### Formatting

Source files use 4-space indentation, the same as the reference starter's code. The starter's `.prettierrc` sets `useTabs: true`, which its own source doesn't follow either, so `prettier --check` reports the same style difference on the unmodified starter files; `.prettierignore` is kept identical to the starter's.

### Seeded login credentials

All seeded accounts share one password: **`SupportDesk@2026`**

| Role | Email | Team (categories) |
|---|---|---|
| Admin | `admin1@example.com`, `admin2@example.com` | sees every category |
| Agent | `agent1@example.com` | Billing, Technical |
| Agent | `agent2@example.com` | Technical, Account |
| Agent | `agent3@example.com` | Billing, Account |
| Agent | `agent4@example.com` | General (the only active agent covering it) |
| Agent | `agent5@example.com` (seeded inactive) | General, Account |
| Customer | `customer1@example.com` ... `customer3@example.com` | n/a |

Two seeded tickets are left unassigned, one Billing and one General, so each agent's **Unassigned**
queue (`#/tickets?view=unassigned`) shows only its own and the claim can be tried from either side.
Grace Kim's "Login code never arrives by text" duplicates her "Two-factor authentication not working"
a day later, so a merge can be tried from the duplicate's page straight away.

New accounts created through the "Create account" tab on the sign-in screen are always customers; agent and admin access is provisioned by an admin from the **Agents** page.

## Commands

| Command | Description |
|---|---|
| `bun install` | Install all workspace dependencies |
| `bash setup.sh --seed` | Bootstrap env files, verify Mongo, seed the database |
| `bun start` | Reseed, then run backend + frontend together |
| `bun run dev:backend` | Run only the backend, with file watching |
| `bun run dev:frontend` | Run only the frontend dev server |
| `bun run seed` | Re-seed the database (clears and re-inserts the baseline) |
| `cd frontend && bun run build` | Production frontend build |
| `bun run test` | API tests (`bun test`) against an isolated `support_desk_test` database (requires MongoDB), then the routing unit tests (`bun test` in `frontend`) |

`hackerrank.yml` install/run commands: `bun install && bash setup.sh --seed` / `bun start`.
