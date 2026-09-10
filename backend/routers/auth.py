from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt, JWTError

from database.connection import get_db
from database.models import User
from schemas.auth import RegisterRequest, LoginRequest, TokenResponse


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


# =========================================================
# PASSWORD HASHING
# =========================================================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


# =========================================================
# JWT CONFIGURATION
# =========================================================

SECRET_KEY = "careerpath-ai-secret-key"
ALGORITHM = "HS256"

security = HTTPBearer()


# =========================================================
# REGISTER
# =========================================================

@router.post(
    "/register",
    response_model=TokenResponse
)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db)
):

    # Check whether email already exists
    existing_user = (
        db.query(User)
        .filter(User.email == data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Hash password
    password_hash = pwd_context.hash(data.password)

    # Create user
    user = User(
        name=data.name,
        email=data.email,
        password_hash=password_hash
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Create JWT token
    token = jwt.encode(
        {
            "user_id": user.id,
            "email": user.email
        },
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }


# =========================================================
# LOGIN
# =========================================================

@router.post(
    "/login",
    response_model=TokenResponse
)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db)
):

    # Find user
    user = (
        db.query(User)
        .filter(User.email == data.email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Verify password
    if not pwd_context.verify(
        data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Create JWT token
    token = jwt.encode(
        {
            "user_id": user.id,
            "email": user.email
        },
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }


# =========================================================
# GET CURRENT USER
# =========================================================

@router.get("/me")
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):

    # Get token from Authorization header
    token = credentials.credentials

    try:

        # Decode JWT
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        # Get user ID from token
        user_id = payload.get("user_id")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    # Find user in PostgreSQL
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Return current user
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email
    }