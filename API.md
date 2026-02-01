# API Documentation

Complete REST API and WebSocket documentation for the ETH Trading Platform.

## Base URLs

- Backend API: `http://localhost:3001`
- ML Service: `http://localhost:8001`
- WebSocket: `ws://localhost:3001`

## Authentication

Currently, the API does not require authentication. For production use, implement JWT or API key authentication.

---

## Market Data API

### Get Current Price

```http
GET /api/market/price
```

**Query Parameters:**
- `symbol` (string, optional): Trading pair (default: "ETH/USDT")

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "ETH/USDT",
    "price": 2345.67,
    "timestamp": 1704672000000
  }
}
```

---

### Get OHLCV Data

```http
GET /api/market/ohlcv
```

**Query Parameters:**
- `symbol` (string, optional): Symbol (default: "ETHUSDT")
- `timeframe` (string, optional): Timeframe (default: "1h")
  - Options: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`
- `limit` (number, optional): Number of candles (default: 100, max: 500)

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "count": 100,
    "candles": [
      {
        "id": "uuid",
        "symbol": "ETHUSDT",
        "timeframe": "1h",
        "timestamp": 1704672000000,
        "open": "2340.50",
        "high": "2360.00",
        "low": "2335.00",
        "close": "2345.67",
        "volume": "1234.5678",
        "createdAt": "2024-01-08T00:00:00.000Z"
      }
    ]
  }
}
```

---

### Get Volume Analysis

```http
GET /api/market/volume
```

**Query Parameters:**
- `symbol` (string, optional): Symbol (default: "ETHUSDT")
- `timeframe` (string, optional): Timeframe (default: "1h")
- `candles` (number, optional): Number of candles to analyze (default: 24)

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "avgVolume": 1250.45,
    "currentVolume": 1890.23,
    "volumeRatio": 1.51,
    "analysis": "High volume spike detected"
  }
}
```

---

### Fetch Fresh Data

```http
POST /api/market/fetch
```

**Query Parameters:**
- `symbol` (string, optional): Trading pair (default: "ETH/USDT")
- `timeframe` (string, optional): Timeframe (default: "1h")
- `limit` (number, optional): Number of candles to fetch (default: 500)

**Response:**
```json
{
  "success": true,
  "message": "Data fetched and stored successfully",
  "data": {
    "symbol": "ETH/USDT",
    "timeframe": "1h",
    "limit": 500
  }
}
```

---

## Analysis API

### Get Indicators

```http
GET /api/analysis/indicators
```

**Query Parameters:**
- `symbol` (string, optional): Symbol (default: "ETHUSDT")
- `timeframe` (string, optional): Timeframe (default: "1h")

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "indicators": {
      "id": "uuid",
      "symbol": "ETHUSDT",
      "timeframe": "1h",
      "timestamp": 1704672000000,
      "rsi": "58.34",
      "macd": "12.45",
      "macdSignal": "10.23",
      "macdHistogram": "2.22",
      "ema9": "2340.12",
      "ema21": "2335.67",
      "ema50": "2320.45",
      "ema200": "2280.90",
      "vwap": "2342.78",
      "atr": "45.67",
      "bollingerUpper": "2390.45",
      "bollingerMiddle": "2345.67",
      "bollingerLower": "2300.89",
      "createdAt": "2024-01-08T00:00:00.000Z"
    },
    "analysis": {
      "signal": "bullish",
      "strength": 72.5,
      "details": {
        "rsi": {
          "value": 58.34,
          "signal": "Neutral"
        },
        "macd": "Bullish crossover",
        "ema": "Bullish EMA alignment",
        "bollinger": "Price within bands"
      }
    }
  }
}
```

---

### Calculate Indicators

```http
POST /api/analysis/calculate
```

**Query Parameters:**
- `symbol` (string, optional): Symbol (default: "ETHUSDT")
- `timeframe` (string, optional): Timeframe (default: "1h")

**Response:**
```json
{
  "success": true,
  "message": "Indicators calculated successfully",
  "data": {
    "id": "uuid",
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "timestamp": 1704672000000,
    "rsi": "58.34",
    "macd": "12.45",
    ...
  }
}
```

---

## Patterns API

### Detect Patterns

```http
POST /api/patterns/detect
```

**Query Parameters:**
- `symbol` (string, optional): Symbol (default: "ETHUSDT")
- `timeframe` (string, optional): Timeframe (default: "1h")

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "patterns": [
      {
        "patternType": "hammer",
        "signal": "bullish",
        "strength": 75,
        "description": "Hammer pattern - Potential bullish reversal"
      }
    ]
  }
}
```

---

### Get Recent Patterns

```http
GET /api/patterns/recent
```

**Query Parameters:**
- `symbol` (string, optional): Symbol (default: "ETHUSDT")
- `timeframe` (string, optional): Timeframe (default: "1h")
- `limit` (number, optional): Number of patterns (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "count": 3,
    "patterns": [
      {
        "id": "uuid",
        "symbol": "ETHUSDT",
        "timeframe": "1h",
        "timestamp": 1704672000000,
        "patternType": "bullish_engulfing",
        "signal": "bullish",
        "strength": 75,
        "description": "Bullish engulfing pattern detected",
        "createdAt": "2024-01-08T00:00:00.000Z"
      }
    ]
  }
}
```

**Pattern Types:**
- `doji`: Market indecision
- `hammer`: Bullish reversal
- `inverted_hammer`: Bullish reversal
- `shooting_star`: Bearish reversal
- `bullish_engulfing`: Strong bullish signal
- `bearish_engulfing`: Strong bearish signal
- `morning_star`: Strong bullish reversal
- `evening_star`: Strong bearish reversal
- `three_white_soldiers`: Strong bullish continuation
- `three_black_crows`: Strong bearish continuation

---

## Signals API

### Generate Signal

```http
POST /api/signals/generate
```

**Request Body:**
```json
{
  "symbol": "ETHUSDT",
  "timeframe": "1h"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "signalType": "BUY",
    "status": "active",
    "confidence": 75.50,
    "entryPrice": "2345.67",
    "entryZoneMin": "2334.00",
    "entryZoneMax": "2357.00",
    "stopLoss": "2277.00",
    "takeProfit1": "2483.00",
    "takeProfit2": "2551.67",
    "takeProfit3": "2620.34",
    "riskRewardRatio": 2.00,
    "reasoning": {
      "indicators": {
        "rsi": {
          "value": 58.34,
          "signal": "Neutral"
        },
        "macd": "Bullish crossover",
        "ema": "Bullish EMA alignment",
        "bollinger": "Price within bands"
      },
      "patterns": [
        {
          "type": "hammer",
          "signal": "bullish",
          "strength": 75
        }
      ],
      "mlPrediction": {
        "probability": 0.72,
        "direction": "up"
      },
      "volumeAnalysis": "High volume"
    },
    "timestamp": 1704672000000,
    "createdAt": "2024-01-08T00:00:00.000Z",
    "closedAt": null,
    "exitPrice": null,
    "profitLossPercent": null
  }
}
```

---

### Get Latest Signal

```http
GET /api/signals/latest
```

**Query Parameters:**
- `symbol` (string, optional): Symbol (default: "ETHUSDT")
- `timeframe` (string, optional): Timeframe (default: "1h")

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "signalType": "BUY",
    ...
  }
}
```

---

### Get Signal History

```http
GET /api/signals/history
```

**Query Parameters:**
- `symbol` (string, optional): Symbol (default: "ETHUSDT")
- `timeframe` (string, optional): Timeframe (default: "1h")
- `limit` (number, optional): Number of signals (default: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "count": 10,
    "signals": [
      {
        "id": "uuid",
        "signalType": "BUY",
        "confidence": 75.50,
        ...
      }
    ]
  }
}
```

---

## ML Service API

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-08T00:00:00.000Z",
  "model_loaded": true
}
```

---

### Predict Price Direction

```http
POST /predict
```

**Request Body:**
```json
{
  "symbol": "ETHUSDT",
  "timeframe": "1h",
  "indicators": {
    "rsi": 58.34,
    "macd": 12.45,
    "macdSignal": 10.23,
    "ema9": 2340.12,
    "ema21": 2335.67,
    "ema50": 2320.45,
    "atr": 45.67,
    "vwap": 2342.78
  }
}
```

**Response:**
```json
{
  "direction": "up",
  "probability": 0.7234,
  "confidence": "high",
  "features_used": {
    "rsi": 58.34,
    "rsi_normalized": 0.1668,
    "macd": 12.45,
    ...
  },
  "timestamp": 1704672000000
}
```

---

### Train Model

```http
POST /train
```

**Request Body:**
```json
{
  "symbol": "ETHUSDT",
  "timeframe": "1h",
  "lookback_periods": 500
}
```

**Response:**
```json
{
  "success": true,
  "message": "Model trained successfully",
  "metrics": {
    "accuracy": 0.6234,
    "training_samples": 400,
    "test_samples": 100
  },
  "model_path": "./models/xgb_model_ETHUSDT_1h_20240108_120000.joblib"
}
```

---

### Get Model Info

```http
GET /model/info
```

**Response:**
```json
{
  "success": true,
  "data": {
    "loaded": true,
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "accuracy": 0.6234,
    "trained_at": "2024-01-08T00:00:00.000Z",
    "feature_count": 16
  }
}
```

---

## WebSocket API

### Connection

```javascript
const socket = io('ws://localhost:3001');
```

### Events

#### Client → Server

**Subscribe to Market Data**
```javascript
socket.emit('subscribe', {
  symbol: 'ETH/USDT',
  timeframe: '1h'
});
```

**Unsubscribe**
```javascript
socket.emit('unsubscribe', {
  symbol: 'ETH/USDT',
  timeframe: '1h'
});
```

#### Server → Client

**Connection Established**
```javascript
socket.on('connected', (data) => {
  console.log(data.message);
  // { message: 'Connected to ETH Trading Platform', timestamp: 1704672000000 }
});
```

**Price Update**
```javascript
socket.on('price_update', (data) => {
  console.log(data);
  // { symbol: 'ETHUSDT', price: 2345.67, timestamp: 1704672000000 }
});
```

**New Signal**
```javascript
socket.on('new_signal', (signal) => {
  console.log(signal);
  // Full signal object
});
```

**Indicator Update**
```javascript
socket.on('indicator_update', (data) => {
  console.log(data);
  // { symbol: 'ETHUSDT', timeframe: '1h', indicators: {...}, timestamp: 1704672000000 }
});
```

---

## Error Responses

All API endpoints return errors in the following format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "stack": "Error stack trace (development only)"
  }
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error

---

## Rate Limiting

Currently, there is no rate limiting implemented. For production use, consider implementing rate limiting using `express-rate-limit`.

---

## CORS

CORS is enabled for `http://localhost:3000` by default. Update `backend/src/server.js` to add additional origins.

---

## Best Practices

1. **Cache Results**: Use Redis caching for frequently accessed data
2. **Batch Requests**: Minimize API calls by batching related requests
3. **WebSocket for Real-time**: Use WebSocket for live price updates instead of polling
4. **Error Handling**: Always handle errors gracefully in your client application
5. **Retry Logic**: Implement exponential backoff for failed requests
6. **Timeouts**: Set appropriate timeouts for all API calls

---

## Example Client Usage

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001',
  timeout: 10000
});

async function getTradingSignal() {
  try {
    const response = await api.post('/api/signals/generate', {
      symbol: 'ETHUSDT',
      timeframe: '1h'
    });

    console.log('Signal:', response.data.data);

    return response.data.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

getTradingSignal();
```
