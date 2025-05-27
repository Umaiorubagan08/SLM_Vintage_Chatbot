from flask import Flask, render_template, request, jsonify, session
from dotenv import load_dotenv
import json
import requests
import os

app = Flask(__name__)
app.secret_key = "supersecretkey"  # Needed for session state

# Load buyer data
def load_buyers():
    with open("client_data.json") as f:
        return json.load(f)

def save_buyers(buyers):
    with open("client_data.json", "w") as f:
        json.dump(buyers, f, indent=2)

buyers = load_buyers()

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

# Simple helper for session keys
def get_session(user_id):
    return session.setdefault(user_id, {})

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    global buyers
    data = request.json
    user_input = data["message"]
    user_id = data["user"].strip()
    sess = get_session(user_id)

    # Check if user exists
    buyer = find_buyer(user_id)
    if not buyer:
        # New user: Collect their details step by step
        if "collecting" not in sess:
            sess["collecting"] = "location"
            sess["new_user"] = {"name": user_id, "preferences": {}}
            session.modified = True
            return jsonify({"reply": "You are a new user! Let me save your details. First, which locations are you interested in?"})
        
        if sess["collecting"] == "location":
            sess["new_user"]["preferences"]["locations"] = user_input
            sess["collecting"] = "property_type"
            session.modified = True
            return jsonify({"reply": "Great! What property type are you looking for (e.g., apartment, villa, plot)?"})
        
        if sess["collecting"] == "property_type":
            sess["new_user"]["preferences"]["property_type"] = user_input
            sess["collecting"] = "budget"
            session.modified = True
            return jsonify({"reply": "Noted. What's your budget?"})

        if sess["collecting"] == "budget":
            sess["new_user"]["preferences"]["budget"] = user_input
            sess["collecting"] = "purpose"
            session.modified = True
            return jsonify({"reply": "Is this for buying or renting? (Purpose)"} )

        if sess["collecting"] == "purpose":
            sess["new_user"]["preferences"]["purpose"] = user_input
            sess["collecting"] = "comments"
            session.modified = True
            return jsonify({"reply": "Any additional comments or requirements?"})

        if sess["collecting"] == "comments":
            sess["new_user"]["preferences"]["comments"] = user_input
            # Save to buyers list and file
            buyers.append(sess["new_user"])
            save_buyers(buyers)
            session.pop(user_id)  # Clear session state for this user
            return jsonify({"reply": "Thank you! Your details have been saved. You can now chat with the assistant about your preferences."})

    # Existing user flow
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
