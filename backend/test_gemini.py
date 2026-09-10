import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

print("API KEY LOADED:", bool(api_key))

if not api_key:
    raise RuntimeError("GEMINI_API_KEY not found")

client = genai.Client(
    api_key=api_key
)

print("\nMODELS AVAILABLE FOR generateContent:\n")

for model in client.models.list():

    if model.supported_actions:

        if "generateContent" in model.supported_actions:

            print(model.name)