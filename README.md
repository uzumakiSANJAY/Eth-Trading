# Ethereum Trading Analysis Platform

A comprehensive web-based platform for Ethereum spot and futures trading analysis with AI-powered suggestions.

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│             │         │              │         │             │
│  Frontend   │◄────────┤   Backend    │◄────────┤  ML Service │
│  (Next.js)  │  REST/WS│  (NestJS)    │  HTTP   │  (FastAPI)  │
│             │         │              │         │             │
└─────────────┘         └──────┬───────┘         └─────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              ┌─────▼──────┐       ┌─────▼─────┐
              │ PostgreSQL │       │   Redis   │
              │            │       │           │
              └────────────┘       └───────────┘
```

## Features

### Technical Analysis
- Multi-timeframe candlestick charts (1m, 5m, 15m, 1h, 4h, 1d)
- Technical indicators: RSI, MACD, EMA, VWAP, ATR
- Candlestick pattern detection (Doji, Hammer, Engulfing, etc.)
- Volume profile and order flow analysis

### AI Predictions
- ML-based price direction probability
- Feature engineering from historical data + indicators
- Confidence scores for each signal
- Explainable AI output

### Trading Signals
- BUY / HOLD / SELL suggestions
- Entry zone calculation
- Stop-loss levels based on ATR
- Take-profit targets
- Risk/reward ratio analysis

### Real-time Updates
- WebSocket connection for live price feeds
- Real-time indicator calculations
- Live signal updates

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **TradingView Lightweight Charts** - Candlestick visualization
- **Socket.io-client** - WebSocket connection

### Backend
- **NestJS** - Node.js framework
- **TypeORM** - Database ORM
- **PostgreSQL** - Primary database
- **Redis** - Caching and real-time data
- **Socket.io** - WebSocket gateway
- **ccxt** - Exchange connectivity

### ML Service
- **FastAPI** - Python API framework
- **scikit-learn** - ML algorithms
- **XGBoost** - Gradient boosting
- **pandas** - Data manipulation
- **TA-Lib** - Technical analysis library

## Setup

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd eth-trading-platform
```

2. Install dependencies
```bash
npm run install:all
cd ml-service && pip install -r requirements.txt
```

3. Set up environment variables

**backend/.env:**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/eth_trading
REDIS_URL=redis://localhost:6379
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
ML_SERVICE_URL=http://localhost:8001
PORT=3001
```

**frontend/.env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

**ml-service/.env:**
```env
MODEL_PATH=./models
DATABASE_URL=postgresql://user:password@localhost:5432/eth_trading
```

4. Start services

**Option A: Docker Compose**
```bash
npm run docker:up
```

**Option B: Manual**
```bash
# Terminal 1 - PostgreSQL and Redis
docker-compose up postgres redis

# Terminal 2 - Backend
npm run dev:backend

# Terminal 3 - ML Service
npm run dev:ml

# Terminal 4 - Frontend
npm run dev:frontend
```

5. Access the application
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- ML Service: http://localhost:8001/docs

## API Endpoints

### Backend (NestJS)

#### Market Data
- `GET /api/market/price` - Current ETH price
- `GET /api/market/ohlcv?timeframe=1h&limit=100` - Historical OHLCV data
- `WS /ws/market` - Real-time price updates

#### Technical Analysis
- `GET /api/indicators?timeframe=1h` - Calculate all indicators
- `GET /api/patterns?timeframe=1h` - Detect candlestick patterns
- `GET /api/analysis/volume` - Volume analysis

#### Signals
- `GET /api/signals/latest` - Latest trading signal
- `GET /api/signals/history?limit=50` - Signal history
- `POST /api/signals/generate` - Generate new signal

### ML Service (FastAPI)

- `POST /predict` - Get price direction probability
- `POST /train` - Train ML model
- `GET /model/info` - Model metadata
- `GET /health` - Service health check

## Development

### Project Structure
```
eth-trading-platform/
├── backend/               # NestJS API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── market/   # Market data fetching
│   │   │   ├── analysis/ # Technical indicators
│   │   │   ├── patterns/ # Pattern detection
│   │   │   ├── signals/  # Signal generation
│   │   │   └── ws/       # WebSocket gateway
│   │   ├── entities/     # Database models
│   │   └── main.ts
│   └── package.json
├── ml-service/           # Python FastAPI
│   ├── models/           # Trained models
│   ├── services/
│   │   ├── feature_engineering.py
│   │   ├── model_trainer.py
│   │   └── predictor.py
│   ├── main.py
│   └── requirements.txt
├── frontend/             # Next.js app
│   ├── app/
│   │   ├── dashboard/   # Main trading dashboard
│   │   └── layout.tsx
│   ├── components/
│   │   ├── charts/      # TradingView charts
│   │   ├── indicators/  # Indicator displays
│   │   └── signals/     # Signal cards
│   └── package.json
├── shared/              # Shared TypeScript types
└── docker/              # Docker configs
```

## Trading Logic

### Signal Generation Process

1. **Data Collection**: Fetch latest OHLCV data (100-500 candles)
2. **Indicator Calculation**: Compute RSI, MACD, EMA, VWAP, ATR
3. **Pattern Detection**: Identify candlestick patterns
4. **Feature Engineering**: Create ML features from indicators
5. **ML Prediction**: Get probability of price direction
6. **Signal Decision**: Apply trading rules with confidence threshold
7. **Risk Calculation**: Determine entry, stop-loss, take-profit levels

### Risk Management

- **Stop-Loss**: 1.5x ATR below entry for long, above for short
- **Take-Profit**: Risk/reward ratio of 2:1 minimum
- **Position Sizing**: Based on account risk percentage
- **Confidence Filter**: Only trade signals with >65% confidence

## Disclaimer

This platform provides trading suggestions for educational and analytical purposes only. It does NOT execute trades automatically. All trading decisions are the user's responsibility. Past performance does not guarantee future results. Cryptocurrency trading carries significant risk.

## License

MIT
# Eth-Trading
