from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn
import logging
from datetime import datetime

from services.feature_engineering import FeatureEngineer
from services.model_trainer import ModelTrainer
from services.predictor import Predictor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ETH Trading ML Service",
    description="Machine Learning service for Ethereum trading predictions",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

feature_engineer = FeatureEngineer()
model_trainer = ModelTrainer()
predictor = Predictor()


class PredictionRequest(BaseModel):
    symbol: str
    timeframe: str
    indicators: Dict[str, float]


class TrainRequest(BaseModel):
    symbol: str = "ETHUSDT"
    timeframe: str = "1h"
    lookback_periods: int = 500


class PredictionResponse(BaseModel):
    direction: str
    probability: float
    confidence: str
    features_used: Dict[str, Any]
    timestamp: int


@app.get("/")
async def root():
    return {
        "service": "ETH Trading ML Service",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "model_loaded": predictor.is_model_loaded()
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict_price_direction(request: PredictionRequest):
    """
    Predict price direction based on technical indicators
    """
    try:
        logger.info(f"Prediction request for {request.symbol} {request.timeframe}")

        features = feature_engineer.prepare_features_for_prediction(request.indicators)

        prediction = predictor.predict(features)

        direction = "up" if prediction["direction"] == 1 else "down" if prediction["direction"] == -1 else "neutral"

        confidence_level = "high" if prediction["probability"] > 0.75 else "medium" if prediction["probability"] > 0.6 else "low"

        return PredictionResponse(
            direction=direction,
            probability=round(prediction["probability"], 4),
            confidence=confidence_level,
            features_used=features,
            timestamp=int(datetime.now().timestamp() * 1000)
        )

    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/train")
async def train_model(request: TrainRequest):
    """
    Train a new model on historical data
    """
    try:
        logger.info(f"Training model for {request.symbol} {request.timeframe}")

        result = await model_trainer.train_model(
            symbol=request.symbol,
            timeframe=request.timeframe,
            lookback_periods=request.lookback_periods
        )

        predictor.load_model()

        return {
            "success": True,
            "message": "Model trained successfully",
            "metrics": result["metrics"],
            "model_path": result["model_path"]
        }

    except Exception as e:
        logger.error(f"Training error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@app.get("/model/info")
async def get_model_info():
    """
    Get information about the current model
    """
    try:
        info = predictor.get_model_info()
        return {
            "success": True,
            "data": info
        }
    except Exception as e:
        logger.error(f"Model info error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/features/engineer")
async def engineer_features(indicators: Dict[str, float]):
    """
    Transform indicators into ML features
    """
    try:
        features = feature_engineer.prepare_features_for_prediction(indicators)
        return {
            "success": True,
            "features": features
        }
    except Exception as e:
        logger.error(f"Feature engineering error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True
    )
