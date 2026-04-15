# Ethereum Trading Analysis Platform

A production-grade web-based platform for Ethereum spot trading analysis with AI-powered trading suggestions. Combines technical analysis, machine learning (XGBoost), social sentiment (Reddit + News), and on-chain data to generate explainable BUY/SELL/HOLD signals with entry zones, stop-loss, and take-profit levels.

> **Disclaimer:** This platform provides trading suggestions for educational and analytical purposes only. It does NOT execute trades automatically. All trading decisions are the user's sole responsibility. Cryptocurrency trading carries significant risk.

---

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Setup & Installation](#setup--installation)
- [Running the Platform](#running-the-platform)
- [Training the ML Model](#training-the-ml-model)
- [Signal Generation Logic](#signal-generation-logic)
- [WebSocket Events](#websocket-events)
- [Scheduled Jobs](#scheduled-jobs)
- [Troubleshooting](#troubleshooting)
- [Production Notes](#production-notes)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   FRONTEND  (React 18 + Vite)                    │
│                                                                  │
│  Dashboard → TradingView Chart → Indicators Panel               │
│  Signal Card → News Sentiment → Multi-Timeframe Panel           │
│  Real-time via Socket.io-client + Zustand state store           │
└──────────────────────┬───────────────────────────────────────────┘
                       │  HTTP REST + WebSocket
                       │
        ┌──────────────┴────────────────┐
        │                               │
┌───────▼──────────────────┐   ┌────────▼──────────────┐
│   BACKEND  (Express.js)  │   │  ML SERVICE (FastAPI) │
│                          │   │                       │
│  REST Routes:            │   │  POST /predict        │
│  /api/market/*           │   │  POST /train          │
│  /api/analysis/*         │   │  GET  /health         │
│  /api/patterns/*         │   │  POST /sentiment/*    │
│  /api/signals/*          │   │                       │
│                          │   │  XGBoost classifier   │
│  14 Business Services    │   │  16-feature engineer  │
│  WebSocket Gateway       │   │  Sentiment analysis   │
│  Cron Scheduler          │◄──►  PostgreSQL reader    │
└──────────────────────────┘   └───────────────────────┘
        │                               │
        │                               │
   ┌────┴─────────────────────────┐     │
   │                              │     │
┌──▼──────────┐    ┌─────────┐   │     │
│ PostgreSQL  │    │  Redis  │   │     │
│             │    │         │   │     │
│ ohlcv_data  │    │ price   │◄──┘     │
│ indicators  │    │ ohlcv   │         │
│ patterns    │    │ indic.  │         │
│ signals     │    │ news    │         │
│ sentiments  │    │ reddit  │         │
└─────────────┘    └─────────┘         │
        ▲                              │
        │   CCXT / Binance API         │
        └──────────────────────────────┘
```

### Data Flow

1. **Binance API** → Market Service → PostgreSQL + Redis (4s price cache, 60s OHLCV cache)
2. **OHLCV** → Analysis Service → 13 technical indicators → PostgreSQL
3. **Indicators + OHLCV** → Pattern Service → 10 candlestick patterns → PostgreSQL
4. **Google News RSS** → News Service → Gemini LLM (sentiment) → Redis (30min cache)
5. **Reddit subreddits** → Reddit Service → keyword scoring → Redis (15min cache)
6. **Binance Futures** → On-chain Service → L/S ratios, taker sentiment → Redis
7. **All data** → Signal Service → ML Service prediction → PostgreSQL + WebSocket broadcast
8. **Frontend** ← Socket.io live updates (price every 5s, signals on-demand)

---

## Features

### Technical Analysis
- Multi-timeframe candlestick charts: 1m, 5m, 15m, 30m, 1h, 4h, 1d
- **13 indicators:** RSI (14-period), MACD (12/26/9), EMA (9/21/50/200), VWAP, ATR, Bollinger Bands (upper/middle/lower), OBV + OBV SMA
- **10 candlestick patterns:** Doji, Hammer, Inverted Hammer, Shooting Star, Bullish Engulfing, Bearish Engulfing, Morning Star, Evening Star, Three White Soldiers, Three Black Crows — all using traditional definitions (Three Soldiers/Crows require each candle to open within the prior body, not gap-up)
- Support & Resistance level calculation with pivot points
- Market structure analysis (higher highs / higher lows)
- Divergence detection (price vs RSI, price vs MACD)
- Multi-timeframe confluence (1h + 4h + 1d consensus)
- Volume profile and OBV tracking

### AI & Machine Learning
- **XGBoost multi-class classifier** (Up / Down / Neutral)
- **16 engineered features** from raw indicators
- Confidence scoring: High (>75%), Medium (>60%), Low (<60%)
- Model training on historical PostgreSQL data (500+ candles)
- Auto-retraining weekly via cron job
- Fallback to technical analysis when ML unavailable

### Trading Signals
- BUY / SELL / HOLD / BLOCKED signal types
- Entry zone: ±0.5% band around entry price
- Stop-loss: 1.5× ATR from entry
- Three take-profit levels: 1×, 2×, 3× ATR above entry
- Risk/Reward ratio enforcement (2:1 minimum)
- Confidence threshold filter (65%+ required)
- Explainable JSON reasoning breakdown per signal
- Circuit breaker: max daily signals, consecutive loss protection

### Sentiment Analysis
- **News:** Google News RSS → Google Gemini 2.5-flash LLM → bullish/bearish/neutral score
- **Reddit:** r/ethereum, r/ethtrader, r/CryptoCurrency → keyword-weighted scoring
- **On-chain:** Binance Futures long/short ratios, top trader positions, taker buy/sell ratios
- **Market Intelligence:** composite score across all sources → signal boost/penalty

### Real-time Data
- WebSocket live price feed (5s intervals via Socket.io)
- Real-time indicator and signal broadcasting
- Persistent connections with auto-reconnect
- Zustand connection state store on frontend

### Risk Management
- Position sizing recommendations (ATR-based)
- Daily win/loss and win-rate tracking
- Consecutive loss circuit breaker
- Profit/loss percent tracking per closed signal

---

## Tech Stack

### Frontend
| Package | Version | Purpose |
|---|---|---|
| React | 18.2.0 | UI framework |
| Vite | 5.0.11 | Build tool & dev server |
| React Router DOM | 6.21.1 | Client-side routing |
| Zustand | 4.4.7 | Lightweight state management |
| Lightweight Charts | 4.1.1 | TradingView-style candlestick chart |
| Axios | 1.6.5 | HTTP client |
| Socket.io-client | 4.6.1 | WebSocket connection |
| Tailwind CSS | 3.4.1 | Utility-first styling |
| Lucide React | 0.309.0 | Icon set |
| Date-fns | 3.2.0 | Date formatting |

### Backend
| Package | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Runtime |
| Express.js | 4.18.2 | Web framework |
| Sequelize | 6.35.2 | PostgreSQL ORM |
| pg | 8.11.3 | PostgreSQL driver |
| Redis | 4.6.12 | Cache client |
| Socket.io | 4.6.1 | WebSocket server |
| CCXT | 4.2.25 | Binance exchange connectivity |
| technicalindicators | 3.1.0 | RSI, MACD, EMA, ATR calculations |
| node-cron | 3.0.3 | Scheduled data collection |
| Axios | 1.6.5 | HTTP calls to ML service |
| Joi | 17.11.0 | Request validation |
| Helmet | 7.1.0 | HTTP security headers |
| express-rate-limit | 7.1.5 | Rate limiting |
| Winston | 3.11.0 | Structured logging |
| dotenv | 16.3.1 | Environment config |
| Nodemon | 3.0.2 | Dev hot-reload |

### ML Service
| Package | Version | Purpose |
|---|---|---|
| Python | 3.10+ | Runtime |
| FastAPI | 0.109.0 | Async API framework |
| Uvicorn | 0.27.0 | ASGI server |
| XGBoost | ≥2.1.0 | Gradient boosting classifier |
| scikit-learn | ≥1.5.0 | ML utilities, train/test split |
| pandas | ≥2.2.0 | Data manipulation |
| NumPy | ≥2.0.0 | Numerical operations |
| TA-Lib | 0.6.0 | Technical analysis (compiled from source) |
| joblib | 1.3.2 | Model serialization |
| SQLAlchemy | 2.0.46 | Async DB queries |
| psycopg2-binary | 2.9.10 | PostgreSQL driver |
| Pydantic | ≥2.10.0 | Request/response validation |
| python-dotenv | 1.0.0 | Environment config |

### Infrastructure
| Component | Image | Purpose |
|---|---|---|
| PostgreSQL | postgres:15-alpine | Primary database |
| Redis | redis:7-alpine | Caching + real-time data |
| Backend container | node:18-alpine | Express.js API |
| ML container | python:3.10-slim | FastAPI ML service |
| Frontend container | node:18-alpine | Vite dev server |

---

## Project Structure

```
eth-trading-platform/
├── backend/
│   ├── src/
│   │   ├── server.js                    # Express app entry point
│   │   ├── models/
│   │   │   ├── index.js                 # Sequelize init + sync
│   │   │   ├── ohlcv.model.js           # OHLCV candle table
│   │   │   ├── indicator.model.js       # Computed indicator table
│   │   │   ├── pattern.model.js         # Detected pattern table
│   │   │   └── signal.model.js          # Generated signal table
│   │   ├── controllers/
│   │   │   ├── market.controller.js
│   │   │   ├── analysis.controller.js
│   │   │   ├── patterns.controller.js
│   │   │   └── signals.controller.js
│   │   ├── routes/
│   │   │   ├── market.routes.js
│   │   │   ├── analysis.routes.js
│   │   │   ├── patterns.routes.js
│   │   │   └── signals.routes.js
│   │   ├── services/
│   │   │   ├── market.service.js        # Price/OHLCV fetch + cache
│   │   │   ├── analysis.service.js      # 13 indicator calculations
│   │   │   ├── pattern.service.js       # 10 candlestick patterns
│   │   │   ├── signal.service.js        # Main signal orchestrator
│   │   │   ├── scheduler.service.js     # Cron job manager
│   │   │   ├── news.service.js          # News RSS + Gemini sentiment
│   │   │   ├── reddit.service.js        # Reddit keyword scoring
│   │   │   ├── onchain.service.js       # L/S ratios, taker data
│   │   │   ├── marketIntel.service.js   # Composite sentiment
│   │   │   ├── divergence.service.js    # RSI/MACD divergence
│   │   │   ├── supportResistance.service.js
│   │   │   ├── marketStructure.service.js
│   │   │   ├── multiTimeframe.service.js
│   │   │   └── riskManager.service.js
│   │   ├── database/
│   │   │   └── config/
│   │   │       ├── database.js          # Sequelize PostgreSQL config
│   │   │       └── redis.js             # Redis client config
│   │   ├── websocket/
│   │   │   └── websocket-server.js      # Socket.io server + broadcaster
│   │   ├── middleware/
│   │   │   └── error-handler.js
│   │   └── utils/
│   │       └── logger.js                # Winston logger
│   ├── .env                             # Environment variables (local)
│   ├── .env.example
│   ├── package.json
│   ├── Dockerfile
│   └── logs/
│       ├── combined.log
│       └── error.log
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx                     # Vite entry point
│   │   ├── App.jsx                      # Root component
│   │   ├── components/
│   │   │   ├── Dashboard/               # Main trading dashboard
│   │   │   ├── Chart/                   # Lightweight Charts candlestick
│   │   │   ├── Indicators/              # RSI, MACD, ATR display panel
│   │   │   ├── Signals/                 # Signal card + news sentiment
│   │   │   └── MultiTimeframe/          # 1h/4h/1d consensus view
│   │   ├── services/
│   │   │   ├── api.js                   # Axios client (all endpoints)
│   │   │   └── websocket.js             # Socket.io + Zustand store
│   │   └── styles/
│   ├── public/
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── Dockerfile
│
├── ml-service/
│   ├── main.py                          # FastAPI application
│   ├── services/
│   │   ├── feature_engineering.py       # 16-feature transformer
│   │   ├── model_trainer.py             # XGBoost training pipeline
│   │   ├── predictor.py                 # Inference (load + predict)
│   │   ├── sentiment_collector.py       # Reddit data collection
│   │   └── sentiment_model.py           # Sentiment classifier
│   ├── utils/
│   │   └── database.py                  # Async PostgreSQL queries
│   ├── models/                          # Saved .joblib model files
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   └── venv/
│
├── docker-compose.yml
├── package.json                         # Monorepo root scripts
├── README.md
├── ARCHITECTURE.md
├── API.md
└── QUICKSTART.md
```

---

## Database Schema

### `ohlcv_data`
```sql
id            UUID PRIMARY KEY
symbol        VARCHAR(20)                          -- e.g. ETHUSDT
timeframe     ENUM('1m','5m','15m','30m','1h','4h','1d')
timestamp     BIGINT                               -- milliseconds epoch
open          DECIMAL(18,8)
high          DECIMAL(18,8)
low           DECIMAL(18,8)
close         DECIMAL(18,8)
volume        DECIMAL(18,4)
createdAt     TIMESTAMP

UNIQUE INDEX  (symbol, timeframe, timestamp)
INDEX         (symbol, timeframe)
```

### `indicators`
```sql
id            UUID PRIMARY KEY
symbol        VARCHAR(20)
timeframe     ENUM('1m','5m','15m','30m','1h','4h','1d')
timestamp     BIGINT
rsi           DECIMAL(10,2)
macd          DECIMAL(18,8)
macdSignal    DECIMAL(18,8)
macdHistogram DECIMAL(18,8)
ema9          DECIMAL(18,8)
ema21         DECIMAL(18,8)
ema50         DECIMAL(18,8)
ema200        DECIMAL(18,8)
vwap          DECIMAL(18,8)
atr           DECIMAL(18,8)
bollingerUpper  DECIMAL(18,8)
bollingerMiddle DECIMAL(18,8)
bollingerLower  DECIMAL(18,8)
obv           DECIMAL(24,4)
obvSma        DECIMAL(24,4)
createdAt     TIMESTAMP

INDEX         (symbol, timeframe, timestamp)
```

### `patterns`
```sql
id            UUID PRIMARY KEY
symbol        VARCHAR(20)
timeframe     ENUM('1m','5m','15m','30m','1h','4h','1d')
timestamp     BIGINT
patternType   ENUM('doji','hammer','inverted_hammer','shooting_star',
                   'bullish_engulfing','bearish_engulfing',
                   'morning_star','evening_star',
                   'three_white_soldiers','three_black_crows')
signal        ENUM('bullish','bearish','neutral')
strength      INTEGER(1-100)
description   TEXT
createdAt     TIMESTAMP

INDEX         (symbol, timeframe, timestamp)
```

### `signals`
```sql
id               UUID PRIMARY KEY
symbol           VARCHAR(20)
timeframe        ENUM('1m','5m','15m','30m','1h','4h','1d')
signalType       ENUM('BUY','SELL','HOLD','BLOCKED')
status           ENUM('active','closed','expired')
confidence       DECIMAL(5,2)                     -- 0-100
entryPrice       DECIMAL(18,8)
entryZoneMin     DECIMAL(18,8)                    -- entry - 0.5%
entryZoneMax     DECIMAL(18,8)                    -- entry + 0.5%
stopLoss         DECIMAL(18,8)                    -- 1.5x ATR from entry
takeProfit1      DECIMAL(18,8)                    -- 1x ATR target
takeProfit2      DECIMAL(18,8)                    -- 2x ATR target
takeProfit3      DECIMAL(18,8)                    -- 3x ATR target
riskRewardRatio  DECIMAL(5,2)
reasoning        JSONB                            -- full explainability object
timestamp        BIGINT
closedAt         DATETIME
exitPrice        DECIMAL(18,8)
profitLossPercent DECIMAL(10,2)
createdAt        TIMESTAMP
updatedAt        TIMESTAMP

INDEX            (symbol, timeframe, createdAt)
INDEX            (status)
```

### `sentiment_data` (ML training)
```sql
id            UUID PRIMARY KEY
source        VARCHAR(50)                          -- 'reddit', 'news'
title         TEXT
content       TEXT
sentiment     ENUM('bullish','bearish','neutral')
confidence    DECIMAL(5,2)
manual_label  ENUM('bullish','bearish','neutral')  -- nullable
timestamp     DATETIME
```

### Redis Cache Keys
```
price:{symbol}                     TTL: 10s
ohlcv:{symbol}:{timeframe}:{limit} TTL: 60s
indicators:{symbol}:{timeframe}    TTL: 60s
news:headlines                     TTL: 30min
news:sentiment                     TTL: 30min
social:reddit:sentiment            TTL: 15min
onchain:ls:{symbol}                TTL: 5min
```

---

## API Reference

### Market API  `BASE: /api/market`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/price` | Current ETH/USDT price |
| GET | `/ohlcv?symbol=ETHUSDT&timeframe=1h&limit=100` | Historical candles |
| GET | `/volume` | Volume analysis |
| GET | `/24h-stats` | 24h high/low stats |
| POST | `/fetch?symbol=ETH/USDT&timeframe=1h&limit=500` | Fetch & store fresh data from Binance |

### Analysis API  `BASE: /api/analysis`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/indicators?symbol=ETHUSDT&timeframe=1h` | Latest computed indicators |
| GET | `/multi-timeframe?symbol=ETHUSDT` | Parallel 1h + 4h + 1d analysis |
| POST | `/calculate?symbol=ETHUSDT&timeframe=1h` | Force indicator recalculation |

### Patterns API  `BASE: /api/patterns`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/detect?symbol=ETHUSDT&timeframe=1h` | Detect candlestick patterns |
| GET | `/recent?symbol=ETHUSDT&timeframe=1h&limit=10` | Last N detected patterns |

### Signals API  `BASE: /api/signals`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/generate` | Generate trading signal (body: `{symbol, timeframe}`) |
| GET | `/latest?symbol=ETHUSDT&timeframe=1h` | Latest signal |
| GET | `/history?symbol=ETHUSDT&timeframe=1h&limit=20` | Signal history (paginated) |
| GET | `/news-sentiment` | News headlines + Gemini sentiment |
| GET | `/daily-stats` | Win rate, P&L, risk metrics |
| GET | `/market-intel` | Composite market intelligence |
| GET | `/reddit-sentiment` | Reddit multi-subreddit sentiment |
| GET | `/onchain` | Long/short ratios, taker sentiment |

### ML Service API  `BASE: http://localhost:8001`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| POST | `/predict` | Predict price direction (up/down/neutral) |
| POST | `/train` | Train XGBoost on historical data |
| GET | `/model/info` | Model metadata & accuracy |
| POST | `/features/engineer` | Transform indicators to 16 ML features |
| POST | `/sentiment/predict` | Single text sentiment prediction |
| POST | `/sentiment/predict-batch` | Batch sentiment predictions |
| POST | `/sentiment/collect` | Collect Reddit data & auto-label |
| POST | `/sentiment/train` | Train sentiment model |
| GET | `/sentiment/info` | Sentiment model status |

Interactive API docs available at: `http://localhost:8001/docs`

---

## WebSocket Events

Connect to: `ws://localhost:3001`

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `connected` | `{message}` | Connection acknowledged |
| `price_update` | `{symbol, price, timestamp}` | Live price (every 5s) |
| `new_signal` | Full signal object | New BUY/SELL/HOLD generated |
| `indicator_update` | Indicator values | Updated technical indicators |

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `subscribe` | `{symbol, timeframe}` | Subscribe to symbol/timeframe updates |
| `unsubscribe` | `{symbol, timeframe}` | Unsubscribe |

---

## Environment Variables

### `backend/.env`
```env
# Database
DATABASE_URL=postgresql://user:12345@localhost:5432/eth_trading

# Redis
REDIS_URL=redis://localhost:6379

# Exchange
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret

# ML Service
ML_SERVICE_URL=http://localhost:8001

# Server
PORT=3001
NODE_ENV=development

# LLM (for news sentiment analysis via Gemini)
GEMINI_API_KEY=your_google_gemini_api_key

# Optional
FRONTEND_URL=http://localhost:3000
```

### `frontend/.env`
```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### `ml-service/.env`
```env
DATABASE_URL=postgresql://user:12345@localhost:5432/eth_trading
MODEL_PATH=./models
LOG_LEVEL=INFO
```

> **Note:** The `GEMINI_API_KEY` is required for news sentiment analysis. Get a free key at [Google AI Studio](https://aistudio.google.com/). Binance API keys only need read permissions (no trading permissions required).

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker & Docker Compose
- Git

### 1. Clone the Repository

```bash
git clone <repository-url>
cd eth-trading-platform
```

### 2. Copy Environment Files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ml-service/.env.example ml-service/.env
```

### 3. Configure Environment Variables

Edit `backend/.env` and fill in your:
- `BINANCE_API_KEY` and `BINANCE_API_SECRET` (read-only Binance API keys)
- `GEMINI_API_KEY` (Google Gemini API key for news sentiment)

### 4. Install Dependencies (Manual setup only)

```bash
# Root + all workspaces
npm run install:all

# ML Service Python deps
cd ml-service
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

> **Note:** TA-Lib requires compilation from source. On macOS: `brew install ta-lib`. On Ubuntu: `apt-get install ta-lib`. The Docker image handles this automatically.

---

## Running the Platform

### Option A: Docker Compose (Recommended)

```bash
# Start all services (PostgreSQL, Redis, Backend, ML Service, Frontend)
npm run docker:up

# Stop all services
npm run docker:down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
```

**Ports after startup:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- ML Service (FastAPI docs): http://localhost:8001/docs
- PostgreSQL: localhost:5433 (mapped from 5432 internally)
- Redis: localhost:6379

### Option B: Manual Setup

```bash
# Terminal 1: PostgreSQL
docker run -d -p 5432:5432 \
  -e POSTGRES_DB=eth_trading \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=12345 \
  postgres:15-alpine

# Terminal 2: Redis
docker run -d -p 6379:6379 redis:7-alpine

# Terminal 3: Backend (auto-syncs DB schema on start)
cd backend && npm run dev

# Terminal 4: ML Service
cd ml-service
source venv/bin/activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001

# Terminal 5: Frontend
cd frontend && npm run dev
```

### Available Scripts (Root `package.json`)

```bash
npm run dev:backend      # Start backend with nodemon (hot reload)
npm run dev:frontend     # Start frontend Vite dev server
npm run dev:ml           # Start ML service with uvicorn --reload
npm run build:frontend   # Build optimized frontend bundle
npm run docker:up        # Start all Docker Compose services
npm run docker:down      # Stop and remove all containers
npm run install:all      # Install dependencies in all packages
```

### Seed Initial Data

After services are running, fetch historical data to bootstrap the database:

```bash
# Fetch 500 candles of historical 1h data
curl -X POST "http://localhost:3001/api/market/fetch?symbol=ETH/USDT&timeframe=1h&limit=500"

# Calculate indicators on the fetched data
curl -X POST "http://localhost:3001/api/analysis/calculate?symbol=ETHUSDT&timeframe=1h"

# Generate your first signal
curl -X POST "http://localhost:3001/api/signals/generate" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"ETHUSDT","timeframe":"1h"}'
```

Then open http://localhost:3000 in your browser.

---

## Training the ML Model

The system uses a fallback technical-analysis-only mode until the ML model is trained.

```bash
# Train XGBoost on 500 historical 1h candles (stored in PostgreSQL)
curl -X POST "http://localhost:8001/train" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "ETHUSDT", "timeframe": "1h", "lookback_periods": 500}'
```

**Training pipeline:**
1. Fetch 500+ historical candles from PostgreSQL
2. Calculate all technical indicators per candle
3. Engineer 16 ML features (see table below)
4. Create directional labels (±0.5% 5-candle forward-looking) — only for rows with enough future data; last `look_ahead` rows are excluded to prevent false neutral labels
5. **Chronological split** — first 80% trains, last 20% tests. Time order is preserved; random shuffling is not used on time-series data
6. Train XGBoost (`n_estimators=100`, `max_depth=5`, `learning_rate=0.1`, 3 classes)
7. Evaluate accuracy and classification report
8. Save `.joblib` model file to `/models/`

> **Note:** The reported accuracy reflects real out-of-sample future data (chronological split), not an inflated in-sample estimate.

**16 Engineered Features:**

| # | Feature | Description |
|---|---|---|
| 1 | RSI raw | 14-period RSI value |
| 2 | RSI normalized | (RSI − 50) / 50 → centered around 0 |
| 3 | MACD | MACD line value |
| 4 | MACD Signal | Signal line value |
| 5 | MACD Histogram | MACD − Signal |
| 6 | EMA 9 | 9-period EMA |
| 7 | EMA 21 | 21-period EMA |
| 8 | EMA 50 | 50-period EMA |
| 9 | EMA 9/50 ratio | EMA9 / EMA50 — trend momentum |
| 10 | EMA trend strength | (EMA9 − EMA50) / EMA50 × 100 |
| 11 | VWAP | Volume-weighted average price |
| 12 | ATR raw | 14-period Average True Range |
| 13 | ATR normalized | ATR / avg(EMA9,EMA21) × 100 — volatility % |
| 14 | Price / EMA9 ratio | close / EMA9 — distance from short-term average |
| 15 | Price / EMA21 ratio | close / EMA21 — distance from medium-term average |
| 16 | Price / VWAP ratio | close / VWAP — position relative to intraday value |

> Features 14–16 use the actual close price sent from the backend on every prediction call. Training uses the `close` column from the OHLCV join.

Sentiment model retraining is scheduled automatically every Sunday at 3 AM UTC.

---

## Signal Generation Logic

The `signal.service.js` orchestrates the full pipeline:

```
1.  Gate check: 15-min cooldown (Redis) + circuit breaker (daily loss limit)
2.  Fetch latest OHLCV + indicators from DB (or recalculate if stale)
    └─ Also fetch last 50 historical indicator rows for divergence detection
3.  Auto-close previous active signal if current price hit its SL or TP1
    └─ Records win/loss into circuit breaker (activates on ≥3 losses or ≥3% daily loss)
4.  Get candlestick pattern analysis (last 5 patterns, capped at +3 score each side)
5.  Fetch news sentiment (Gemini LLM, 30-min cache)
6.  Fetch Reddit sentiment (keyword scoring, 15-min cache)
7.  Fetch on-chain data (Binance Futures L/S ratios, 5-min cache)
8.  Run multi-timeframe analysis (1h + 4h + 1d consensus)
9.  Detect RSI + MACD divergence using proper pivot-based detection
    └─ Compares two consecutive price pivots vs two RSI/MACD pivots
    └─ Falls back to no-divergence if fewer than 10 historical indicator rows exist
10. Calculate support/resistance levels
11. Analyze market structure (HH/HL trend) — can VETO signal on CHoCH
12. Call ML Service → get direction + confidence (POST /predict, 5s timeout)
    └─ Fallback: indicator analysis direction at 50% probability
13. Market Intel scoring — can VETO signal (extreme fear/greed override)
14. Compute confidence = (ratio × 60) + (magnitude × 35), capped at 95
    └─ Both alignment ratio AND total score magnitude contribute
15. Apply confidence threshold filter (≥65% required for BUY/SELL)
16. Calculate entry zone (±0.3%), stop-loss (1.5×ATR), take-profits (1.5×/3×/5×ATR)
17. Calculate position sizing (ATR-adjusted, default 1.5% account risk)
18. Build reasoning JSON (all analysis inputs + score breakdown + position size)
19. Save signal to PostgreSQL (ALL signal types including HOLD and VETOED)
20. Set cooldown key in Redis (15-min TTL)
21. Broadcast BUY/SELL via WebSocket to all subscribed clients
```

**Signal Types:**
- `BUY` — high-confidence bullish signal meeting all filters
- `SELL` — high-confidence bearish signal meeting all filters
- `HOLD` — insufficient conviction or conflicting signals (saved to DB for audit)
- `VETOED` — overridden by market structure CHoCH or extreme market intel (saved to DB)
- `BLOCKED` — circuit breaker active: ≥3 losses today or total daily loss ≥3%

**Confidence Formula:**
```
ratio     = max(bullishScore, bearishScore) / totalScore
magnitude = min(1.0, max(bullishScore, bearishScore) / 14)
confidence = min(95, (ratio × 60) + (magnitude × 35))
```
A signal with `bull=2, bear=1` scores ~49% (HOLD). A signal with `bull=9, bear=3` scores ~80% (BUY). Higher absolute conviction increases confidence, not just the ratio.

---

## Scheduled Jobs

All cron jobs are managed by `scheduler.service.js` using `node-cron`:

| Schedule | Job | Description |
|---|---|---|
| Every 1 min | Fetch 1m OHLCV | Update 1-minute candles from Binance |
| Every 5 min | Fetch 5m OHLCV | Update 5-minute candles |
| Every 15 min | Fetch 15m OHLCV | Update 15-minute candles |
| Every 1 hour | Fetch + analyze 1h | Fetch candles + calculate indicators |
| Every 4 hours | Fetch + analyze 4h | Fetch candles + calculate indicators |
| Every 24 hours | Fetch + analyze 1d | Fetch daily candles + indicators |
| 6:00 AM UTC daily | Sentiment collection | Collect Reddit + news for ML training |
| 3:00 AM UTC Sunday | Retrain sentiment model | Weekly sentiment model update |

---

## Troubleshooting

### No Data Showing on Chart
```bash
# Manually seed historical data
curl -X POST "http://localhost:3001/api/market/fetch?symbol=ETH/USDT&timeframe=1h&limit=500"
```

### ML Service Errors
The system falls back to technical-analysis-only if ML is unavailable.
```bash
docker-compose logs ml-service
# Check if TA-Lib compiled correctly
```

### WebSocket Not Connecting
```bash
# Check backend is running and CORS allows frontend origin
docker-compose logs backend
# Verify FRONTEND_URL in backend/.env matches your frontend URL
```

### Database Connection Issues
```bash
# Check PostgreSQL is healthy
docker ps | grep postgres
docker exec -it eth-trading-postgres psql -U user -d eth_trading \
  -c "SELECT COUNT(*) FROM ohlcv_data;"
```

### Gemini API Not Working
- Verify `GEMINI_API_KEY` is set in `backend/.env`
- News sentiment will return neutral as fallback
- Signals still generate using technical analysis only

### Port Conflicts
Docker Compose maps PostgreSQL to external port **5433** (not 5432) to avoid conflicts with local Postgres. Update `DATABASE_URL` accordingly if running the backend manually against Docker PostgreSQL:
```env
DATABASE_URL=postgresql://user:12345@localhost:5433/eth_trading
```

---

## Production Notes

### Security Gaps (Not Production-Ready As-Is)
- No API authentication (JWT/API keys) — all endpoints are open
- Database credentials are hardcoded in `docker-compose.yml`
- No HTTPS/WSS (TLS) configured
- `rate-limit` package included but not enforced on all routes

### Recommended Hardening Before Production
1. Add JWT authentication middleware on all API routes
2. Move secrets to environment secrets manager (AWS Secrets Manager, HashiCorp Vault)
3. Enable HTTPS via reverse proxy (Nginx + Let's Encrypt)
4. Enforce `express-rate-limit` on public endpoints
5. Add request audit logging
6. Enable PostgreSQL SSL connections
7. Use Redis AUTH with a password
8. Add CAPTCHA for any public-facing signal endpoints
9. Run PostgreSQL and Redis without exposed ports (internal Docker network only)
10. Use Kubernetes with horizontal pod autoscaling for load

### Scaling
- Backend: stateless, horizontally scalable behind a load balancer
- PostgreSQL: add read replicas for indicator/OHLCV query offloading
- Redis: upgrade to Redis Cluster for HA
- ML Service: independent scaling based on prediction load

---

## License

MIT
