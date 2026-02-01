import numpy as np
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class FeatureEngineer:
    """
    Feature engineering for trading ML models
    """

    def __init__(self):
        self.feature_names = [
            'rsi',
            'rsi_normalized',
            'macd',
            'macd_signal',
            'macd_histogram',
            'ema9',
            'ema21',
            'ema50',
            'ema_short_long_ratio',
            'ema_trend_strength',
            'vwap',
            'atr',
            'atr_normalized',
            'price_to_ema9',
            'price_to_ema21',
            'price_to_vwap'
        ]

    def prepare_features_for_prediction(self, indicators: Dict[str, float]) -> Dict[str, Any]:
        """
        Prepare features from indicators for prediction
        """
        try:
            rsi = indicators.get('rsi', 50.0)
            macd = indicators.get('macd', 0.0)
            macd_signal = indicators.get('macdSignal', 0.0)
            ema9 = indicators.get('ema9', 0.0)
            ema21 = indicators.get('ema21', 0.0)
            ema50 = indicators.get('ema50', 0.0)
            vwap = indicators.get('vwap', 0.0)
            atr = indicators.get('atr', 0.0)

            macd_histogram = macd - macd_signal if macd and macd_signal else 0.0

            rsi_normalized = (rsi - 50) / 50 if rsi else 0.0

            ema_short_long_ratio = (ema9 / ema50) if ema9 and ema50 and ema50 != 0 else 1.0

            if ema9 and ema21 and ema50:
                ema_trend_strength = ((ema9 - ema50) / ema50) * 100 if ema50 != 0 else 0.0
            else:
                ema_trend_strength = 0.0

            price_to_ema9 = (vwap / ema9) if vwap and ema9 and ema9 != 0 else 1.0
            price_to_ema21 = (vwap / ema21) if vwap and ema21 and ema21 != 0 else 1.0
            price_to_vwap = 1.0

            avg_price = (ema9 + ema21) / 2 if ema9 and ema21 else vwap if vwap else 1.0
            atr_normalized = (atr / avg_price) * 100 if atr and avg_price and avg_price != 0 else 0.0

            features = {
                'rsi': rsi,
                'rsi_normalized': rsi_normalized,
                'macd': macd,
                'macd_signal': macd_signal,
                'macd_histogram': macd_histogram,
                'ema9': ema9,
                'ema21': ema21,
                'ema50': ema50,
                'ema_short_long_ratio': ema_short_long_ratio,
                'ema_trend_strength': ema_trend_strength,
                'vwap': vwap,
                'atr': atr,
                'atr_normalized': atr_normalized,
                'price_to_ema9': price_to_ema9,
                'price_to_ema21': price_to_ema21,
                'price_to_vwap': price_to_vwap
            }

            logger.info(f"Engineered {len(features)} features")
            return features

        except Exception as e:
            logger.error(f"Feature engineering error: {str(e)}")
            raise

    def extract_features_from_dataframe(self, df):
        """
        Extract features from a pandas DataFrame with OHLCV and indicators
        """
        try:
            features = []

            for idx, row in df.iterrows():
                indicators = {
                    'rsi': row.get('rsi', 50.0),
                    'macd': row.get('macd', 0.0),
                    'macdSignal': row.get('macd_signal', 0.0),
                    'ema9': row.get('ema9', 0.0),
                    'ema21': row.get('ema21', 0.0),
                    'ema50': row.get('ema50', 0.0),
                    'vwap': row.get('vwap', 0.0),
                    'atr': row.get('atr', 0.0),
                }

                feature_dict = self.prepare_features_for_prediction(indicators)
                features.append(list(feature_dict.values()))

            return np.array(features)

        except Exception as e:
            logger.error(f"DataFrame feature extraction error: {str(e)}")
            raise

    def create_labels(self, df, look_ahead=5, threshold=0.01):
        """
        Create labels for training:
        1 = price goes up by threshold %
        -1 = price goes down by threshold %
        0 = neutral
        """
        try:
            labels = []

            for i in range(len(df) - look_ahead):
                current_price = df.iloc[i]['close']
                future_price = df.iloc[i + look_ahead]['close']

                price_change = (future_price - current_price) / current_price

                if price_change > threshold:
                    labels.append(1)
                elif price_change < -threshold:
                    labels.append(-1)
                else:
                    labels.append(0)

            labels.extend([0] * look_ahead)

            return np.array(labels)

        except Exception as e:
            logger.error(f"Label creation error: {str(e)}")
            raise
