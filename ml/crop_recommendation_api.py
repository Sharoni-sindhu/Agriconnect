from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib

app = Flask(__name__)
CORS(app)  # ✅ allow frontend to access API

model_data = joblib.load("crop_model.pkl")
model = model_data["model"]
le_soil = model_data["le_soil"]
le_season = model_data["le_season"]
le_state = model_data["le_state"]
le_crop = model_data["le_crop"]

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        soil_type = data.get("soil_type")
        season = data.get("season")
        state = data.get("place")

        if not soil_type or not season or not state:
            return jsonify({"error": "Missing input fields"}), 400

        for name, value, encoder in [
            ("soil_type", soil_type, le_soil),
            ("season", season, le_season),
            ("state", state, le_state)
        ]:
            if value not in encoder.classes_:
                return jsonify({"error": f"Unknown {name}: {value}"}), 400

        soil_enc = le_soil.transform([soil_type])[0]
        season_enc = le_season.transform([season])[0]
        state_enc = le_state.transform([state])[0]

        pred_enc = model.predict([[soil_enc, season_enc, state_enc]])[0]
        crop = le_crop.inverse_transform([pred_enc])[0]

        return jsonify({"recommended_crop": crop})

    except Exception as e:
        print("❌ ERROR:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=5001, debug=True)
