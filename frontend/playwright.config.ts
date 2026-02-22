import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT || 3000);

export default defineConfig({
    testDir: "./tests/e2e",
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: `npm run dev -- --port ${PORT} --hostname 127.0.0.1`,
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: true,
        timeout: 120_000,
    },
});
