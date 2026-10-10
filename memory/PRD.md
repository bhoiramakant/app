# SmartTradeLens — PRD

## Original problem
Android app "SmartTradeLens": personal financial analysis & trade-setup assistant. Fingerprint + PIN auth; Trade Setups & Watchlist (strategy chips Super Trend / MA Crossover / Option Selling, timeframe Hourly/Daily/Weekly/Monthly, Buy/Sell, cards with bullish/bearish, setup ready, short/long term, upcoming alert, checklist); orange Trade button → bottom sheet (Robinhood, CoinDCX, Kite, TradingView, Play Store fallback); Open in TradingView; data from Alpha Vantage + CoinGecko with cache-first/offline; Dashboard, Charts, News & Sentiment; bottom nav; dark theme with bhagwa orange, MD3; "S" + magnifier logo. Approved plan: /app/plan/plan.md (+ AI Setup Agent alerts, email account sync).

## Architecture
- Expo Router (SDK 57) frontend; FastAPI + MongoDB backend; Claude Sonnet 4.6 via Emergent LLM key.
- backend: server.py (routes), market.py (AV budgeted refresher + CoinGecko cache), indicators.py, strategies.py, agent.py (alerts + news), catalog.py, db.py.
- Stocks: AV TIME_SERIES_DAILY + WEEKLY (monthly resampled), budget 24/day, shared Mongo cache. AV intraday & NEWS_SENTIMENT are premium → hourly is crypto-only; news from Yahoo Finance RSS.
- Frontend auth "ViewModel" in src/auth.tsx; PIN in secure storage; expo-local-authentication; cache-first hook src/cache.ts.

## Implemented (2026-10-10)
- JWT email auth, PIN setup/unlock/change, fingerprint toggle, auto-lock after 30s background
- Setups screen + detail, 3 strategies on real data, chips/filters, trade sheet + Android intent launch + Play Store fallback, TradingView deep link
- Dashboard, Charts (price/SuperTrend/MA20/MA50/RSI SVG), News w/ AI sentiment + mood, Alerts inbox + Scan now, scheduled agent scans 08:30/13:00/19:30 IST
- Watchlist search (catalog + CoinGecko) / add / swipe remove; starter list seeded
- Tested: iteration_1 backend 20/20, UI flows pass

## Implemented (2026-10-10, round 2)
- Custom strategy rules (per-user params: Super Trend period/mult, RSI period/zones, MA fast/slow/cross window, option-selling ADX/RSI) used by setups, charts, agent
- Price level alerts (above/below, 60s checker; crypto live, stocks last daily close) → in-app alert + push
- Emergent push relay: /api/register-push, send_push on agent alerts & price alerts; permission sheet, tap routing, weekly nudge. Needs google-services.json + published build.
- Tested: iteration_2 backend 11/11, UI flows pass

## Backlog
- P1: add google-services.json (user) and set android.googleServicesFile; shareable setup cards
- P2: option-chain data, backtesting, trade journal; app icon from logo
