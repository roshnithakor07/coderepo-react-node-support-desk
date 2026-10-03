import { afterEach, describe, expect, test } from "bun:test";
import { startSlaChecker, stopSlaChecker } from "../src/shared/jobs/sla-checker.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// These tests drive a real setInterval, so they wait for the condition they care about instead of
// sleeping for a fixed time and counting ticks. On a loaded machine the event loop delays and
// coalesces timer callbacks, which made a fixed sleep assert a tick count the scheduler never
// promised. The generous ceiling keeps a genuinely dead timer a failure rather than a hang.
const CONDITION_TIMEOUT_MS = 5000;

async function waitFor(condition, description) {
    const deadline = Date.now() + CONDITION_TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (condition()) return;
        await wait(5);
    }
    throw new Error(`Timed out after ${CONDITION_TIMEOUT_MS}ms waiting for ${description}.`);
}

describe("SLA checker schedule", () => {
    afterEach(stopSlaChecker);

    test("runs the sweep repeatedly on its interval", async () => {
        let runs = 0;
        startSlaChecker({ intervalMs: 10, sweep: async () => ((runs += 1), { breached: 0, warned: 0 }) });
        await waitFor(() => runs >= 3, "the sweep to run three times");
        expect(runs).toBeGreaterThanOrEqual(3);
    });

    test("never starts a sweep while the previous one is still running", async () => {
        let active = 0;
        let mostAtOnce = 0;
        let runs = 0;
        startSlaChecker({
            intervalMs: 5,
            sweep: async () => {
                active += 1;
                runs += 1;
                mostAtOnce = Math.max(mostAtOnce, active);
                await wait(30);
                active -= 1;
                return { breached: 0, warned: 0 };
            },
        });
        // Each sweep outlives several ticks, so two completed sweeps prove the skipped ticks never
        // started one of their own.
        await waitFor(() => runs >= 2, "two overlapping-interval sweeps to start");
        expect(runs).toBeGreaterThanOrEqual(2);
        expect(mostAtOnce).toBe(1);
    });

    test("keeps running after a sweep fails", async () => {
        let runs = 0;
        startSlaChecker({
            intervalMs: 10,
            sweep: async () => {
                runs += 1;
                if (runs === 1) throw new Error("database hiccup");
                return { breached: 0, warned: 0 };
            },
        });
        await waitFor(() => runs >= 2, "the sweep to run again after throwing");
        expect(runs).toBeGreaterThanOrEqual(2);
    });

    test("stops when asked, and can be started again", async () => {
        let runs = 0;
        const sweep = async () => ((runs += 1), { breached: 0, warned: 0 });
        startSlaChecker({ intervalMs: 10, sweep });
        await waitFor(() => runs >= 1, "the first sweep");

        stopSlaChecker();
        const runsAtStop = runs;
        // A stopped timer can only be proven by time passing with nothing happening. A stalled
        // event loop makes this quiet window quieter, so it cannot fail for being slow.
        await wait(50);
        expect(runs).toBe(runsAtStop);

        startSlaChecker({ intervalMs: 10, sweep });
        await waitFor(() => runs > runsAtStop, "the restarted timer to sweep again");
        expect(runs).toBeGreaterThan(runsAtStop);
    });
});
