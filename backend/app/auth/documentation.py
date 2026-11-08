from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from app.auth.dependencies import bearer_scheme
from app.auth.schemas import AuthErrorResponse, LoginRequest, TokenResponse


def install_auth_documentation(app: FastAPI) -> None:
    """Document implemented building blocks without inventing account endpoints."""

    def openapi():
        if app.openapi_schema is None:
            schema = get_openapi(
                title=app.title,
                version=app.version,
                description=app.description,
                routes=app.routes,
                tags=app.openapi_tags,
            )
            components = schema.setdefault("components", {})
            components.setdefault("securitySchemes", {})[bearer_scheme.scheme_name] = (
                bearer_scheme.model.model_dump(mode="json", by_alias=True, exclude_none=True)
            )
            schemas = components.setdefault("schemas", {})
            for model in (LoginRequest, TokenResponse, AuthErrorResponse):
                schemas[model.__name__] = model.model_json_schema()
            app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = openapi
