# =========================================================
# CAREERPATH AI - AI ROUTER
# =========================================================

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Resume
from routers.auth import get_current_user

from utils.gemini_helper import (
    generate_gemini_response,
    clean_json_response
)


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/api/ai",
    tags=["AI"]
)


# =========================================================
# HELPER - GET USER RESUME
# =========================================================

def get_user_resume(
    resume_id: int,
    current_user,
    db: Session
):

    user_id = current_user["id"]

    resume = (
        db.query(Resume)
        .filter(
            Resume.id == resume_id
        )
        .first()
    )

    if not resume:
        raise HTTPException(
            status_code=404,
            detail="Resume not found"
        )

    if resume.user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to use this resume"
        )

    if not resume.extracted_text:
        raise HTTPException(
            status_code=400,
            detail="Resume text is empty. Please upload a readable resume."
        )

    return resume


# =========================================================
# ANALYZE RESUME
# =========================================================

@router.post("/analyze-resume")
def analyze_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    print("\n======================================")
    print("       CAREERPATH AI ANALYSIS")
    print("======================================")

    resume = get_user_resume(
        resume_id,
        current_user,
        db
    )

    resume_text = resume.extracted_text

    print("User ID:", current_user["id"])
    print("Resume ID:", resume_id)
    print("Resume text length:", len(resume_text))

    # =====================================================
    # PROMPT
    # =====================================================

    prompt = f"""
You are an expert AI career advisor and professional
resume analyst.

Analyze the candidate's resume carefully.

Provide a structured and practical career analysis.

Return the following sections:

1. Candidate Summary
2. Technical Skills
3. Soft Skills
4. Education
5. Projects
6. Work Experience
7. Strongest Skills
8. Missing or Weak Skills
9. Suitable Job Roles
10. Skill Gap Analysis
11. Recommended Learning Roadmap
12. Resume Improvement Suggestions
13. Overall Resume Score out of 100

For Skill Gap Analysis:

- Identify skills already present.
- Identify missing skills.
- Prioritize missing skills as High, Medium, or Low.

For Learning Roadmap:

- Give a practical step-by-step roadmap.
- Mention what to learn first.
- Mention what to learn next.
- Include practical projects.

For Suitable Job Roles:

- Focus on fresher and entry-level roles.
- Explain why each role is suitable.

Do not invent experience.

Be specific and practical.

==================================================
RESUME
==================================================

{resume_text}

==================================================
END RESUME
==================================================
"""

    # =====================================================
    # GEMINI
    # =====================================================

    try:

        analysis = generate_gemini_response(
            prompt=prompt,
            temperature=0.2
        )

    except HTTPException:
        raise

    except Exception as e:

        print("ANALYZE RESUME ERROR:")
        print(repr(e))

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {str(e)}"
        )

    # =====================================================
    # SAVE ANALYSIS
    # =====================================================

    try:

        resume.ai_analysis = analysis

        db.commit()
        db.refresh(resume)

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to save AI analysis: {str(e)}"
        )

    print("AI analysis saved successfully")

    return {
        "message": "Resume analyzed successfully",
        "resume_id": resume.id,
        "analysis": analysis
    }


# =========================================================
# SKILL GAP
# =========================================================

@router.post("/skill-gap")
def analyze_skill_gap(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    print("\n======================================")
    print("       CAREERPATH SKILL GAP")
    print("======================================")

    resume = get_user_resume(
        resume_id,
        current_user,
        db
    )

    resume_text = resume.extracted_text

    # =====================================================
    # PROMPT
    # =====================================================

    prompt = f"""
You are an expert Generative AI career advisor.

Analyze this resume for a fresher who wants to become:

Generative AI Engineer / AI Engineer

Identify:

1. Current technical skills
2. Missing technical skills
3. High priority skills
4. Medium priority skills
5. Low priority skills
6. Recommended learning order

Focus on realistic entry-level AI and Generative AI jobs.

Consider these technologies where relevant:

Python
FastAPI
React
REST APIs
SQL
PostgreSQL
MongoDB
Git
Docker
LLMs
Prompt Engineering
Embeddings
RAG
LangChain
LangGraph
Vector Databases
AI Agents
Cloud
AWS
Redis
Testing
PyTest
CI/CD
LLM Evaluation

IMPORTANT:

- Only consider a skill present if it is supported by the resume.
- Do not invent candidate skills.
- Return ONLY valid JSON.
- Do not use markdown.

Required structure:

{{
    "current_skills": [],
    "missing_skills": [],
    "priority": {{
        "high": [],
        "medium": [],
        "low": []
    }},
    "learning_order": []
}}

==================================================
RESUME
==================================================

{resume_text}

==================================================
END RESUME
==================================================
"""

    # =====================================================
    # GEMINI
    # =====================================================

    try:

        result = generate_gemini_response(
            prompt=prompt,
            temperature=0.1,
            json_mode=True
        )

        skill_gap = clean_json_response(result)

    except HTTPException:
        raise

    except Exception as e:

        print("SKILL GAP ERROR:")
        print(repr(e))

        raise HTTPException(
            status_code=500,
            detail=f"Skill gap generation failed: {str(e)}"
        )

    # =====================================================
    # VALIDATE
    # =====================================================

    if not isinstance(skill_gap, dict):

        raise HTTPException(
            status_code=500,
            detail="AI returned invalid skill gap structure"
        )

    # =====================================================
    # SAFE DEFAULTS
    # =====================================================

    if not isinstance(
        skill_gap.get("current_skills"),
        list
    ):
        skill_gap["current_skills"] = []

    if not isinstance(
        skill_gap.get("missing_skills"),
        list
    ):
        skill_gap["missing_skills"] = []

    if not isinstance(
        skill_gap.get("priority"),
        dict
    ):
        skill_gap["priority"] = {}

    priority = skill_gap["priority"]

    if not isinstance(
        priority.get("high"),
        list
    ):
        priority["high"] = []

    if not isinstance(
        priority.get("medium"),
        list
    ):
        priority["medium"] = []

    if not isinstance(
        priority.get("low"),
        list
    ):
        priority["low"] = []

    if not isinstance(
        skill_gap.get("learning_order"),
        list
    ):
        skill_gap["learning_order"] = []

    # =====================================================
    # RETURN
    # =====================================================

    print("Skill gap generated successfully")

    return {
        "message": "Skill gap analysis completed successfully",
        "resume_id": resume.id,
        "skill_gap": skill_gap
    }