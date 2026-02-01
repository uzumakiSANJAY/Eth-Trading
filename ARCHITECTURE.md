# System Architecture

## Overview

The ETH Trading Platform is a microservices-based application designed for real-time Ethereum market analysis and AI-powered trading suggestions.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           React.js + Tailwind CSS                        │  │
│  │                                                          │  │
│  │  • TradingView Lightweight Charts                       │  │
│  │  • Real-time WebSocket Connection                       │  │
│  │  • Indicators Dashboard                                 │  │
│  │  • Signal Display with Explainability                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓ HTTP/WS ↓                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       Backend API Layer                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Express.js API Server                       │  │
│  │                                                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────────┐      │  │
│  │  │  Market    │  │ Analysis   │  │  Patterns   │      │  │
│  │  │  Service   │  │  Service   │  │   Service   │      │  │
│  │  └────────────┘  └────────────┘  └─────────────┘      │  │
│  │                                                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────────┐      │  │
│  │  │  Signals   │  │ WebSocket  │  │  Scheduler  │      │  │
│  │  │  Service   │  │  Gateway   │  │   Service   │      │  │
│  │  └────────────┘  └────────────┘  └─────────────┘      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓ HTTP ↓                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      ML Service Layer                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              FastAPI ML Service (Python)                 │  │
│  │                                                          │  │
│  │  ┌───────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │   Feature     │  │    Model     │  │  Predictor  │  │  │
│  │  │  Engineering  │  │   Trainer    │  │   Service   │  │  │
│  │  └───────────────┘  └──────────────┘  └─────────────┘  │  │
│  │                                                          │  │
│  │  • XGBoost Classifier                                   │  │
│  │  • 16 Engineered Features                               │  │
│  │  • Multi-class Prediction (Up/Down/Neutral)             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                 │
│                                                                 │
│  ┌──────────────────────┐         ┌─────────────────────────┐  │
│  │   PostgreSQL 15      │         │      Redis 7            │  │
│  │                      │         │                         │  │
│  │  • ohlcv_data        │         │  • Price Cache          │  │
│  │  • indicators        │         │  • Indicators Cache     │  │
│  │  • patterns          │         │  • Session Data         │  │
│  │  • signals           │         │  • Real-time Updates    │  │
│  └──────────────────────┘         └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    External Services                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Binance Exchange API                    │  │
│  │                                                          │  │
│  │  • Real-time Price Data                                  │  │
│  │  • Historical OHLCV Data                                 │  │
│  │  • WebSocket Price Streams                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (React.js)

**Location:** `/frontend`

**Tech Stack:**
- React 18
- Vite (Build Tool)
- Tailwind CSS
- TradingView Lightweight Charts
- Socket.io Client
- Axios
- Zustand (State Management)

**Key Components:**
- `Dashboard.jsx`: Main trading dashboard
- `TradingViewChart.jsx`: Interactive candlestick chart with indicators
- `IndicatorsPanel.jsx`: Technical indicators display
- `SignalCard.jsx`: Trading signal with explainability

**Features:**
- Real-time price updates via WebSocket
- Interactive candlestick charts with EMA overlays
- Technical indicators visualization
- Trading signals with detailed reasoning
- Multi-timeframe support

---

### Backend (Express.js)

**Location:** `/backend`

**Tech Stack:**
- Node.js 18+
- Express.js
- Sequelize (PostgreSQL ORM)
- Socket.io (WebSocket)
- CCXT (Exchange Connectivity)
- technicalindicators (TA Library)
- Redis Client
- Winston (Logging)
- node-cron (Scheduling)

**Services:**

#### Market Service
- Fetches real-time price data from Binance
- Stores OHLCV data in PostgreSQL
- Provides historical data endpoints
- Volume analysis calculations

#### Analysis Service
- Calculates technical indicators:
  - RSI (Relative Strength Index)
  - MACD (Moving Average Convergence Divergence)
  - EMA (9, 21, 50, 200 periods)
  - VWAP (Volume Weighted Average Price)
  - ATR (Average True Range)
  - Bollinger Bands
- Indicator analysis and signal generation
- Caches results in Redis

#### Patterns Service
- Detects candlestick patterns:
  - Doji
  - Hammer / Inverted Hammer
  - Shooting Star
  - Bullish / Bearish Engulfing
  - Morning Star / Evening Star
  - Three White Soldiers / Three Black Crows
- Pattern strength calculation
- Historical pattern storage

#### Signals Service
- Aggregates data from multiple sources:
  - Technical indicators
  - Candlestick patterns
  - Volume analysis
  - ML predictions
- Signal decision-making algorithm
- Risk management calculations:
  - Entry zone (±0.5%)
  - Stop-loss (1.5x ATR)
  - Take-profit levels (2x, 3x, 4x ATR)
  - Risk/reward ratio

#### WebSocket Gateway
- Real-time price updates (5-second intervals)
- Signal broadcasts
- Indicator updates
- Subscription management

#### Scheduler Service
- Automated data collection:
  - 1-minute candles: Every minute
  - 5-minute candles: Every 5 minutes
  - 15-minute candles: Every 15 minutes
  - 1-hour candles: Every hour
  - 4-hour candles: Every 4 hours
  - Daily candles: Every day

---

### ML Service (FastAPI/Python)

**Location:** `/ml-service`

**Tech Stack:**
- Python 3.10+
- FastAPI
- scikit-learn
- XGBoost
- pandas
- numpy
- TA-Lib

**Services:**

#### Feature Engineering
Transforms raw indicators into 16 ML features:
1. RSI (raw value)
2. RSI Normalized
3. MACD
4. MACD Signal
5. MACD Histogram
6. EMA 9
7. EMA 21
8. EMA 50
9. EMA Short/Long Ratio
10. EMA Trend Strength
11. VWAP
12. ATR (raw value)
13. ATR Normalized
14. Price to EMA 9 Ratio
15. Price to EMA 21 Ratio
16. Price to VWAP Ratio

#### Model Trainer
- Fetches historical data from PostgreSQL
- Engineers features from OHLCV + indicators
- Creates labels based on future price movement
- Trains XGBoost multi-class classifier
- Evaluates model performance
- Saves trained models to disk

**Label Creation:**
- Look-ahead period: 5 candles
- Threshold: 0.5% price change
- Classes:
  - `1`: Price up (bullish)
  - `0`: Neutral
  - `-1`: Price down (bearish)

#### Predictor
- Loads trained models
- Makes real-time predictions
- Returns probability scores
- Confidence levels (high > 75%, medium > 60%, low < 60%)

**Model Performance:**
- Typical accuracy: 60-70%
- Better than random chance (33% for 3-class)
- Continuously improvable with more data

---

### Database (PostgreSQL)

**Tables:**

#### ohlcv_data
Stores candlestick data:
- `id` (UUID, PK)
- `symbol` (STRING)
- `timeframe` (ENUM)
- `timestamp` (BIGINT)
- `open`, `high`, `low`, `close` (DECIMAL)
- `volume` (DECIMAL)
- Unique index on (symbol, timeframe, timestamp)

#### indicators
Stores calculated technical indicators:
- `id` (UUID, PK)
- `symbol` (STRING)
- `timeframe` (ENUM)
- `timestamp` (BIGINT)
- All indicator values (RSI, MACD, EMA, etc.)
- Index on (symbol, timeframe, timestamp)

#### patterns
Stores detected candlestick patterns:
- `id` (UUID, PK)
- `symbol` (STRING)
- `timeframe` (ENUM)
- `timestamp` (BIGINT)
- `patternType` (ENUM)
- `signal` (ENUM: bullish/bearish/neutral)
- `strength` (INTEGER 1-100)
- `description` (TEXT)

#### signals
Stores generated trading signals:
- `id` (UUID, PK)
- `symbol` (STRING)
- `timeframe` (ENUM)
- `signalType` (ENUM: BUY/SELL/HOLD)
- `status` (ENUM: active/closed/expired)
- `confidence` (DECIMAL)
- Entry, stop-loss, take-profit levels
- `reasoning` (JSONB)
- Performance tracking fields

---

### Cache (Redis)

**Usage:**
- Price data cache (10-second TTL)
- OHLCV data cache (60-second TTL)
- Indicators cache (60-second TTL)
- Session management
- Real-time WebSocket data

**Benefits:**
- Reduced database load
- Faster API responses
- Improved user experience

---

## Data Flow

### 1. Data Ingestion Flow

```
Binance API → Market Service → PostgreSQL
                             ↓
                        Redis Cache
```

1. Scheduler triggers data fetch
2. CCXT library fetches OHLCV from Binance
3. Market service stores in PostgreSQL
4. Data cached in Redis
5. WebSocket broadcasts updates

### 2. Indicator Calculation Flow

```
PostgreSQL (OHLCV) → Analysis Service → Indicators
                                      ↓
                                 PostgreSQL
                                      ↓
                                 Redis Cache
```

1. Fetch recent OHLCV data
2. Calculate all technical indicators
3. Store in indicators table
4. Cache in Redis
5. Return to client

### 3. Signal Generation Flow

```
┌─────────────┐
│   OHLCV     │──────┐
└─────────────┘      │
                     ↓
┌─────────────┐  ┌────────────────┐
│ Indicators  │→ │ Signal Service │ → Signal Decision
└─────────────┘  └────────────────┘
                     ↑                      ↓
┌─────────────┐      │                PostgreSQL
│  Patterns   │──────┤                     ↓
└─────────────┘      │                WebSocket
                     │                     ↓
┌─────────────┐      │                  Client
│ ML Service  │──────┘
└─────────────┘
```

1. Fetch latest indicators
2. Detect candlestick patterns
3. Analyze volume
4. Call ML service for prediction
5. Aggregate all signals
6. Calculate confidence score
7. Determine BUY/SELL/HOLD
8. Calculate risk management levels
9. Store signal in database
10. Broadcast to connected clients

---

## Security Considerations

### Current Implementation
- CORS enabled for localhost
- Input validation with Joi
- Error handling middleware
- SQL injection prevention (Sequelize ORM)
- Rate limiting (planned)

### Production Recommendations
1. Implement JWT authentication
2. Add API key management
3. Enable HTTPS/WSS only
4. Implement rate limiting
5. Add request logging
6. Encrypt sensitive data
7. Use environment variables for secrets
8. Implement IP whitelisting
9. Add CAPTCHA for public endpoints
10. Regular security audits

---

## Scalability

### Horizontal Scaling
- Backend: Multiple instances behind load balancer
- ML Service: Separate instances for training and prediction
- PostgreSQL: Read replicas for queries
- Redis: Redis Cluster for high availability

### Vertical Scaling
- Increase database connection pool
- Optimize queries with indexes
- Implement database partitioning
- Use Redis for heavy caching

### Performance Optimization
- Database query optimization
- Redis caching strategy
- WebSocket connection pooling
- Background job queues
- CDN for static assets

---

## Monitoring & Observability

### Recommended Tools
- **Logging**: Winston → ELK Stack (Elasticsearch, Logstash, Kibana)
- **Metrics**: Prometheus + Grafana
- **APM**: New Relic or DataDog
- **Error Tracking**: Sentry
- **Uptime Monitoring**: UptimeRobot

### Key Metrics
- API response times
- WebSocket connection count
- Database query performance
- ML prediction latency
- Signal generation success rate
- Cache hit/miss ratio
- Error rates
- System resource usage

---

## Deployment

### Development
```bash
docker-compose up -d
```

### Production
1. Set up Kubernetes cluster
2. Deploy PostgreSQL with persistence
3. Deploy Redis cluster
4. Deploy backend pods (3+ replicas)
5. Deploy ML service pods (2+ replicas)
6. Deploy frontend with Nginx
7. Set up ingress controller
8. Configure monitoring and logging

### CI/CD Pipeline
1. Code pushed to Git
2. Run automated tests
3. Build Docker images
4. Push to container registry
5. Deploy to staging
6. Run integration tests
7. Deploy to production
8. Health checks and monitoring

---

## Future Enhancements

1. **Multi-Asset Support**: Add BTC, altcoins
2. **Advanced ML**: LSTM, Transformer models
3. **Backtesting**: Historical signal performance
4. **Portfolio Management**: Track multiple positions
5. **Alerts**: Email/SMS/Telegram notifications
6. **Mobile App**: React Native
7. **Social Features**: Share signals, leaderboard
8. **Premium Features**: Advanced indicators, custom strategies
9. **Exchange Integration**: Multi-exchange support
10. **Paper Trading**: Simulated trading environment

---

## Maintenance

### Regular Tasks
- Database backups (daily)
- Model retraining (weekly)
- Dependency updates (monthly)
- Security patches (as needed)
- Performance optimization (quarterly)
- Clean up old data (monthly)

### Health Checks
- Database connectivity
- Redis connectivity
- Exchange API availability
- ML model loading
- WebSocket connections
- Disk space monitoring

---

## Conclusion

This architecture provides a solid foundation for a production-ready trading analysis platform with:
- Real-time market data processing
- Advanced technical analysis
- AI-powered predictions
- Scalable microservices design
- Comprehensive monitoring
- Room for future growth
