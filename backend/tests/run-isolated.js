import { readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Gives each test file its own freshly seeded process: tests/setup.js seeds support_desk_test
// and boots the app fresh every time it is preloaded, so running it once per file (instead of
// once for the whole suite) stops one file's restore or in-flight write from landing inside
// another file's wall-clock-scoped assertion window.

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(testsDirectory, "..");

const files = readdirSync(testsDirectory)
    .filter((name) => name.endsWith(".test.js"))
    .sort();

for (const file of files) {
    const relativePath = path.join("tests", file);
    const result = Bun.spawnSync(["bun", "test", "--preload", "./tests/setup.js", relativePath], {
        cwd: backendDirectory,
        stdio: ["inherit", "inherit", "inherit"],
    });

    if (result.exitCode !== 0) {
        console.log(`\nFAIL: ${file} (${files.indexOf(file) + 1}/${files.length} files run)`);
        process.exit(1);
    }
}

console.log(`\nPASS: ${files.length} test files, each in its own freshly seeded process.`);
