# Website deployment quick guide

1. Upload this project to a Node.js host or deploy the ZIP using the host's supported workflow.
2. Configure environment variables from `.env.example` in the host dashboard. Do not upload a populated `.env` file.
3. Set `PUBLIC_URL=https://your-real-domain.example` and `ALLOWED_ORIGINS=https://your-real-domain.example`.
4. Add the provider market-data API key in the server environment.
5. Confirm the site is served over HTTPS and test in mobile Chrome.
6. Demo trading is local-only; deposits and withdrawals are request-form demos. Real-money services are not enabled by this package.

The package cannot create a public domain or hosting account for you. You will need to deploy it to a hosting provider and attach a domain to obtain a permanent public website URL.
