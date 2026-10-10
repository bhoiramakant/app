# SmartTradeLens — Plan

A personal trade-setup assistant for stocks (US and Indian) and crypto. It reads market data, checks your chosen strategy's conditions, and tells you when a setup is ready.
An AI agent watches your watchlist, sends alerts on what to do, and gets you into Robinhood, CoinDCX, Kite or TradingView with one tap.

## Who it's for
Individual traders who follow rule-based strategies (Super Trend, MA Crossover, Option Selling) across US stocks, Indian stocks and crypto. They want one place to see which setups are ready, without checking charts by hand.

## Core features and experience
- **Account + app lock**: You sign up with email and password, so your watchlist and settings sync to the cloud. After that, each time you open the app it unlocks with your fingerprint, and a 4–6 digit PIN works as the backup.
- **Trade Setups (main screen)**
  - Strategy chips: Super Trend, MA Crossover, Option Selling
  - Timeframe chips: Hourly, Daily, Weekly, Monthly
  - Buy / Sell filter
  - Symbol cards show: name and market, last price, Bullish/Bearish badge, a "Setup Ready" indicator, a Short-term/Long-term label, any upcoming setup alert, and a ✓/✗ checklist of the strategy's conditions (e.g. price above Super Trend, RSI range, fast MA crossed slow MA)
- **Watchlist management**: Search and add symbols (US stocks, Indian stocks, crypto). Swipe to remove. A starter list is preloaded.
- **Trade button**: A bright orange "Trade" button on each card opens a bottom sheet with Robinhood, CoinDCX, Kite (Zerodha) and TradingView. If an app isn't installed, the sheet shows a short message and opens its Play Store page.
- **Open in TradingView**: Opens the TradingView app on that symbol. If TradingView isn't installed, it opens the TradingView website instead.
- **AI Setup Agent**: Runs in the background on the server. Several times a day it rescans your watchlist and writes plain-language alerts such as "BTC Daily Super Trend flipped bullish, setup ready: consider a long entry, invalidates below X." Alerts go to an in-app Alerts inbox and show as a badge on the app.
- **Dashboard**: A market overview with major indices and top crypto, your number of ready setups, and the latest agent alerts.
- **Charts**: A price chart per symbol with Super Trend, moving averages and RSI overlays, plus a timeframe switch.
- **News & Sentiment**: Headlines for your watchlist symbols. Each one has an AI tag (Bullish/Bearish/Neutral) and a one-line reason, and there's an overall mood summary.
- **Offline / cache-first**: The app shows the last data it fetched straight away and refreshes in the background. With no connection you still see your last data, with a "last updated" time.

## User flow
1. First launch: sign up or log in → set a PIN → turn on fingerprint unlock.
2. Later launches: fingerprint (or PIN) → Dashboard.
3. Bottom tabs: **Dashboard · Setups · Charts · News**. Alerts and Settings open from the header.
4. On Setups, pick a strategy and timeframe → check the cards → tap a card to see the full checklist and chart → tap **Trade** → choose the app.
5. When an agent alert arrives → open it → go straight to that symbol's setup card.

## UI/UX feel
- Dark theme with a saffron/bhagwa orange accent, clean Material Design 3 style.
- Green and red only for bullish and bearish. Orange is kept for actions: Trade buttons and Setup Ready.
- Dense but easy to scan cards, a sticky row of filter chips, pull-to-refresh, and quick press animations.
- Logo: a stylized orange "S" made of an upward trend line, with a magnifying glass.

**Screen mockups:** `/app/plan/mockups.html` has 8 screens: Sign in, Fingerprint/PIN unlock, Dashboard, Trade Setups, Trade bottom sheet, Charts, News & Sentiment, and AI Agent Alerts. The final build follows these layouts and colours.

## Implementation phases
**Phase 1 — MVP (built now)**
- Email login with cloud sync, plus fingerprint and PIN app lock
- Setups screen with all strategies, timeframes, Buy/Sell filter, cards and checklists
- Super Trend, MA Crossover and RSI worked out from real data. Option Selling is judged on the underlying price only (range-bound, low trend strength, RSI neutral).
- Real data from Alpha Vantage (stocks) and CoinGecko (crypto), with server-side caching and offline cache in the app
- Trade bottom sheet with app launch and Play Store fallback, plus Open in TradingView
- AI Setup Agent with scheduled scans and an in-app Alerts inbox
- Dashboard, Charts with indicator overlays, and News with AI sentiment

**Phase 2**
- Push notifications to your phone for agent alerts. These need the published Android build and a Firebase `google-services.json` file, and won't work in Expo Go.
- Custom strategy settings (Super Trend period and multiplier, MA lengths, RSI levels)
- Price-level alerts you set yourself

**Phase 3**
- Real option-chain data for Option Selling (IV, premiums, strikes)
- Backtesting each strategy on past data
- Trade journal and P&L notes

## Assumptions
- It's built as a cross-platform Expo app aimed at Android. It covers the same ground as the requested BiometricPrompt, secure PIN storage, Room cache and ViewModel state, using the Expo/React Native equivalents of each. Fingerprint unlock works in Expo Go on Android.
- **Alpha Vantage free tier (25 calls/day) is the main limit.** Stock data is fetched by the server and shared across users. Daily, weekly and monthly data is refreshed about once a day. Hourly data is limited to a few US stocks. You'll need to supply your free Alpha Vantage API key.
- Alpha Vantage covers Indian stocks through their BSE listings (e.g. RELIANCE.BSE), not NSE. It has no hourly data for Indian stocks, so the Hourly timeframe there shows "not available".
- CoinGecko's free public API is used with no key. Crypto hourly data comes from CoinGecko's short-range history.
- The AI agent and news sentiment use Claude Sonnet through the Emergent Universal Key, so there's no separate AI bill. Usage draws on your Universal Key balance, and scans are limited to a few per day to keep that low.
- News headlines come from Alpha Vantage's news feed. They share the same daily call budget and are cached.
- Bullish/Bearish comes from Super Trend direction. Short-term means Hourly/Daily, Long-term means Weekly/Monthly. "Upcoming setup" means all but one checklist condition is met.
- The deep links open each broker's app and, where it's supported, the symbol's page. Placing orders inside those apps isn't automated.
- Starter watchlist: AAPL, TSLA, NVDA, RELIANCE, INFY, TCS, BTC, ETH, SOL.
- Prices are shown in each market's own currency (USD or INR). The app is for analysis only and isn't financial advice. This disclaimer appears in Settings and on the Trade sheet.
