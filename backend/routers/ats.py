import os
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from google import genai

from database.connection import get_db
from database.models import Resume
from routers.auth import get_current_user


# =========================================================
# LOAD ENVIRONMENT
# =========================================================

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set in .env")

client = genai.Client(
    api_key=GEMINI_API_KEY
)


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/api/ai",
    tags=["ATS Resume Scoring"]
)


# =========================================================
# ATS RESUME SCORE
# =========================================================

@router.post("/ats-score")
def calculate_ats_score(
    resume_id: int,
    job_description: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    print("\n======================================")
    print("       CAREERPATH AI ATS SCORING")
    print("======================================")

    # =====================================================
    # 1. GET USER
    # =====================================================

    user_id = current_user["id"]

    print("User ID:", user_id)
    print("Resume ID:", resume_id)


    # =====================================================
    # 2. FIND RESUME
    # =====================================================

    resume = db.query(Resume).filter(
        Resume.id == resume_id
    ).first()

    if not resume:
        raise HTTPException(
            status_code=404,
            detail="Resume not found"
        )


    # =====================================================
    # 3. CHECK OWNERSHIP
    # =====================================================

    if resume.user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to use this resume"
        )


    # =====================================================
    # 4. CHECK RESUME TEXT
    # =====================================================

    if not resume.extracted_text:
        raise HTTPException(
            status_code=400,
            detail="Resume text is empty"
        )


    # =====================================================
    # 5. CHECK JOB DESCRIPTION
    # =====================================================

    if not job_description.strip():
        raise HTTPException(
            status_code=400,
            detail="Job description cannot be empty"
        )


    print(
        "Resume length:",
        len(resume.extracted_text)
    )

    print(
        "Job description length:",
        len(job_description)
    )


    # =====================================================
    # 6. AI PROMPT
    # =====================================================

    prompt = f"""
You are an expert ATS resume evaluator and career advisor.

Analyze the candidate's resume against the provided job description.

Your analysis must be based ONLY on the provided resume
and job description.

Do not invent experience, skills, certifications,
projects, or achievements.

Return ONLY valid JSON.

Use exactly this structure:

{{
    "ats_score": 0,
    "keyword_match_score": 0,
    "technical_skill_score": 0,
    "matching_keywords": [],
    "missing_keywords": [],
    "matching_skills": [],
    "missing_skills": [],
    "resume_strengths": [],
    "resume_weaknesses": [],
    "formatting_issues": [],
    "improvement_suggestions": [],
    "priority_keywords": [],
    "recommendation": ""
}}

Rules:

1. ats_score:
   Overall ATS compatibility score from 0 to 100.

2. keyword_match_score:
   How well the resume contains important keywords
   from the job description.

3. technical_skill_score:
   How well the candidate's technical skills match
   the technical requirements of the job.

4. matching_keywords:
   Important keywords appearing in both the resume
   and job description.

5. missing_keywords:
   Important job-description keywords that are not
   supported by the resume.

6. matching_skills:
   Technical or professional skills supported by
   both the resume and job description.

7. missing_skills:
   Important skills required by the job but not
   supported by the resume.

8. resume_strengths:
   Strong aspects of the resume for this particular job.

9. resume_weaknesses:
   Weak aspects of the resume for this particular job.

10. formatting_issues:
    Identify ATS-related formatting/content issues
    only when evidence exists in the provided resume.

11. improvement_suggestions:
    Give practical suggestions to improve the resume
    for this specific job.

12. priority_keywords:
    List the most important missing keywords that the
    candidate should consider adding ONLY if they are
    genuinely supported by the candidate's experience.
    Do not recommend falsely adding skills.

13. recommendation:
    Give a short practical recommendation.

Keep every score between 0 and 100.

==================================================
CANDIDATE RESUME
==================================================

{resume.extracted_text}

==================================================
JOB DESCRIPTION
==================================================

{job_description}

==================================================
END INPUT
==================================================
"""


    # =====================================================
    # 7. CALL GEMINI
    # =====================================================

    try:

        print("Calling Gemini for ATS scoring...")

        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config={
                "temperature": 0.2,
                "automatic_function_calling": {
                    "disable": True
                }
            }
        )

        result_text = response.text

        if not result_text:
            raise Exception(
                "Gemini returned an empty response"
            )

        print("Gemini response received")


        # =================================================
        # 8. CLEAN JSON
        # =================================================

        result_text = result_text.strip()

        if result_text.startswith("```json"):
            result_text = result_text[7:]

        if result_text.startswith("```"):
            result_text = result_text[3:]

        if result_text.endswith("```"):
            result_text = result_text[:-3]

        result_text = result_text.strip()


        # =================================================
        # 9. PARSE JSON
        # =================================================

        try:

            result = json.loads(result_text)

        except json.JSONDecodeError:

            print("Invalid JSON from Gemini:")
            print(result_text)

            raise HTTPException(
                status_code=500,
                detail="AI returned invalid JSON"
            )


        # =================================================
        # 10. RETURN RESULT
        # =================================================

        print("ATS scoring completed")

        print(
            "ATS score:",
            result.get("ats_score")
        )

        print(
            "Keyword score:",
            result.get("keyword_match_score")
        )

        print(
            "Technical skill score:",
            result.get("technical_skill_score")
        )


        return {
            "message": "ATS scoring completed successfully",
            "resume_id": resume.id,
            "ats_analysis": result
        }


    # =====================================================
    # 11. ERROR HANDLING
    # =====================================================

    except HTTPException:
        raise

    except Exception as e:

        print("======================================")
        print("        ATS GEMINI ERROR")
        print("======================================")

        print(type(e).__name__)
        print(repr(e))

        print("======================================")


        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {str(e)}"
        )