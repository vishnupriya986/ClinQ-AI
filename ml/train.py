"""Train and evaluate research models from the linked UCI source datasets."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.metrics import make_scorer
from sklearn.model_selection import GridSearchCV, StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator

ROOT = Path(__file__).resolve().parent
HEART_FEATURES = [
    "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg",
    "thalach", "exang", "oldpeak", "slope", "ca", "thal",
]
HEART_CATEGORICAL = ["sex", "cp", "fbs", "restecg", "exang", "slope", "ca", "thal"]
HEART_COLUMNS = HEART_FEATURES + ["target"]
DIABETES_FEATURES = [
    "Age", "Gender", "Polyuria", "Polydipsia", "sudden weight loss",
    "weakness", "Polyphagia", "Genital thrush", "visual blurring", "Itching",
    "Irritability", "delayed healing", "partial paresis", "muscle stiffness",
    "Alopecia", "Obesity",
]
DIABETES_CATEGORICAL = DIABETES_FEATURES[1:]
MODEL_VERSION = {"heart": "heart_uci_cleveland_v1", "diabetes": "diabetes_uci_early_symptoms_v1"}


def load_dataset(disease: str) -> tuple[pd.DataFrame, pd.Series, list[str], list[str], np.ndarray]:
    if disease == "heart":
        path = ROOT / "datasets" / "heart" / "processed.cleveland.data"
        if not path.is_file():
            raise FileNotFoundError(f"Download and extract the UCI Cleveland file to {path}")
        data = pd.read_csv(path, header=None, names=HEART_COLUMNS, na_values="?")
        data = data.dropna()
        for column in HEART_COLUMNS:
            data[column] = pd.to_numeric(data[column], errors="coerce")
        data = data.dropna()
        data["target"] = (data["target"] > 0).astype(int)
        features = data[HEART_FEATURES]
        return features, data["target"], HEART_FEATURES, HEART_CATEGORICAL, group_ids(features)

    path = ROOT / "datasets" / "diabetes" / "diabetes_data_upload.csv"
    if not path.is_file():
        raise FileNotFoundError(f"Download the UCI early diabetes CSV to {path}")
    data = pd.read_csv(path)
    if list(data.columns) != DIABETES_FEATURES + ["class"]:
        raise ValueError("The downloaded UCI diabetes dataset columns do not match the expected schema.")
    data["Age"] = pd.to_numeric(data["Age"], errors="coerce")
    data = data.dropna()
    data["class"] = data["class"].map({"Positive": 1, "Negative": 0})
    data = data.dropna(subset=["class"])
    for column in DIABETES_CATEGORICAL:
        data[column] = data[column].astype(str).str.strip().str.title()
    features = data[DIABETES_FEATURES]
    return features, data["class"].astype(int), DIABETES_FEATURES, DIABETES_CATEGORICAL, group_ids(features)


def group_ids(features: pd.DataFrame) -> np.ndarray:
    """Keep repeated survey profiles together so identical rows cannot leak across splits."""
    return pd.util.hash_pandas_object(features.astype(str), index=False).to_numpy()


def specificity_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    matrix = confusion_matrix(y_true, y_pred, labels=[0, 1])
    true_negative, false_positive = matrix[0]
    return float(true_negative / (true_negative + false_positive)) if true_negative + false_positive else 0.0


def choose_sensitive_candidate(results: dict[str, object]) -> int:
    auc = np.asarray(results["mean_test_roc_auc"])
    recall = np.asarray(results["mean_test_recall"])
    specificity = np.asarray(results["mean_test_specificity"])
    best_auc = np.nanmax(auc)
    candidates = np.flatnonzero((auc >= best_auc - 0.02) & (specificity >= 0.50))
    if len(candidates) == 0:
        candidates = np.flatnonzero(auc >= best_auc - 0.02)
    return int(candidates[np.argmax(recall[candidates])])


def build_pipeline(numeric_features: list[str], categorical_features: list[str]) -> Pipeline:
    preprocess = ColumnTransformer(
        [
            ("numeric", Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), numeric_features),
            ("categorical", Pipeline([
                ("impute", SimpleImputer(strategy="most_frequent")),
                ("encode", OneHotEncoder(handle_unknown="ignore")),
            ]), categorical_features),
        ],
        remainder="drop",
    )
    return Pipeline([("preprocess", preprocess), ("classifier", LogisticRegression(max_iter=3000, class_weight="balanced"))])


def train(disease: str) -> dict[str, object]:
    features, target, feature_names, categorical, groups = load_dataset(disease)
    numeric = [name for name in feature_names if name not in categorical]
    outer_split = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=42)
    train_indices, test_indices = next(outer_split.split(features, target, groups))
    x_train, x_test = features.iloc[train_indices], features.iloc[test_indices]
    y_train, y_test = target.iloc[train_indices], target.iloc[test_indices]
    groups_train = groups[train_indices]
    calibration_split = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=43)
    model_indices, calibration_indices = next(calibration_split.split(x_train, y_train, groups_train))
    x_model, x_calibration = x_train.iloc[model_indices], x_train.iloc[calibration_indices]
    y_model, y_calibration = y_train.iloc[model_indices], y_train.iloc[calibration_indices]
    groups_model = groups_train[model_indices]

    pipeline = build_pipeline(numeric, categorical)
    model_grid = [
        {
            "classifier": [LogisticRegression(max_iter=3000, class_weight="balanced")],
            "classifier__C": [0.1, 1, 10],
        },
        {
            "classifier": [RandomForestClassifier(class_weight="balanced", random_state=42)],
            "classifier__n_estimators": [200, 500],
            "classifier__max_depth": [None, 4, 8],
            "classifier__min_samples_leaf": [2, 5],
        },
    ]
    cv = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=44)
    search = GridSearchCV(
        pipeline,
        model_grid,
        scoring={
            "roc_auc": "roc_auc",
            "recall": "recall",
            "specificity": make_scorer(specificity_score),
        },
        refit=choose_sensitive_candidate,
        cv=cv,
        n_jobs=1,
        error_score="raise",
    )
    search.fit(x_model, y_model, groups=groups_model)
    calibrated = CalibratedClassifierCV(FrozenEstimator(search.best_estimator_), method="sigmoid")
    calibrated.fit(x_calibration, y_calibration)
    probabilities = calibrated.predict_proba(x_test)[:, 1]
    predicted = (probabilities >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, predicted, labels=[0, 1]).ravel()

    artifact = {
        "model": calibrated,
        "features": feature_names,
        "disease": disease,
        "version": MODEL_VERSION[disease],
        "positive_class": 1,
        "sklearn_version": sklearn.__version__,
        "trained_at": datetime.now(UTC).isoformat(),
    }
    output_dir = ROOT / "artifacts"
    output_dir.mkdir(exist_ok=True)
    joblib.dump(artifact, output_dir / f"{disease}.joblib")
    report: dict[str, object] = {
        "disease": disease,
        "dataset_rows_after_cleaning": int(len(features)),
        "model_fit_rows": int(len(x_model)),
        "calibration_rows": int(len(x_calibration)),
        "test_rows": int(len(x_test)),
        "grouped_split": "Repeated identical feature profiles were kept within one outer-fold group.",
        "algorithm": type(search.best_estimator_.named_steps["classifier"]).__name__,
        "best_parameters": {
            name: type(value).__name__ if name == "classifier" else value
            for name, value in search.best_params_.items()
        },
        "cross_validation_roc_auc": float(search.cv_results_["mean_test_roc_auc"][search.best_index_]),
        "cross_validation_recall_sensitivity": float(search.cv_results_["mean_test_recall"][search.best_index_]),
        "cross_validation_specificity": float(search.cv_results_["mean_test_specificity"][search.best_index_]),
        "selection_method": "Choose highest cross-validated recall among models within 0.02 ROC-AUC of best and at least 0.50 specificity; otherwise choose among the ROC-AUC near-best models.",
        "threshold_for_reported_sensitivity_specificity_only": 0.5,
        "test_metrics": {
            "accuracy": float(accuracy_score(y_test, predicted)),
            "precision": float(precision_score(y_test, predicted, zero_division=0)),
            "recall_sensitivity": float(recall_score(y_test, predicted, zero_division=0)),
            "specificity": float(tn / (tn + fp)) if tn + fp else 0.0,
            "f1": float(f1_score(y_test, predicted, zero_division=0)),
            "roc_auc": float(roc_auc_score(y_test, probabilities)),
            "confusion_matrix_tn_fp_fn_tp": [[int(tn), int(fp)], [int(fn), int(tp)]],
            "brier_score": float(np.mean((probabilities - y_test.to_numpy()) ** 2)),
        },
        "validation_notice": "Grouped stratified holdout, grouped cross-validation, separate grouped sigmoid calibration split; not externally or clinically validated.",
    }
    report_path = output_dir / f"{disease}_evaluation.json"
    report_path.write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("disease", choices=["heart", "diabetes", "all"])
    args = parser.parse_args()
    selected = ["heart", "diabetes"] if args.disease == "all" else [args.disease]
    for model_name in selected:
        print(json.dumps(train(model_name), indent=2))
