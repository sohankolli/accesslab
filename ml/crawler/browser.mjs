// Browser launch options. CHROMIUM_PATH points at an existing Chromium when
// Playwright's own download is not available (for example on a locked-down CI).
export function launchOptions() {
  return process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
}
