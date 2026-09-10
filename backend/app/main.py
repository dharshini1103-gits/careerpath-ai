from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.connection import engine, Base
from database.models import User, Resume, CareerProfile

from routers.auth import router as auth_router
from routers.resume import router as resume_router
from routers.career import router as career_router
from routers.ai import router as ai_router
from routers.job_match import router as job_match_router
from routers.ats import router as ats_router
from routers.roadmap import router as roadmap_router
from routers.interview import router as interview_router


app = FastAPI(
    title="CareerPath AI",
    description="AI-powered career intelligence platform",
    version="1.0.0"
)


# =========================================================
# DATABASE
# =========================================================

Base.metadata.create_all(bind=engine)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# ROUTERS
# =========================================================

app.include_router(auth_router)
app.include_router(resume_router)
app.include_router(career_router)
app.include_router(ai_router)
app.include_router(job_match_router)
app.include_router(ats_router)
app.include_router(roadmap_router)
app.include_router(interview_router)


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():
    return {
        "message": "Hello CareerPath AI"
    }


# =========================================================
# API TEST
# =========================================================

@app.get("/api/hello")
def hello():
    return {
        "message": "Backend is connected successfully!"
    }