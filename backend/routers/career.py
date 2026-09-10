import os
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from dotenv import load_dotenv
from google import genai

from database.connection import get_db
from database.models import CareerProfile, Resume
from schemas.career import (
    CareerProfileRequest,
    CareerProfileResponse
)


# =========================================================
# LOAD ENVIRONMENT VARIABLES
# =========================================================

load_dotenv()


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/api/career",
    tags=["Career Profile"]
)


# =========================================================
# JWT CONFIGURATION
# =========================================================

SECRET_KEY = "careerpath-ai-secret-key"
ALGORITHM = "HS256"

security = HTTPBearer()


# =========================================================
# GEMINI CONFIGURATION
# =========================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not set in .env"
    )

client = genai.Client(
    api_key=GEMINI_API_KEY
)


# =========================================================
# GET CURRENT USER ID
# =========================================================

def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("user_id")

        if user_id is None:

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

        return user_id

    except JWTError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


# =========================================================
# CREATE / UPDATE CAREER PROFILE MANUALLY
# =========================================================

@router.post(
    "/profile",
    response_model=CareerProfileResponse
)
def create_or_update_profile(
    data: CareerProfileRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    profile = (
        db.query(CareerProfile)
        .filter(
            CareerProfile.user_id == user_id
        )
        .first()
    )

    if profile:

        profile.target_role = data.target_role
        profile.experience_level = data.experience_level
        profile.skills = data.skills
        profile.education = data.education
        profile.projects = data.projects

    else:

        profile = CareerProfile(
            user_id=user_id,
            target_role=data.target_role,
            experience_level=data.experience_level,
            skills=data.skills,
            education=data.education,
            projects=data.projects
        )

        db.add(profile)

    db.commit()
    db.refresh(profile)

    return profile


# =========================================================
# GET MY CAREER PROFILE
# =========================================================

@router.get(
    "/profile",
    response_model=CareerProfileResponse
)
def get_my_profile(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    profile = (
        db.query(CareerProfile)
        .filter(
            CareerProfile.user_id == user_id
        )
        .first()
    )

    if not profile:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found"
        )

    return profile


# =========================================================
# GENERATE CAREER PROFILE FROM RESUME
# =========================================================

@router.post(
    "/generate-from-resume",
    response_model=CareerProfileResponse
)
def generate_career_profile_from_resume(
    resume_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    print("\n======================================")
    print("     CAREER PROFILE GENERATION")
    print("======================================")

    print("User ID:", user_id)
    print("Resume ID:", resume_id)


    # =====================================================
    # 1. FIND RESUME
    # =====================================================

    resume = (
        db.query(Resume)
        .filter(
            Resume.id == resume_id,
            Resume.user_id == user_id
        )
        .first()
    )

    if not resume:

        print("Resume not found")

        raise HTTPException(
            status_code=404,
            detail="Resume not found or you do not have access to it"
        )


    print("Resume found:", resume.filename)


    # =====================================================
    # 2. CHECK AI ANALYSIS
    # =====================================================

    if not resume.ai_analysis:

        print("AI analysis does not exist")

        raise HTTPException(
            status_code=400,
            detail=(
                "Resume has not been analyzed yet. "
                "Please analyze the resume first."
            )
        )


    print(
        "AI analysis found."
    )

    print(
        "Analysis length:",
        len(resume.ai_analysis)
    )


    # =====================================================
    # 3. CREATE GEMINI PROMPT
    # =====================================================

    prompt = f"""
You are an AI career profile extractor.

Using the resume analysis below, create a structured career profile.

Return ONLY valid JSON.

The JSON must contain exactly these fields:

{{
    "target_role": "string",
    "experience_level": "string",
    "skills": "string",
    "education": "string",
    "projects": "string"
}}

Rules:

target_role:
Choose the most suitable career role for this candidate.

experience_level:
Use values such as:
Fresher
Entry Level
Junior

skills:
List the candidate's important technical skills separated by commas.

education:
Give the candidate's highest relevant education.

projects:
List the candidate's important projects separated by commas.

Do not include markdown.
Do not include ```json.
Return only the JSON object.

RESUME AI ANALYSIS
==================================================

{resume.ai_analysis}

==================================================
END ANALYSIS
"""


    # =====================================================
    # 4. CALL GEMINI
    # =====================================================

    try:

        print("Calling Gemini...")

        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config={
                "temperature": 0.1,
                "automatic_function_calling": {
                    "disable": True
                }
            }
        )

        result = response.text

        if not result:

            raise Exception(
                "Gemini returned an empty response"
            )

        print("Gemini response received")

        print("Gemini output:")
        print(result)


    except Exception as e:

        print("\n===== GEMINI ERROR =====")
        print("Error type:", type(e).__name__)
        print("Error:", repr(e))
        print("========================\n")

        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {str(e)}"
        )


    # =====================================================
    # 5. CLEAN GEMINI JSON
    # =====================================================

    try:

        cleaned_result = result.strip()

        # Remove ```json if Gemini returns it
        if cleaned_result.startswith("```json"):

            cleaned_result = cleaned_result[
                len("```json"):
            ]

        # Remove ``` if Gemini returns it
        elif cleaned_result.startswith("```"):

            cleaned_result = cleaned_result[
                len("```"):
            ]

        # Remove closing ```
        if cleaned_result.endswith("```"):

            cleaned_result = cleaned_result[:-3]

        cleaned_result = cleaned_result.strip()


        # Convert JSON string to Python dictionary
        profile_data = json.loads(
            cleaned_result
        )


        print("JSON parsed successfully")

        print("Profile data:")
        print(profile_data)


    except Exception as e:

        print("\n===== JSON PARSING ERROR =====")
        print("Error:", repr(e))
        print("Gemini returned:")
        print(result)
        print("==============================\n")

        raise HTTPException(
            status_code=500,
            detail=(
                "Gemini returned invalid career "
                "profile JSON"
            )
        )


    # =====================================================
    # 6. FIND EXISTING CAREER PROFILE
    # =====================================================

    profile = (
        db.query(CareerProfile)
        .filter(
            CareerProfile.user_id == user_id
        )
        .first()
    )


    # =====================================================
    # 7. UPDATE EXISTING PROFILE
    # =====================================================

    if profile:

        print(
            "Existing career profile found."
        )

        print(
            "Updating career profile..."
        )

        profile.target_role = profile_data.get(
            "target_role"
        )

        profile.experience_level = profile_data.get(
            "experience_level"
        )

        profile.skills = profile_data.get(
            "skills"
        )

        profile.education = profile_data.get(
            "education"
        )

        profile.projects = profile_data.get(
            "projects"
        )


    # =====================================================
    # 8. CREATE NEW PROFILE
    # =====================================================

    else:

        print(
            "No existing career profile."
        )

        print(
            "Creating new career profile..."
        )

        profile = CareerProfile(
            user_id=user_id,

            target_role=profile_data.get(
                "target_role"
            ),

            experience_level=profile_data.get(
                "experience_level"
            ),

            skills=profile_data.get(
                "skills"
            ),

            education=profile_data.get(
                "education"
            ),

            projects=profile_data.get(
                "projects"
            )
        )

        db.add(profile)


    # =====================================================
    # 9. SAVE TO DATABASE
    # =====================================================

    try:

        db.commit()

        db.refresh(profile)

        print(
            "Career profile saved successfully!"
        )

    except Exception as e:

        db.rollback()

        print("\n===== DATABASE ERROR =====")
        print("Error:", repr(e))
        print("==========================\n")

        raise HTTPException(
            status_code=500,
            detail="Failed to save career profile"
        )


    # =====================================================
    # 10. RETURN PROFILE
    # =====================================================

    print("\n======================================")
    print("   CAREER PROFILE SUCCESS")
    print("======================================\n")

    return profile