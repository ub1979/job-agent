import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:9211",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: ".venv/bin/python -m tests.preview_server",
    cwd: "..",
    url: "http://127.0.0.1:9211/api/health",
    reuseExistingServer: false,
  },
  reporter: "list",
});
