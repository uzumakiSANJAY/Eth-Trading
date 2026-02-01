import os
import pandas as pd
from sqlalchemy import create_engine, text
import logging

logger = logging.getLogger(__name__)


async def get_training_data(symbol='ETHUSDT', timeframe='1h', limit=500):
    """
    Fetch training data from PostgreSQL database
    """
    try:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            logger.warning("DATABASE_URL not set, using mock data")
            return create_mock_data(limit)

        engine = create_engine(database_url)

        query = text("""
            SELECT
                o.timestamp,
                o.open,
                o.high,
                o.low,
                o.close,
                o.volume,
                i.rsi,
                i.macd,
                i."macdSignal" as macd_signal,
                i."macdHistogram" as macd_histogram,
                i.ema9,
                i.ema21,
                i.ema50,
                i.ema200,
                i.vwap,
                i.atr,
                i."bollingerUpper" as bollinger_upper,
                i."bollingerMiddle" as bollinger_middle,
                i."bollingerLower" as bollinger_lower
            FROM ohlcv_data o
            LEFT JOIN indicators i ON o.symbol = i.symbol
                AND o.timeframe = i.timeframe
                AND o.timestamp = i.timestamp
            WHERE o.symbol = :symbol
                AND o.timeframe = :timeframe
                AND i.rsi IS NOT NULL
            ORDER BY o.timestamp DESC
            LIMIT :limit
        """)

        with engine.connect() as conn:
            df = pd.read_sql(query, conn, params={
                'symbol': symbol,
                'timeframe': timeframe,
                'limit': limit
            })

        if df.empty:
            logger.warning("No data found in database, using mock data")
            return create_mock_data(limit)

        df = df.sort_values('timestamp').reset_index(drop=True)

        df = df.fillna(method='ffill').fillna(method='bfill')

        logger.info(f"Fetched {len(df)} rows from database")
        return df

    except Exception as e:
        logger.error(f"Database fetch error: {str(e)}")
        return create_mock_data(limit)


def create_mock_data(limit=500):
    """
    Create mock training data for testing
    """
    import numpy as np

    logger.warning(f"Creating {limit} rows of mock data")

    timestamps = range(limit)
    base_price = 2000

    mock_data = {
        'timestamp': timestamps,
        'open': [base_price + np.random.randn() * 50 for _ in range(limit)],
        'high': [base_price + abs(np.random.randn()) * 60 for _ in range(limit)],
        'low': [base_price - abs(np.random.randn()) * 60 for _ in range(limit)],
        'close': [base_price + np.random.randn() * 50 for _ in range(limit)],
        'volume': [1000 + abs(np.random.randn()) * 500 for _ in range(limit)],
        'rsi': [50 + np.random.randn() * 20 for _ in range(limit)],
        'macd': [np.random.randn() * 5 for _ in range(limit)],
        'macd_signal': [np.random.randn() * 5 for _ in range(limit)],
        'macd_histogram': [np.random.randn() * 3 for _ in range(limit)],
        'ema9': [base_price + np.random.randn() * 30 for _ in range(limit)],
        'ema21': [base_price + np.random.randn() * 40 for _ in range(limit)],
        'ema50': [base_price + np.random.randn() * 50 for _ in range(limit)],
        'ema200': [base_price + np.random.randn() * 70 for _ in range(limit)],
        'vwap': [base_price + np.random.randn() * 30 for _ in range(limit)],
        'atr': [30 + abs(np.random.randn()) * 10 for _ in range(limit)],
        'bollinger_upper': [base_price + 50 + abs(np.random.randn()) * 20 for _ in range(limit)],
        'bollinger_middle': [base_price + np.random.randn() * 30 for _ in range(limit)],
        'bollinger_lower': [base_price - 50 - abs(np.random.randn()) * 20 for _ in range(limit)],
    }

    return pd.DataFrame(mock_data)
