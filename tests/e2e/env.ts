/** Everything the E2E run needs to agree on. These are throwaway values for a disposable database, not secrets. */
export const E2E_PORT = 3100;
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://portfolio:portfolio@localhost:5433/portfolio_e2e";
export const ADMIN_EMAIL = "e2e-admin@example.com";
export const ADMIN_PASSWORD = "e2e-test-password-123";
export const E2E_AUTH_SECRET = "e2e-only-auth-secret-not-used-anywhere-else-0123456789";
