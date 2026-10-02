// Run in a separate Bun process by auth.test.js: a fresh process has no in-memory state, like the
// API after a restart. Prints how authentication of process.env.TOKEN_TO_CHECK turned out.
import { connectDatabase, disconnectDatabase } from "../../src/shared/config/database.js";
import { initConfig } from "../../src/shared/config/index.js";
import { authService } from "../../src/features/auth/auth.service.js";

initConfig();
await connectDatabase(process.env.MONGODB_URI);
try {
    await authService.authenticate(process.env.TOKEN_TO_CHECK);
    console.log("accepted");
} catch (error) {
    console.log(`${error.statusCode} ${error.code}`);
}
await disconnectDatabase();
