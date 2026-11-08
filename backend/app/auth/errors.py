from fastapi import HTTPException

from app.auth.schemas import AuthErrorResponse

AUTH_ERROR_RESPONSES = {
    401: {
        "model": AuthErrorResponse,
        "description": "Missing, invalid, expired token, or account no longer eligible",
        "headers": {"WWW-Authenticate": {"schema": {"type": "string"}}},
    },
    403: {"model": AuthErrorResponse, "description": "Insufficient role or object permission"},
    503: {"model": AuthErrorResponse, "description": "Authentication backend unavailable"},
}


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def auth_unavailable() -> HTTPException:
    return HTTPException(status_code=503, detail="Authentication backend unavailable")
