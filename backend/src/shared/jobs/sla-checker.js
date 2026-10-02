import { ticketService } from "../../features/tickets/ticket.service.js";

const SWEEP_INTERVAL_MS = 60 * 1000;

let timer = null;

// Runs the SLA sweep every minute. A sweep that is still running when the next one is due is not
// started twice; the next tick simply skips.
export function startSlaChecker({ intervalMs = SWEEP_INTERVAL_MS, sweep = () => ticketService.runSlaSweep() } = {}) {
    if (timer) return timer;
    let running = false;
    timer = setInterval(async () => {
        if (running) return;
        running = true;
        try {
            const result = await sweep();
            if (result.breached > 0 || result.warned > 0) {
                console.log(`SLA sweep: ${result.breached} breached, ${result.warned} warned`);
            }
        } catch (error) {
            console.error(`SLA sweep failed: ${error.message}`);
        } finally {
            running = false;
        }
    }, intervalMs);
    return timer;
}

export function stopSlaChecker() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}
