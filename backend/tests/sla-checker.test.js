import { afterEach, describe, expect, test } from "bun:test";
import { startSlaChecker, stopSlaChecker } from "../src/shared/jobs/sla-checker.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("SLA checker schedule", () => {
    afterEach(stopSlaChecker);

    test("runs the sweep repeatedly on its interval", async () => {
        let runs = 0;
        startSlaChecker({ intervalMs: 10, sweep: async () => ((runs += 1), { breached: 0, warned: 0 }) });
        await wait(80);
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
        await wait(120);
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
        await wait(80);
        expect(runs).toBeGreaterThanOrEqual(2);
    });

    test("stops when asked, and can be started again", async () => {
        let runs = 0;
        const sweep = async () => ((runs += 1), { breached: 0, warned: 0 });
        startSlaChecker({ intervalMs: 10, sweep });
        await wait(40);
        stopSlaChecker();
        const runsAtStop = runs;
        await wait(50);
        expect(runs).toBe(runsAtStop);

        startSlaChecker({ intervalMs: 10, sweep });
        await wait(40);
        expect(runs).toBeGreaterThan(runsAtStop);
    });
});
