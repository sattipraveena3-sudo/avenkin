export {};

declare global {
  interface Env {
    DB: D1Database;
    RESEND_API_KEY?: string;
    ALERT_FROM_EMAIL?: string;
    ALERT_CRON_SECRET?: string;
    ALERT_RUNNER_ACTIVE?: string;
  }

  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      RESEND_API_KEY?: string;
      ALERT_FROM_EMAIL?: string;
      ALERT_CRON_SECRET?: string;
      ALERT_RUNNER_ACTIVE?: string;
    }
  }
}
