# =========================================================
# CAREERPATH AI - GEMINI HELPER
# =========================================================

import os
import time
import json

from dotenv import load_dotenv
from fastapi import HTTPException
from google import genai


# =========================================================
# LOAD ENVIRONMENT
# =========================================================

load_dotenv()


# =========================================================
# API KEY
# =========================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not set in .env"
    )


# =========================================================
# GEMINI CLIENT
# =========================================================

client = genai.Client(
    api_key=GEMINI_API_KEY
)


# =========================================================
# MODELS
#
# These models were confirmed by your test_gemini.py
# =========================================================

PRIMARY_MODEL = "gemini-3.5-flash"
BACKUP_MODEL = "gemini-3.6-flash"


# =========================================================
# RETRY SETTINGS
# =========================================================

MAX_RETRIES = 3


# =========================================================
# TEMPORARY ERROR CHECK
# =========================================================

def is_temporary_error(error):

    error_text = str(error).lower()

    temporary_errors = [
        "503",
        "unavailable",
        "high demand",
        "temporarily",
        "429",
        "resource_exhausted",
        "overloaded",
        "internal server error",
        "deadline exceeded",
        "timeout",
        "rate limit"
    ]

    return any(
        item in error_text
        for item in temporary_errors
    )


# =========================================================
# GEMINI RESPONSE GENERATOR
# =========================================================

def generate_gemini_response(
    prompt: str,
    temperature: float = 0.2,
    json_mode: bool = False
):

    models = [
        PRIMARY_MODEL,
        BACKUP_MODEL
    ]

    last_error = None

    # =====================================================
    # TRY EACH MODEL
    # =====================================================

    for model_name in models:

        print("\n======================================")
        print("Gemini model:", model_name)
        print("======================================")

        # =================================================
        # RETRIES
        # =================================================

        for attempt in range(
            1,
            MAX_RETRIES + 1
        ):

            try:

                print(
                    f"Gemini attempt "
                    f"{attempt}/{MAX_RETRIES}"
                )

                # -----------------------------------------
                # BASIC CONFIG
                # -----------------------------------------

                config = {
                    "temperature": temperature
                }

                # -----------------------------------------
                # DISABLE AUTOMATIC FUNCTION CALLING
                # -----------------------------------------

                config[
                    "automatic_function_calling"
                ] = {
                    "disable": True
                }

                # -----------------------------------------
                # JSON MODE
                # -----------------------------------------

                if json_mode:

                    config[
                        "response_mime_type"
                    ] = "application/json"

                # -----------------------------------------
                # CALL GEMINI
                # -----------------------------------------

                response = client.models.generate_content(

                    model=model_name,

                    contents=prompt,

                    config=config
                )

                # -----------------------------------------
                # GET RESPONSE TEXT
                # -----------------------------------------

                text = getattr(
                    response,
                    "text",
                    None
                )

                # -----------------------------------------
                # SUCCESS
                # -----------------------------------------

                if text and text.strip():

                    print(
                        "======================================"
                    )

                    print(
                        "Gemini SUCCESS:",
                        model_name
                    )

                    print(
                        "======================================"
                    )

                    return text.strip()

                # -----------------------------------------
                # EMPTY RESPONSE
                # -----------------------------------------

                raise Exception(
                    "Gemini returned an empty response"
                )

            except Exception as e:

                last_error = e

                print(
                    "Gemini error:",
                    repr(e)
                )

                # -----------------------------------------
                # NON-TEMPORARY ERROR
                # -----------------------------------------

                if not is_temporary_error(e):

                    print(
                        "Non-temporary Gemini error."
                    )

                    break

                # -----------------------------------------
                # RETRY TEMPORARY ERROR
                # -----------------------------------------

                if attempt < MAX_RETRIES:

                    wait_time = 2 ** attempt

                    print(
                        f"Waiting {wait_time} seconds..."
                    )

                    time.sleep(
                        wait_time
                    )

        print(
            f"Model failed: {model_name}"
        )

    # =====================================================
    # ALL MODELS FAILED
    # =====================================================

    print("\n======================================")
    print("       ALL GEMINI MODELS FAILED")
    print("======================================")

    print(
        "Last error:",
        repr(last_error)
    )

    # IMPORTANT:
    # Return the actual Gemini error instead of hiding it
    # behind "temporarily unavailable".
    # This makes debugging much easier.

    raise HTTPException(

        status_code=503,

        detail=(
            "Gemini API request failed. "
            f"Last error: {str(last_error)}"
        )
    )


# =========================================================
# CLEAN JSON RESPONSE
# =========================================================

def clean_json_response(text: str):

    if not text:

        raise ValueError(
            "Gemini returned an empty response"
        )

    result = text.strip()

    # =====================================================
    # REMOVE MARKDOWN CODE BLOCK
    # =====================================================

    if result.startswith("```json"):

        result = result[7:]

    elif result.startswith("```"):

        result = result[3:]

    if result.endswith("```"):

        result = result[:-3]

    result = result.strip()

    # =====================================================
    # DIRECT JSON
    # =====================================================

    try:

        return json.loads(result)

    except json.JSONDecodeError:

        pass

    # =====================================================
    # FIND JSON OBJECT
    # =====================================================

    start = result.find("{")
    end = result.rfind("}")

    if start != -1 and end != -1:

        possible_json = result[
            start:end + 1
        ]

        try:

            return json.loads(
                possible_json
            )

        except json.JSONDecodeError:

            pass

    # =====================================================
    # FIND JSON ARRAY
    # =====================================================

    start = result.find("[")
    end = result.rfind("]")

    if start != -1 and end != -1:

        possible_json = result[
            start:end + 1
        ]

        try:

            return json.loads(
                possible_json
            )

        except json.JSONDecodeError:

            pass

    # =====================================================
    # INVALID JSON
    # =====================================================

    raise ValueError(
        "Gemini returned invalid JSON"
    )