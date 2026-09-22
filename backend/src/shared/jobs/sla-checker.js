import cron from "node-cron";
import { ticketService } from "../../features/tickets/ticket.service.js";

let scheduledTask = null;

export function startSlaChecker() {
    if (scheduledTask) return scheduledTask;
    scheduledTask = cron.schedule("* * * * *", async () => {
        try {
            const result = await ticketService.runSlaSweep();
            if (result.breached > 0 || result.warned > 0) {
                console.log(`SLA sweep: ${result.breached} breached, ${result.warned} warned`);
            }
        } catch (error) {
            console.error(`SLA sweep failed: ${error.message}`);
        }
    });
    return scheduledTask;
}

export function stopSlaChecker() {
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
    }
}
