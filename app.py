from flask import Flask, render_template, request, jsonify
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.route("/")
def home():
    return render_template("chat.html")

@app.route("/recommend", methods=["POST"])
def recommend():
    user_input = request.json.get("query")

    try:
        # Send prompt to OpenAI
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are AgriBot, an expert in agriculture who recommends the best crops based on soil type, climate, and season."},
                {"role": "user", "content": user_input}
            ],
            max_tokens=200,
            temperature=0.7
        )

        reply = completion.choices[0].message.content
        return jsonify({"response": reply})

    except Exception as e:
        return jsonify({"response": f"Error: {str(e)}"})

if __name__ == "__main__":
    app.run(debug=True)
