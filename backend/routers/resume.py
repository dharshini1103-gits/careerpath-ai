from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    HTTPException,
    status
)

from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Resume

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from pdfminer.high_level import extract_text

import os
import uuid


router = APIRouter(
    prefix="/api/resume",
    tags=["Resume"]
)


# =========================================================
# JWT CONFIGURATION
# =========================================================

SECRET_KEY = "careerpath-ai-secret-key"
ALGORITHM = "HS256"

security = HTTPBearer()


# =========================================================
# UPLOAD DIRECTORY
# =========================================================

UPLOAD_DIR = "uploads/resumes"

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
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

        return int(user_id)

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


# =========================================================
# UPLOAD RESUME
# =========================================================

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    # -----------------------------------------------------
    # Check file type
    # -----------------------------------------------------

    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed"
        )

    # -----------------------------------------------------
    # Generate unique filename
    # -----------------------------------------------------

    original_filename = file.filename or "resume.pdf"

    extension = os.path.splitext(original_filename)[1]

    unique_filename = f"{uuid.uuid4()}{extension}"

    file_path = os.path.join(
        UPLOAD_DIR,
        unique_filename
    )

    # -----------------------------------------------------
    # Save uploaded PDF
    # -----------------------------------------------------

    try:
        contents = await file.read()

        with open(file_path, "wb") as buffer:
            buffer.write(contents)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save resume: {str(e)}"
        )

    # -----------------------------------------------------
    # Extract text from PDF
    # -----------------------------------------------------

    try:

        extracted_text = extract_text(file_path)

    except Exception as e:

        if os.path.exists(file_path):
            os.remove(file_path)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not extract PDF text: {str(e)}"
        )

    # -----------------------------------------------------
    # Save resume to PostgreSQL
    # -----------------------------------------------------

    resume = Resume(
        user_id=user_id,
        filename=original_filename,
        file_path=file_path,
        extracted_text=extracted_text
    )

    try:

        db.add(resume)
        db.commit()
        db.refresh(resume)

    except Exception as e:

        db.rollback()

        if os.path.exists(file_path):
            os.remove(file_path)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save resume to database: {str(e)}"
        )

    # -----------------------------------------------------
    # Response
    # -----------------------------------------------------

    return {
        "message": "Resume uploaded successfully",
        "resume_id": resume.id,
        "filename": resume.filename,
        "extracted_text_length": len(extracted_text or ""),
        "user_id": resume.user_id
    }


# =========================================================
# GET MY RESUMES
# =========================================================

@router.get("/my-resumes")
def get_my_resumes(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    resumes = (
        db.query(Resume)
        .filter(Resume.user_id == user_id)
        .order_by(Resume.uploaded_at.desc())
        .all()
    )

    return [
        {
            "id": resume.id,
            "filename": resume.filename,
            "file_path": resume.file_path,
            "uploaded_at": resume.uploaded_at,
            "extracted_text_length": len(
                resume.extracted_text or ""
            )
        }
        for resume in resumes
    ]


# =========================================================
# GET SINGLE RESUME
# =========================================================

@router.get("/{resume_id}")
def get_resume(
    resume_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    resume = (
        db.query(Resume)
        .filter(
            Resume.id == resume_id,
            Resume.user_id == user_id
        )
        .first()
    )

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )

    return {
        "id": resume.id,
        "filename": resume.filename,
        "file_path": resume.file_path,
        "extracted_text": resume.extracted_text,
        "uploaded_at": resume.uploaded_at
    }