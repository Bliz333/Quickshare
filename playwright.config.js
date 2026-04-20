const { defineConfig } = require('@playwright/test');

// When PLAYWRIGHT_BASE_URL is set, tests run against a real/preprod server.
// Otherwise, spin up a lightweight static file server so mock-only tests
// work in CI without a running backend.
const externalBase = process.env.PLAYWRIGHT_BASE_URL;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: externalBase || 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  // Auto-start static file server for CI / local runs without Docker.
  // reuseExistingServer:true means it won't start a duplicate if Docker is
  // already listening on :8080.
  webServer: externalBase ? undefined : {
    command: 'node tests/e2e/mock-static-server.js',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: true,
    timeout: 20000,
  }
});
