# Quick Start Guide

Get the ETH Trading Platform up and running in minutes!

## Prerequisites

- Node.js 18+
- Python 3.10+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (recommended)

## Option 1: Docker Compose (Recommended)

### 1. Clone and Setup

```bash
cd eth-trading-platform
cp backend/.env.example backend/.env
cp ml-service/.env.example ml-service/.env
cp frontend/.env.example frontend/.env.local
```

### 2. Configure Environment Variables

Edit `backend/.env`:
```env
DATABASE_URL=postgresql://eth_user:eth_password@postgres:5432/eth_trading
REDIS_URL=redis://redis:6379
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
ML_SERVICE_URL=http://ml-service:8001
PORT=3001
NODE_ENV=development
```

Edit `ml-service/.env`:
```env
DATABASE_URL=postgresql://eth_user:eth_password@postgres:5432/eth_trading
MODEL_PATH=./models
```

Edit `frontend/.env.local`:
```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### 3. Start All Services

```bash
docker-compose up -d
```

### 4. Access the Platform

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- ML Service: http://localhost:8001/docs

### 5. Initialize Data

```bash
# Fetch initial historical data
curl -X POST "http://localhost:3001/api/market/fetch?symbol=ETH/USDT&timeframe=1h&limit=500"

# Calculate indicators
curl -X POST "http://localhost:3001/api/analysis/calculate?symbol=ETHUSDT&timeframe=1h"

# Generate first signal
curl -X POST "http://localhost:3001/api/signals/generate" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"ETHUSDT","timeframe":"1h"}'
```

## Option 2: Manual Setup

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# ML Service
cd ../ml-service
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Start Services Individually

```bash
# Terminal 1: PostgreSQL
docker run -d -p 5432:5432 -e POSTGRES_DB=eth_trading -e POSTGRES_USER=user -e POSTGRES_PASSWORD=12345 postgres:15-alpine

# Terminal 2: Redis
docker run -d -p 6379:6379 redis:7-alpine

# Terminal 3: Backend
cd backend
npm run dev

# Terminal 4: ML Service
cd ml-service
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001

# Terminal 5: Frontend
cd frontend
npm run dev
```

## First Time Usage

### 1. Wait for Data Collection

The backend automatically fetches market data every:
- 1 minute (1m timeframe)
- 5 minutes (5m timeframe)
- 15 minutes (15m timeframe)
- 1 hour (1h timeframe)
- 4 hours (4h timeframe)
- 24 hours (1d timeframe)

### 2. Generate Your First Signal

1. Open http://localhost:3000
2. Wait for the chart to load with data
3. Click "Generate Signal" button
4. Review the trading suggestion with:
   - Entry price and zone
   - Stop-loss level
   - Take-profit targets
   - Confidence score
   - Detailed reasoning

### 3. Understanding the Dashboard

**Price Chart**
- Real-time candlestick chart
- EMA overlays (9, 21, 50)
- Volume histogram

**Technical Indicators**
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- ATR (Average True Range)
- Bollinger Bands
- VWAP (Volume Weighted Average Price)

**Trading Signal**
- BUY / SELL / HOLD recommendation
- Confidence percentage
- Entry zone
- Stop-loss and take-profit levels
- Risk/reward ratio
- AI reasoning explanation

## Training the ML Model

The ML service starts with a fallback model. To train a custom model:

```bash
curl -X POST "http://localhost:8001/train" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "lookback_periods": 500
  }'
```

This will:
1. Fetch 500 historical candles from the database
2. Calculate all technical indicators
3. Engineer ML features
4. Train an XGBoost classifier
5. Save the model for future predictions

## Troubleshooting

### No Data Showing

```bash
# Manually fetch data
curl -X POST "http://localhost:3001/api/market/fetch?timeframe=1h&limit=500"
```

### ML Service Not Working

The system will work without ML predictions, using only technical analysis. Check ML service logs:

```bash
docker-compose logs ml-service
```

### WebSocket Connection Failed

Ensure the backend is running and accessible. Check browser console for errors.

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check connection
docker exec -it eth-trading-postgres psql -U eth_user -d eth_trading -c "SELECT COUNT(*) FROM ohlcv_data;"
```

## API Testing with cURL

### Get Current Price

```bash
curl "http://localhost:3001/api/market/price"
```

### Get Historical Data

```bash
curl "http://localhost:3001/api/market/ohlcv?timeframe=1h&limit=100"
```

### Get Indicators

```bash
curl "http://localhost:3001/api/analysis/indicators?timeframe=1h"
```

### Get Latest Signal

```bash
curl "http://localhost:3001/api/signals/latest?timeframe=1h"
```

### Generate New Signal

```bash
curl -X POST "http://localhost:3001/api/signals/generate" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"ETHUSDT","timeframe":"1h"}'
```

## Next Steps

1. **Customize Timeframes**: Try different timeframes (1m, 5m, 15m, 1h, 4h, 1d)
2. **Train ML Model**: Use your accumulated historical data to train better models
3. **Monitor Signals**: Track signal performance over time
4. **Adjust Risk Management**: Modify ATR multipliers in `backend/src/services/signal.service.js`
5. **Add More Indicators**: Extend the analysis service with additional technical indicators

## Important Notes

- This is a **suggestion platform**, not an auto-trader
- Always do your own research before trading
- Test thoroughly with paper trading before using real funds
- Keep your API keys secure
- Regularly backup your database

## Support

For issues and questions:
- Check the logs: `docker-compose logs -f`
- Review API documentation in `API.md`
- Inspect browser console for frontend errors

Happy Trading! 🚀
