import os
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from xgboost import XGBClassifier
import logging

from services.feature_engineering import FeatureEngineer
from utils.database import get_training_data

logger = logging.getLogger(__name__)


class ModelTrainer:
    """
    Train ML models for price direction prediction
    """

    def __init__(self):
        self.feature_engineer = FeatureEngineer()
        self.model_path = os.getenv('MODEL_PATH', './models')
        os.makedirs(self.model_path, exist_ok=True)

    async def train_model(self, symbol='ETHUSDT', timeframe='1h', lookback_periods=500):
        """
        Train a new model on historical data
        """
        try:
            logger.info(f"Starting model training for {symbol} {timeframe}")

            df = await get_training_data(symbol, timeframe, lookback_periods)

            if df is None or len(df) < 100:
                raise ValueError("Insufficient training data")

            logger.info(f"Retrieved {len(df)} rows of training data")

            features = self.feature_engineer.extract_features_from_dataframe(df)
            labels = self.feature_engineer.create_labels(df, look_ahead=5, threshold=0.005)

            min_len = min(len(features), len(labels))
            features = features[:min_len]
            labels = labels[:min_len]

            if len(features) < 100:
                raise ValueError("Not enough valid feature samples")

            X_train, X_test, y_train, y_test = train_test_split(
                features, labels, test_size=0.2, random_state=42, stratify=labels
            )

            logger.info(f"Training set size: {len(X_train)}, Test set size: {len(X_test)}")

            model = XGBClassifier(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                objective='multi:softprob',
                num_class=3,
                random_state=42,
                eval_metric='mlogloss'
            )

            model.fit(X_train, y_train)

            y_pred = model.predict(X_test)
            accuracy = accuracy_score(y_test, y_pred)

            logger.info(f"Model accuracy: {accuracy:.4f}")
            logger.info(f"\n{classification_report(y_test, y_pred, target_names=['Down', 'Neutral', 'Up'])}")

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            model_filename = f"xgb_model_{symbol}_{timeframe}_{timestamp}.joblib"
            model_filepath = os.path.join(self.model_path, model_filename)

            joblib.dump({
                'model': model,
                'feature_names': self.feature_engineer.feature_names,
                'symbol': symbol,
                'timeframe': timeframe,
                'accuracy': accuracy,
                'trained_at': datetime.now().isoformat()
            }, model_filepath)

            latest_model_path = os.path.join(self.model_path, f"latest_model_{symbol}_{timeframe}.joblib")
            joblib.dump({
                'model': model,
                'feature_names': self.feature_engineer.feature_names,
                'symbol': symbol,
                'timeframe': timeframe,
                'accuracy': accuracy,
                'trained_at': datetime.now().isoformat()
            }, latest_model_path)

            logger.info(f"Model saved to {model_filepath}")

            return {
                'success': True,
                'model_path': model_filepath,
                'metrics': {
                    'accuracy': float(accuracy),
                    'training_samples': len(X_train),
                    'test_samples': len(X_test)
                }
            }

        except Exception as e:
            logger.error(f"Model training failed: {str(e)}")
            raise
