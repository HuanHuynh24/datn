from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.admin import router as admin_router
from app.api.admin_management import router as admin_management_router
from app.api.auth import router as auth_router
from app.api.candidate_profile import router as candidate_profile_router
from app.api.companies import router as companies_router
from app.api.cv_applications import router as cv_applications_router
from app.api.health import router as health_router
from app.api.jobs import router as jobs_router
from app.auth.documentation import install_auth_documentation
from app.core.config import Settings
from app.cv.upload_limit import CVUploadLimit
from app.db.session import build_engine


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else Settings()
    engine = build_engine(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(
        title="Recruitment Management API",
        version="0.1.0",
        description=(
            "Candidate registration, account login and current identity against ERD tables. "
            "Schema is applied separately. No refresh tokens or server revocation."
        ),
        docs_url="/docs" if settings.swagger_enabled else None,
        redoc_url="/redoc" if settings.swagger_enabled else None,
        openapi_url="/openapi.json" if settings.swagger_enabled else None,
        openapi_tags=[
            {"name": "Health", "description": "Process and MySQL availability"},
            {"name": "Authentication", "description": "JWT login and current account"},
        ],
        lifespan=lifespan,
    )
    app.state.engine = engine
    app.state.settings = settings
    app.state.principal_resolver = None
    app.add_middleware(CVUploadLimit)
    if settings.allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.allowed_origins,
            allow_credentials=False,
            allow_methods=["GET", "POST", "PATCH", "DELETE"],
            allow_headers=["Accept", "Content-Type", "Authorization"],
        )
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(candidate_profile_router)
    app.include_router(companies_router)
    app.include_router(admin_router)
    app.include_router(admin_management_router)
    app.include_router(jobs_router)
    app.include_router(cv_applications_router)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request, exc):
        # FastAPI's default validation payload can echo rejected passwords/body.
        errors = [
            {key: value for key, value in error.items() if key in {"loc", "msg", "type"}}
            for error in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": errors})

    install_auth_documentation(app)
    return app
