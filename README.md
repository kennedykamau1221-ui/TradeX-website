# TradeX Website — combined starter build

Responsive website form for desktop and Android browsers. Includes a market dashboard, provider-backed quote/analysis endpoints, candlestick chart, technical-analysis summaries, a local demo-trading simulator, demo wallet request forms, and a protected administrator risk-settings panel.

## What works in this build
- Website UI: Overview, Markets, Trade, Wallet, Analysis and Admin sections.
- Provider-backed read-only quotes and candles for XAU/USD, EUR/USD, GBP/USD and BTC/USD when a valid Twelve Data API key is configured.
- RSI/EMA/structure/FVG/order-block summaries from the included analysis module.
- Demo trades use virtual funds and browser-local storage only.
- Deposit/withdrawal forms create local demo requests only; they do not process payments.
- MT5 bridge source is included for future integration/testing, but live trading is disabled by default.

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Set a long random `ADMIN_TOKEN` and `BRIDGE_TOKEN`; add a valid `TWELVE_DATA_API_KEY` if you have one.
4. For local use set `PUBLIC_URL=http://localhost:8787` and `ALLOWED_ORIGINS=http://localhost:8787` (or leave ALLOWED_ORIGINS blank for development).
5. Run `npm install` then `npm start`.
6. Open `http://localhost:8787`.

Without a market-data API key, the website and demo simulator still open, but live quotes and candle analysis will show a setup message.

## Deploy as a website
- Deploy this Node.js project to a host that supports Node.js.
- Configure the environment variables from `.env.example` in the hosting dashboard.
- Set `PUBLIC_URL` to your HTTPS website address and `ALLOWED_ORIGINS` to that same origin.
- Use HTTPS, a strong admin/bridge token, protected server logs, backups, and a managed database before public production use.
- Keep `.env`, API keys, broker credentials and MT5 credentials out of source control and browser code.

## Trading and payment limits
This is a website starter/prototype, not a licensed broker or a payment processor. Demo trades and wallet requests are browser-local and are not real financial transactions. Real deposits, withdrawals, customer accounts, synthetic indices and live orders require secure server-side account/ledger implementation, a suitable authorized provider, testing, and legal/regulatory review. Live MT5 execution remains disabled by default. Never use a simulated market as if it were a real provider market.

## MT5 bridge
`TradeXBridge.mq5` is included for controlled testing with MT5. Do not enable real trading until the bridge, broker permissions, risk controls, deployment security, and legal requirements have been independently reviewed. The administrator interface does not provide a function to secretly alter real market prices or manufacture customer losses.
