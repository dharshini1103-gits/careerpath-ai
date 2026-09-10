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
# LOAD ENVIRONMENT VARIABLES
# =========================================================

load_dotenv()


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
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/api/job-match",
    tags=["Job Match"]
)


# =========================================================
# JOB MATCH
# =========================================================

@router.post("/match")
def match_job(
    resume_id: int,
    job_description: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    print("\n======================================")
    print("       CAREERPATH AI JOB MATCH")
    print("======================================")


    # =====================================================
    # 1. GET USER ID
    # =====================================================

    user_id = current_user["id"]

    print("User ID:", user_id)
    print("Resume ID:", resume_id)


    # =====================================================
    # 2. CHECK JOB DESCRIPTION
    # =====================================================

    if not job_description or not job_description.strip():

        raise HTTPException(
            status_code=400,
            detail="Job description cannot be empty"
        )


    # =====================================================
    # 3. FIND RESUME
    # =====================================================

    resume = (
        db.query(Resume)
        .filter(Resume.id == resume_id)
        .first()
    )

    if not resume:

        raise HTTPException(
            status_code=404,
            detail="Resume not found"
        )

    print("Resume found:", resume.filename)


    # =====================================================
    # 4. CHECK OWNERSHIP
    # =====================================================

    if resume.user_id != user_id:

        raise HTTPException(
            status_code=403,
            detail="You are not allowed to use this resume"
        )

    print("Resume ownership verified")


    # =====================================================
    # 5. GET RESUME TEXT
    # =====================================================

    resume_text = resume.extracted_text

    if not resume_text:

        raise HTTPException(
            status_code=400,
            detail="Resume text is empty. Please upload a readable resume."
        )

    print(
        "Resume text length:",
        len(resume_text)
    )

    print(
        "Job description length:",
        len(job_description)
    )


    # =====================================================
    # 6. CREATE AI PROMPT
    # =====================================================

    prompt = f"""
You are an expert ATS resume evaluator and AI career advisor.

Compare the candidate's resume against the provided job
description.

Your analysis MUST be based only on the provided resume
and job description.

IMPORTANT RULES:

1. Do NOT invent skills, experience, education,
   certifications, projects, or qualifications.

2. A skill is a matching skill only when it is clearly
   supported by both the resume and job description.

3. Identify important skills requested by the job
   description but missing from the resume.

4. Identify job requirements supported by the resume.

5. Identify important requirements not supported by
   the resume.

6. Scores must be between 0 and 100.

7. Give a practical recommendation for a fresher/
   entry-level candidate.

8. Return ONLY valid JSON.

Use exactly this structure:

{{
    "match_score": 0,
    "ats_score": 0,
    "matching_skills": [],
    "missing_skills": [],
    "matching_requirements": [],
    "missing_requirements": [],
    "strengths": [],
    "weaknesses": [],
    "recommendation": "",
    "priority_skills_to_learn": []
}}

FIELD DEFINITIONS:

match_score:
Overall compatibility between the candidate's resume
and the job description.

ats_score:
Estimated ATS compatibility based on relevant keywords,
skills, requirements, and qualifications.

matching_skills:
Skills clearly present in both the resume and job
description.

missing_skills:
Important skills mentioned in the job description but
not demonstrated in the resume.

matching_requirements:
Job requirements supported by the candidate's resume.

missing_requirements:
Important job requirements not supported by the resume.

strengths:
Candidate strengths specifically relevant to this job.

weaknesses:
Candidate weaknesses specifically relevant to this job.

recommendation:
Give a short practical recommendation about whether
the candidate should apply and what should be improved.

priority_skills_to_learn:
Missing skills ordered from highest priority to lowest
priority.

Keep match_score and ats_score between 0 and 100.

Do not add extra JSON fields.

==================================================
CANDIDATE RESUME
==================================================

{resume_text}

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

        print(
            "Calling Gemini for job matching..."
        )

        response = client.models.generate_content(
            model="gemini-3.5-flash",
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
                "Gemini returned an empty job match response"
            )

        print(
            "Gemini job match response received"
        )


    except Exception as e:

        print(
            "JOB MATCH GEMINI ERROR:",
            repr(e)
        )

        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {str(e)}"
        )


    # =====================================================
    # 8. CLEAN GEMINI RESPONSE
    # =====================================================

    result_text = result_text.strip()

    if result_text.startswith("```json"):

        result_text = result_text[7:].strip()

    elif result_text.startswith("```"):

        result_text = result_text[3:].strip()

    if result_text.endswith("```"):

        result_text = result_text[:-3].strip()


    # =====================================================
    # 9. PARSE JSON
    # =====================================================

    try:

        job_match = json.loads(result_text)

    except json.JSONDecodeError:

        print("\n======================================")
        print("       INVALID GEMINI JSON")
        print("======================================")

        print(result_text)

        raise HTTPException(
            status_code=500,
            detail="AI returned invalid job match JSON"
        )


    # =====================================================
    # 10. VALIDATE REQUIRED FIELDS
    # =====================================================

    required_fields = [
        "match_score",
        "ats_score",
        "matching_skills",
        "missing_skills",
        "matching_requirements",
        "missing_requirements",
        "strengths",
        "weaknesses",
        "recommendation",
        "priority_skills_to_learn"
    ]


    missing_fields = [
        field
        for field in required_fields
        if field not in job_match
    ]


    if missing_fields:

        raise HTTPException(
            status_code=500,
            detail=f"AI response missing fields: {missing_fields}"
        )


    # =====================================================
    # 11. VALIDATE SCORES
    # =====================================================

    match_score = job_match["match_score"]
    ats_score = job_match["ats_score"]


    if not isinstance(match_score, (int, float)):

        raise HTTPException(
            status_code=500,
            detail="Invalid match_score returned by AI"
        )


    if not isinstance(ats_score, (int, float)):

        raise HTTPException(
            status_code=500,
            detail="Invalid ats_score returned by AI"
        )


    if not 0 <= match_score <= 100:

        raise HTTPException(
            status_code=500,
            detail="match_score must be between 0 and 100"
        )


    if not 0 <= ats_score <= 100:

        raise HTTPException(
            status_code=500,
            detail="ats_score must be between 0 and 100"
        )


    # =====================================================
    # 12. LOG RESULT
    # =====================================================

    print("\n======================================")
    print("       JOB MATCH SUCCESS")
    print("======================================")

    print("Match Score:", match_score)
    print("ATS Score:", ats_score)

    print(
        "Matching Skills:",
        job_match["matching_skills"]
    )

    print(
        "Missing Skills:",
        job_match["missing_skills"]
    )

    print(
        "Priority Skills:",
        job_match["priority_skills_to_learn"]
    )


    # =====================================================
    # 13. RETURN RESULT
    # =====================================================

    return {
        "message": "Job matching completed successfully",
        "resume_id": resume.id,
        "job_match": job_match
    }