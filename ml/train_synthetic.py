"""Train experimental classifiers from the user-provided synthetic CSV files.

Outputs estimate the synthetic file label only; they are not clinical risks.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "datasets" / "synthetic"
ARTIFACT_DIR = ROOT / "artifacts"

DISEASES: dict[str, dict[str, object]] = {
    "heart": {
        "path": "heart_disease_synthetic.csv",
        "target": "HeartDisease",
        "columns": {
            "Age": "age",
            "Gender": "gender",
            "Height_cm": "heightCm",
            "Weight_kg": "weightKg",
            "Systolic_Blood_Pressure_mmHg": "systolicBloodPressure",
            "Diastolic_Blood_Pressure_mmHg": "diastolicBloodPressure",
            "Total_Cholesterol_mg_dL": "totalCholesterol",
            "LDL_Cholesterol_mg_dL": "ldlCholesterol",
            "HDL_Cholesterol_mg_dL": "hdlCholesterol",
            "Triglycerides_mg_dL": "triglycerides",
            "Blood_Glucose_mg_dL": "bloodGlucose",
            "Diabetes": "diabetes",
            "Smoking_Habit": "smokingHabit",
            "Alcohol_Habit": "alcoholHabit",
            "Weekly_Exercise_Minutes": "weeklyExerciseMinutes",
            "Family_History_Heart_Disease": "familyHistoryOfHeartDisease",
            "Previous_Heart_Disease": "previousHeartDisease",
            "BMI": "bmi",
        },
        "categorical": [
            "gender", "diabetes", "smokingHabit", "alcoholHabit",
            "familyHistoryOfHeartDisease", "previousHeartDisease",
        ],
    },
    "lung": {
        "path": "lung_cancer_synthetic.csv",
        "target": "LungCancer",
        "columns": {
            "Age": "age",
            "Gender": "gender",
            "Smoking_Status": "smokingStatus",
            "Cigarettes_Per_Day": "cigarettesPerDay",
            "Years_Of_Smoking": "yearsOfSmoking",
            "Secondhand_Smoke_Exposure": "secondhandSmokeExposure",
            "Workplace_Exposure": "workplaceExposure",
            "Asbestos_Exposure": "asbestosExposure",
            "Radon_Exposure": "radonExposure",
            "Air_Pollution_Exposure": "airPollutionExposure",
            "Chronic_Lung_Disease": "chronicLungDisease",
            "Family_History_Lung_Cancer": "familyHistoryOfLungCancer",
            "Previous_Cancer_History": "previousCancerHistory",
            "Previous_Chest_Radiation": "previousChestRadiation",
            "Persistent_Cough": "persistentCough",
            "Shortness_Of_Breath": "shortnessOfBreath",
            "Chest_Pain": "chestPain",
            "Pack_Years": "packYears",
        },
        "categorical": [
            "gender", "smokingStatus", "secondhandSmokeExposure",
            "workplaceExposure", "asbestosExposure", "radonExposure",
            "airPollutionExposure", "chronicLungDisease",
            "familyHistoryOfLungCancer", "previousCancerHistory",
            "previousChestRadiation", "persistentCough",
            "shortnessOfBreath", "chestPain",
        ],
    },
    "diabetes": {
        "path": "diabetes_synthetic.csv",
        "target": "Diabetes",
        "columns": {
            "Age": "age",
            "Gender": "gender",
            "Height_cm": "heightCm",
            "Weight_kg": "weightKg",
            "Fasting_Blood_Glucose_mg_dL": "fastingBloodGlucose",
            "HbA1c_percent": "hba1c",
            "Systolic_Blood_Pressure_mmHg": "systolicBloodPressure",
            "Diastolic_Blood_Pressure_mmHg": "diastolicBloodPressure",
            "Family_History_Diabetes": "familyHistoryOfDiabetes",
            "Previous_Prediabetes": "previousPrediabetes",
            "Weekly_Exercise_Minutes": "weeklyExerciseMinutes",
            "Smoking_Habit": "smokingHabit",
            "Alcohol_Habit": "alcoholHabit",
            "Diet_Quality": "dietQuality",
            "Sugary_Drinks_Consumption": "sugaryDrinksConsumption",
            "Gestational_Diabetes_History": "gestationalDiabetesHistory",
            "PCOS": "pcos",
            "BMI": "bmi",
        },
        "categorical": [
            "gender", "familyHistoryOfDiabetes", "previousPrediabetes",
            "smokingHabit", "alcoholHabit", "dietQuality",
            "sugaryDrinksConsumption", "gestationalDiabetesHistory", "pcos",
        ],
    },
}

MODEL_VERSION = "synthetic_logistic_platt_v1"
RISK_BANDS = {"low_below_percent": 30, "medium_below_percent": 60, "high_from_percent": 60}


def load_dataset(disease: str) -> tuple[pd.DataFrame, pd.Series, list[str], list[str], np.ndarray, dict[str, int]]:
    spec = DISEASES[disease]
    path = DATA_DIR / str(spec["path"])
    if not path.is_file():
        raise FileNotFoundError(f"Missing supplied synthetic dataset: {path}")

    mapping = spec["columns"]
    data = pd.read_csv(path)
    expected_columns = set(mapping) | {str(spec["target"])}
    if set(data.columns) != expected_columns:
        missing = sorted(expected_columns - set(data.columns))
        extra = sorted(set(data.columns) - expected_columns)
        raise ValueError(f"{path.name} schema mismatch; missing={missing}, extra={extra}")

    data = data.rename(columns=mapping)
    target = str(spec["target"])
    labels = pd.to_numeric(data.pop(target), errors="coerce")
    if labels.isna().any() or not set(labels.unique()).issubset({0, 1}):
        raise ValueError(f"{path.name} target must contain only binary 0/1 labels.")

    features = list(mapping.values())
    categorical = list(spec["categorical"])
    numeric = [feature for feature in features if feature not in categorical]
    for feature in numeric:
        data[feature] = pd.to_numeric(data[feature], errors="coerce")
    for feature in categorical:
        data[feature] = data[feature].astype("string").str.strip().replace("", pd.NA)
        data[feature] = data[feature].astype(object).where(data[feature].notna(), np.nan)

    if disease in {"heart", "diabetes"}:
        data["bmi"] = data["weightKg"] / ((data["heightCm"] / 100) ** 2)
    elif disease == "lung":
        data["packYears"] = data["cigarettesPerDay"] * data["yearsOfSmoking"] / 20

    data = data[features]
    if data.isna().all(axis=0).any():
        raise ValueError(f"{path.name} contains a feature with no training values.")

    groups = pd.util.hash_pandas_object(data.astype("string").fillna("<MISSING>"), index=False).to_numpy()
    return data, labels.astype(int), features, categorical, groups, {
        "rows": int(len(data)),
        "positive_rows": int(labels.sum()),
        "rows_with_any_missing_input": int(data.isna().any(axis=1).sum()),
        "missing_by_feature": {key: int(value) for key, value in data.isna().sum().items() if value},
    }


def build_pipeline(features: list[str], categorical: list[str]) -> Pipeline:
    numeric = [feature for feature in features if feature not in categorical]
    preprocess = ColumnTransformer(
        [
            (
                "numeric",
                Pipeline(
                    [
                        ("impute", SimpleImputer(strategy="median", add_indicator=True)),
                        ("scale", StandardScaler()),
                    ]
                ),
                numeric,
            ),
            (
                "categorical",
                Pipeline(
                    [
                        ("impute", SimpleImputer(strategy="constant", fill_value="__MISSING__")),
                        ("encode", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical,
            ),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    return Pipeline(
        [
            ("preprocess", preprocess),
            ("classifier", LogisticRegression(max_iter=3000, solver="lbfgs")),
        ]
    )


def train(disease: str) -> dict[str, object]:
    features, target, feature_order, categorical, groups, data_summary = load_dataset(disease)
    holdout_split = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=420)
    development_indices, test_indices = next(holdout_split.split(features, target, groups))
    x_development, x_test = features.iloc[development_indices], features.iloc[test_indices]
    y_development, y_test = target.iloc[development_indices], target.iloc[test_indices]
    groups_development = groups[development_indices]

    oof_scores = np.full(len(x_development), np.nan)
    calibration_split = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=421)
    for fit_indices, calibration_indices in calibration_split.split(
        x_development, y_development, groups_development
    ):
        fold_model = build_pipeline(feature_order, categorical)
        fold_model.fit(x_development.iloc[fit_indices], y_development.iloc[fit_indices])
        oof_scores[calibration_indices] = fold_model.decision_function(
            x_development.iloc[calibration_indices]
        )
    if np.isnan(oof_scores).any():
        raise RuntimeError(f"{disease} grouped calibration did not produce every out-of-fold score.")

    calibrator = LogisticRegression(max_iter=1000)
    calibrator.fit(oof_scores.reshape(-1, 1), y_development)
    model = build_pipeline(feature_order, categorical)
    model.fit(x_development, y_development)
    raw_test_scores = model.decision_function(x_test)
    probabilities = calibrator.predict_proba(raw_test_scores.reshape(-1, 1))[:, 1]
    predicted = (probabilities >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, predicted, labels=[0, 1]).ravel()

    artifact = {
        "model": model,
        "calibrator": calibrator,
        "features": feature_order,
        "categoricalFeatures": categorical,
        "disease": disease,
        "version": f"{disease}_{MODEL_VERSION}",
        "target": DISEASES[disease]["target"],
        "source": str(DISEASES[disease]["path"]),
        "sourceIsSynthetic": True,
        "sklearnVersion": sklearn.__version__,
        "trainedAt": datetime.now(UTC).isoformat(),
        "riskBands": RISK_BANDS,
    }
    ARTIFACT_DIR.mkdir(exist_ok=True)
    joblib.dump(artifact, ARTIFACT_DIR / f"{disease}_synthetic.joblib")

    report: dict[str, object] = {
        "disease": disease,
        "target": DISEASES[disease]["target"],
        "source": str(DISEASES[disease]["path"]),
        "source_is_synthetic": True,
        "model_version": artifact["version"],
        "feature_order": feature_order,
        "categorical_features": categorical,
        "data": data_summary,
        "development_rows": int(len(x_development)),
        "held_out_rows": int(len(x_test)),
        "held_out_positive_rate": float(y_test.mean()),
        "held_out_metrics": {
            "roc_auc": float(roc_auc_score(y_test, probabilities)),
            "brier_score": float(brier_score_loss(y_test, probabilities)),
            "accuracy_at_50_percent": float(accuracy_score(y_test, predicted)),
            "precision_at_50_percent": float(precision_score(y_test, predicted, zero_division=0)),
            "sensitivity_at_50_percent": float(recall_score(y_test, predicted, zero_division=0)),
            "specificity_at_50_percent": float(tn / (tn + fp)) if tn + fp else 0.0,
            "confusion_matrix_tn_fp_fn_tp": [int(tn), int(fp), int(fn), int(tp)],
        },
        "synthetic_score_band_thresholds_percent": RISK_BANDS,
        "warning": "Held-out metrics and probabilities describe only this synthetic dataset, not real-world disease risk.",
        "sklearn_version": sklearn.__version__,
        "calibration": "Grouped out-of-fold Platt scaling on development data; grouped held-out test evaluation.",
    }
    (ARTIFACT_DIR / f"{disease}_synthetic_evaluation.json").write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )
    return report


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("disease", choices=[*DISEASES, "all"])
    args = parser.parse_args()
    diseases = list(DISEASES) if args.disease == "all" else [args.disease]
    for disease in diseases:
        report = train(disease)
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
