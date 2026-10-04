"""Local inference API. It refuses predictions when a trained artifact is missing."""

from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict

ROOT = Path(__file__).resolve().parent
app = FastAPI(title="ClinQ research model inference", docs_url=None, redoc_url=None)
models: dict[str, dict[str, object]] = {}
synthetic_models: dict[str, dict[str, object]] = {}


class PredictionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    inputs: dict[str, int | float | str]


@app.on_event("startup")
def load_models() -> None:
    for disease in ("heart", "diabetes"):
        path = ROOT / "artifacts" / f"{disease}.joblib"
        if path.is_file():
            models[disease] = joblib.load(path)
    for disease in ("heart", "lung", "diabetes"):
        path = ROOT / "artifacts" / f"{disease}_synthetic.joblib"
        if path.is_file():
            synthetic_models[disease] = joblib.load(path)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "availableModels": sorted(models),
        "availableSyntheticModels": sorted(synthetic_models),
        "disabledModels": ["lung"],
    }


@app.post("/predict/{disease}")
def predict(disease: str, body: PredictionInput) -> dict[str, object]:
    if disease == "lung":
        raise HTTPException(status_code=503, detail="Lung prediction is disabled until a suitable case-control dataset is selected.")
    if disease not in models:
        raise HTTPException(status_code=503, detail=f"The {disease} model has not been trained and evaluated yet.")
    artifact = models[disease]
    features = artifact["features"]
    if not isinstance(features, list) or set(body.inputs) != set(features):
        raise HTTPException(status_code=400, detail="The input fields do not match the trained model.")
    model = artifact["model"]
    frame = pd.DataFrame([{key: body.inputs[key] for key in features}], columns=features)
    probability = float(model.predict_proba(frame)[0][1])
    if not 0 <= probability <= 1:
        raise HTTPException(status_code=500, detail="The model returned an invalid estimate.")
    return {
        "disease": disease,
        "estimate": probability,
        "modelVersion": artifact["version"],
        "label": "Research dataset model estimate; not a clinical diagnosis or calibrated individual medical risk.",
    }


@app.post("/predict-synthetic/{disease}")
def predict_synthetic(disease: str, body: PredictionInput) -> dict[str, object]:
    if disease not in synthetic_models:
        raise HTTPException(
            status_code=503,
            detail=f"The {disease} synthetic-data model has not been trained and loaded.",
        )
    artifact = synthetic_models[disease]
    feature_order = artifact["features"]
    if not isinstance(feature_order, list) or set(body.inputs) != set(feature_order):
        raise HTTPException(
            status_code=400,
            detail="The submitted inputs do not match the synthetic model's trained feature set.",
        )
    frame = pd.DataFrame([{feature: body.inputs[feature] for feature in feature_order}], columns=feature_order)
    model = artifact["model"]
    calibrator = artifact["calibrator"]
    raw_score = float(model.decision_function(frame)[0])
    probability = float(calibrator.predict_proba([[raw_score]])[0][1])
    if not 0 <= probability <= 1:
        raise HTTPException(status_code=500, detail="The model returned an invalid synthetic-label score.")
    return {
        "disease": disease,
        "estimate": probability,
        "modelVersion": artifact["version"],
        "label": "Experimental synthetic-data label likelihood only; not an individual's real-world disease risk.",
    }
