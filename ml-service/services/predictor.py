import os
import joblib
import numpy as np
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class Predictor:
    """
    Make predictions using trained models
    """

    def __init__(self):
        self.model_path = os.getenv('MODEL_PATH', './models')
        self.model = None
        self.model_metadata = None
        self.load_model()

    def load_model(self, symbol='ETHUSDT', timeframe='1h'):
        """
        Load the latest trained model
        """
        try:
            model_file = os.path.join(self.model_path, f"latest_model_{symbol}_{timeframe}.joblib")

            if not os.path.exists(model_file):
                logger.warning(f"No model found at {model_file}. Using fallback model.")
                self._create_fallback_model()
                return

            model_data = joblib.load(model_file)
            self.model = model_data['model']
            self.model_metadata = {
                'symbol': model_data.get('symbol'),
                'timeframe': model_data.get('timeframe'),
                'accuracy': model_data.get('accuracy'),
                'trained_at': model_data.get('trained_at'),
                'feature_names': model_data.get('feature_names', [])
            }

            logger.info(f"Model loaded successfully from {model_file}")
            logger.info(f"Model accuracy: {self.model_metadata['accuracy']:.4f}")

        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}")
            self._create_fallback_model()

    def _create_fallback_model(self):
        """
        Create a simple fallback model when no trained model exists
        """
        from sklearn.ensemble import RandomForestClassifier

        logger.warning("Creating fallback model")
        self.model = RandomForestClassifier(n_estimators=10, random_state=42)

        dummy_X = np.random.rand(100, 16)
        dummy_y = np.random.randint(0, 3, 100)
        self.model.fit(dummy_X, dummy_y)

        self.model_metadata = {
            'symbol': 'ETHUSDT',
            'timeframe': '1h',
            'accuracy': 0.5,
            'trained_at': 'fallback',
            'feature_names': []
        }

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict price direction
        """
        try:
            if self.model is None:
                raise ValueError("Model not loaded")

            feature_vector = np.array(list(features.values())).reshape(1, -1)

            prediction_class = self.model.predict(feature_vector)[0]

            if hasattr(self.model, 'predict_proba'):
                probabilities = self.model.predict_proba(feature_vector)[0]
                max_prob = float(np.max(probabilities))
            else:
                max_prob = 0.6

            direction_map = {
                -1: -1,
                0: 0,
                1: 1
            }
            direction = direction_map.get(prediction_class, 0)

            result = {
                'direction': int(direction),
                'probability': max_prob,
                'confidence_score': max_prob
            }

            logger.info(f"Prediction: {result}")
            return result

        except Exception as e:
            logger.error(f"Prediction error: {str(e)}")
            raise

    def is_model_loaded(self) -> bool:
        """
        Check if a model is loaded
        """
        return self.model is not None

    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the loaded model
        """
        if not self.model_metadata:
            return {
                'loaded': False,
                'message': 'No model loaded'
            }

        return {
            'loaded': True,
            'symbol': self.model_metadata.get('symbol'),
            'timeframe': self.model_metadata.get('timeframe'),
            'accuracy': self.model_metadata.get('accuracy'),
            'trained_at': self.model_metadata.get('trained_at'),
            'feature_count': len(self.model_metadata.get('feature_names', []))
        }
