from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import json
import requests
import os

app = Flask(__name__)

# Load buyer data
with open("client_data.json") as f:
    buyers = json.load(f)

API_URL = "https://api.together.xyz/v1/chat/completions"

load_dotenv()

API_KEY = os.getenv("TOGETHER_API_KEY")

MODEL = "mistralai/Mistral-7B-Instruct-v0.1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def find_buyer(input_value):
    for buyer in buyers:
        if buyer["name"].lower() == input_value.lower():
            return buyer
    return None

def build_prompt(buyer):
    prefs = buyer["preferences"]
    return f"""
You are a friendly real estate assistant. The buyer's name is {buyer['name']}. Their preferences are:
- Locations: {prefs['locations']}
- Property Type: {prefs['property_type']}
- Budget: {prefs['budget']}
- Purpose: {prefs['purpose']}
- Additional comments: {prefs['comments']}

Ask personalized and helpful questions one at a time.
"""

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_input = data["message"]
    user_id = data["user"]

    buyer = find_buyer(user_id)
    if not buyer:
        return jsonify({"error": "Buyer not found."}), 404

    messages = [
        {"role": "system", "content": build_prompt(buyer)},
        {"role": "user", "content": user_input}
    ]

    body = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 300
    }

    response = requests.post(API_URL, headers=HEADERS, json=body)
    reply = response.json()["choices"][0]["message"]["content"]

    return jsonify({"reply": reply})

if __name__ == "__main__":
    app.run(debug=True)
