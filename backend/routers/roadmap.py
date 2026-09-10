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
    tags=["Career Roadmap"]
)


# =========================================================
# GENERATE CAREER ROADMAP
# =========================================================

@router.post("/roadmap")
def generate_roadmap(
    resume_id: int,
    target_role: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    print("\n======================================")
    print("       CAREERPATH AI ROADMAP")
    print("======================================")

    # =====================================================
    # 1. GET USER
    # =====================================================

    user_id = current_user["id"]

    print("User ID:", user_id)
    print("Resume ID:", resume_id)
    print("Target Role:", target_role)


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
    # 5. CHECK TARGET ROLE
    # =====================================================

    if not target_role.strip():
        raise HTTPException(
            status_code=400,
            detail="Target role cannot be empty"
        )


    # =====================================================
    # 6. AI PROMPT
    # =====================================================

    prompt = f"""
You are an expert AI career coach and learning roadmap generator.

Create a personalized career roadmap for the candidate based
ONLY on the candidate's resume and target role.

Do not invent skills or experience that are not present
in the resume.

Identify what the candidate already knows and what they
need to learn to become job-ready for the target role.

Return ONLY valid JSON.

Use exactly this structure:

{{
    "target_role": "",
    "current_level": "",
    "career_summary": "",
    "current_skills": [],
    "skill_gaps": [],
    "roadmap": [
        {{
            "phase": 1,
            "title": "",
            "duration": "",
            "skills_to_learn": [],
            "topics": [],
            "project": "",
            "goal": ""
        }}
    ],
    "recommended_projects": [],
    "interview_topics": [],
    "job_ready_skills": [],
    "estimated_total_duration": "",
    "final_recommendation": ""
}}

Rules:

1. target_role:
   The target job role provided by the user.

2. current_level:
   Estimate the candidate's current level based on the
   resume. Use values such as Beginner, Intermediate,
   or Advanced.

3. career_summary:
   Give a short assessment of the candidate's current
   position relative to the target role.

4. current_skills:
   List skills clearly supported by the resume.

5. skill_gaps:
   List important skills needed for the target role that
   are missing or insufficiently demonstrated in the resume.

6. roadmap:
   Create a logical learning sequence.

   Each phase must contain:
   - phase number
   - title
   - estimated duration
   - skills to learn
   - important topics
   - one practical project
   - learning goal

7. recommended_projects:
   Recommend practical projects that improve employability
   for the target role.

8. interview_topics:
   List important technical topics the candidate should
   prepare for interviews.

9. job_ready_skills:
   List the skills the candidate should have before
   applying confidently.

10. estimated_total_duration:
    Give a realistic total learning duration.

11. final_recommendation:
    Give practical career advice.

Important:
- Prioritize skills based on the target role.
- Build from the candidate's existing skills.
- Do not recommend learning skills the candidate
  already demonstrates unless advanced knowledge is needed.
- Keep the roadmap practical and suitable for a fresher.
- Projects should be realistic and portfolio-friendly.
- Do not claim the candidate has experience that is absent
  from the resume.


==================================================
CANDIDATE RESUME
==================================================

{resume.extracted_text}


==================================================
TARGET ROLE
==================================================

{target_role}


==================================================
END INPUT
==================================================
"""


    # =====================================================
    # 7. CALL GEMINI
    # =====================================================

    try:

        print("Calling Gemini for career roadmap...")

        response = client.models.generate_content(
           model="gemini-3.5-flash",
            contents=prompt,
            config={
                "temperature": 0.3,
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

        print("Career roadmap generated successfully")

        return {
            "message": "Career roadmap generated successfully",
            "resume_id": resume.id,
            "roadmap": result
        }


    # =====================================================
    # 11. ERROR HANDLING
    # =====================================================

    except HTTPException:
        raise

    except Exception as e:

        print("======================================")
        print("        ROADMAP GEMINI ERROR")
        print("======================================")

        print(type(e).__name__)
        print(repr(e))

        print("======================================")


        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {str(e)}"
        )