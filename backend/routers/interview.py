from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from utils.gemini_helper import generate_gemini_response, clean_json_response


router = APIRouter(
    prefix="/api/ai/interview",
    tags=["AI Interview"]
)


# =========================================================
# REQUEST MODELS
# =========================================================

class InterviewStartRequest(BaseModel):
    job_description: str
    resume_text: str


class InterviewEvaluateRequest(BaseModel):
    session_id: str
    question: str
    answer: str


class NextQuestionRequest(BaseModel):
    session_id: str


class FinalReportRequest(BaseModel):
    session_id: str


# =========================================================
# IN-MEMORY INTERVIEW SESSIONS
# =========================================================

interview_sessions = {}


# =========================================================
# START INTERVIEW
# =========================================================

@router.post("/start")
def start_interview(request: InterviewStartRequest):

    if not request.resume_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Resume text is required."
        )

    if not request.job_description.strip():
        raise HTTPException(
            status_code=400,
            detail="Job description is required."
        )

    prompt = f"""
You are an expert technical interviewer.

Create the first interview question for a candidate.

TARGET JOB:
{request.job_description}

CANDIDATE RESUME:
{request.resume_text}

The candidate is a fresher / entry-level candidate.

Ask ONE realistic technical interview question based
on the candidate's actual resume and target job.

Do not ask multiple questions.

Return ONLY valid JSON:

{{
    "question": "your question here"
}}
"""

    try:

        response = generate_gemini_response(
            prompt=prompt,
            temperature=0.2,
            json_mode=True
        )

        result = clean_json_response(response)

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate interview question: {str(e)}"
        )

    question = (
        result.get("question")
        if isinstance(result, dict)
        else None
    )

    if not question:
        raise HTTPException(
            status_code=500,
            detail="AI did not return an interview question."
        )

    import uuid

    session_id = str(uuid.uuid4())

    interview_sessions[session_id] = {
        "job_description": request.job_description,
        "resume_text": request.resume_text,
        "questions": [
            question
        ],
        "evaluations": [],
        "current_question": 1
    }

    return {
        "message": "Interview started successfully",
        "session_id": session_id,
        "question": question,
        "question_number": 1,
        "total_questions": 5
    }


# =========================================================
# EVALUATE ANSWER
# =========================================================

@router.post("/evaluate")
def evaluate_answer(request: InterviewEvaluateRequest):

    session = interview_sessions.get(
        request.session_id
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Interview session not found."
        )

    prompt = f"""
You are an expert technical interviewer.

Evaluate the candidate's answer.

QUESTION:
{request.question}

CANDIDATE ANSWER:
{request.answer}

Return ONLY valid JSON:

{{
    "score": 0,
    "technical_accuracy": "",
    "communication": "",
    "strengths": [],
    "weaknesses": [],
    "feedback": ""
}}

Score the answer from 0 to 100.

Be realistic for a fresher.
"""

    try:

        response = generate_gemini_response(
            prompt=prompt,
            temperature=0.2,
            json_mode=True
        )

        evaluation = clean_json_response(response)

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Interview evaluation failed: {str(e)}"
        )

    session["evaluations"].append({
        "question": request.question,
        "answer": request.answer,
        "evaluation": evaluation
    })

    return {
        "message": "Answer evaluated successfully",
        "session_id": request.session_id,
        "evaluation": evaluation
    }


# =========================================================
# NEXT QUESTION
# =========================================================

@router.post("/next-question")
def next_question(request: NextQuestionRequest):

    session = interview_sessions.get(
        request.session_id
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Interview session not found."
        )

    current_number = session["current_question"]

    if current_number >= 5:

        raise HTTPException(
            status_code=400,
            detail="Maximum interview questions reached."
        )

    next_number = current_number + 1

    prompt = f"""
You are conducting a technical interview.

TARGET JOB:
{session["job_description"]}

RESUME:
{session["resume_text"]}

PREVIOUS QUESTIONS:
{session["questions"]}

Generate question number {next_number}.

Ask ONE different technical question.

Focus on skills, projects, APIs, Python,
FastAPI, React, SQL, Generative AI, LLMs,
RAG, or other technologies actually relevant
to the resume and target role.

Return ONLY valid JSON:

{{
    "question": "your question here"
}}
"""

    try:

        response = generate_gemini_response(
            prompt=prompt,
            temperature=0.3,
            json_mode=True
        )

        result = clean_json_response(response)

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate next question: {str(e)}"
        )

    question = (
        result.get("question")
        if isinstance(result, dict)
        else None
    )

    if not question:
        raise HTTPException(
            status_code=500,
            detail="AI did not return the next question."
        )

    session["questions"].append(question)
    session["current_question"] = next_number

    return {
        "message": "Next question generated successfully",
        "session_id": request.session_id,
        "question": question,
        "question_number": next_number,
        "total_questions": 5
    }


# =========================================================
# FINAL REPORT
# =========================================================

@router.post("/final-report")
def final_report(request: FinalReportRequest):

    session = interview_sessions.get(
        request.session_id
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Interview session not found."
        )

    if not session["evaluations"]:

        raise HTTPException(
            status_code=400,
            detail="No interview answers have been evaluated."
        )

    prompt = f"""
You are an expert technical interview evaluator.

Generate a final interview report.

TARGET JOB:
{session["job_description"]}

CANDIDATE RESUME:
{session["resume_text"]}

INTERVIEW EVALUATIONS:
{session["evaluations"]}

Return ONLY valid JSON:

{{
    "overall_score": 0,
    "technical_score": 0,
    "communication_score": 0,
    "strengths": [],
    "weaknesses": [],
    "recommended_topics": [],
    "final_feedback": "",
    "hiring_readiness": ""
}}

Scores must be from 0 to 100.
"""

    try:

        response = generate_gemini_response(
            prompt=prompt,
            temperature=0.2,
            json_mode=True
        )

        report = clean_json_response(response)

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Final interview report failed: {str(e)}"
        )

    return {
        "message": "Final interview report generated successfully",
        "session_id": request.session_id,
        "report": report
    }


# =========================================================
# GET SESSION
# =========================================================

@router.post("/session")
def get_session(request: NextQuestionRequest):

    session = interview_sessions.get(
        request.session_id
    )

    if not session:

        raise HTTPException(
            status_code=404,
            detail="Interview session not found."
        )

    return {
        "session_id": request.session_id,
        "current_question": session["current_question"],
        "questions": session["questions"],
        "evaluations": session["evaluations"]
    }