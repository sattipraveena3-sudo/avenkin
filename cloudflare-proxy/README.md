# Avenkin public URL proxy

This Worker powers the public Avenkin address:

- <https://avenkin.sattipraveena3.workers.dev/>

It forwards requests to the full-stack Avenkin deployment. Deploy `worker.js` as the `avenkin` Worker in Cloudflare Workers & Pages.

The alert runner remains protected by `ALERT_CRON_SECRET` on the application backend. Never place that secret in this Worker or commit it to GitHub.
