import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
import joblib

# Load dataset
df = pd.read_csv("dataset.csv")

# Encode categorical features
le_soil = LabelEncoder()
le_season = LabelEncoder()
le_state = LabelEncoder()
le_crop = LabelEncoder()

df["soil_type_enc"] = le_soil.fit_transform(df["soil_type"])
df["season_enc"] = le_season.fit_transform(df["season"])
df["state_enc"] = le_state.fit_transform(df["state"])
df["crop_enc"] = le_crop.fit_transform(df["crop"])

# Prepare X and y
X = df[["soil_type_enc", "season_enc", "state_enc"]]
y = df["crop_enc"]

# Train model
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X, y)

# Save model + encoders
joblib.dump({
    "model": model,
    "le_soil": le_soil,
    "le_season": le_season,
    "le_state": le_state,
    "le_crop": le_crop
}, "crop_model.pkl")

print("✅ Crop recommendation model trained and saved as crop_model.pkl")
