from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.account_actions import (
    AccountActionService,
    AccountDetails,
    ActionInvalid,
    ActionRequest,
    ActionResponse,
    EmailRequest,
    ResetPasswordRequest,
)
from app.auth.dependencies import CurrentPrincipal
from app.auth.errors import AUTH_ERROR_RESPONSES, auth_unavailable, unauthorized
from app.auth.repository import SqlAlchemyAccountReader
from app.core.mail import MailUnavailable, SMTPMailer
from app.db.session import get_db

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])
Database = Annotated[Session, Depends(get_db)]


def get_account_mailer(request: Request):
    return SMTPMailer(request.app.state.settings)


def get_account_actions(
    request: Request, session: Database, mailer: Annotated[SMTPMailer, Depends(get_account_mailer)]
):
    try:
        return AccountActionService(
            session, request.app.state.settings, mailer, request.app.state.email_cooldown
        )
    except ActionInvalid:
        raise auth_unavailable() from None


Actions = Annotated[AccountActionService, Depends(get_account_actions)]


def action_error():
    return HTTPException(status_code=400, detail="Account action link is invalid or expired")


@router.get(
    "/account",
    response_model=AccountDetails,
    responses=AUTH_ERROR_RESPONSES,
    summary="Read the authenticated account's email verification state",
)
def account_details(principal: CurrentPrincipal, session: Database, response: Response):
    try:
        account = SqlAlchemyAccountReader(session).by_id(principal.account_id)
        if account is None:
            raise unauthorized()
        response.headers["Cache-Control"] = "no-store"
        return AccountDetails(email=account.email, email_verified=account.email_verified)
    except SQLAlchemyError:
        raise auth_unavailable() from None


@router.post(
    "/password-reset/request",
    response_model=ActionResponse,
    status_code=202,
    responses={503: {"description": "SMTP or authentication storage unavailable"}},
    summary="Request a 15-minute password-reset link through configured TLS SMTP",
    description=(
        "Same accepted response for unknown or ineligible accounts. No token is returned. "
        "Repeated requests have a per-process 60-second cooldown."
    ),
)
def request_password_reset(body: EmailRequest, actions: Actions, response: Response):
    try:
        actions.request_email("password_reset", email=str(body.email))
    except (SQLAlchemyError, MailUnavailable):
        raise auth_unavailable() from None
    response.headers["Cache-Control"] = "no-store"
    return ActionResponse(message="If the account is eligible, check its email for a reset link.")


@router.post(
    "/password-reset/confirm",
    response_model=ActionResponse,
    responses={
        400: {"description": "Invalid, expired or already-used action link"},
        503: {"description": "Account storage unavailable"},
    },
    summary="Consume a one-use reset link and replace the password with Argon2id",
)
def confirm_password_reset(body: ResetPasswordRequest, actions: Actions, response: Response):
    try:
        actions.consume(
            body.token.get_secret_value(), "password_reset", body.new_password.get_secret_value()
        )
    except ActionInvalid:
        raise action_error() from None
    except SQLAlchemyError:
        raise auth_unavailable() from None
    response.headers["Cache-Control"] = "no-store"
    return ActionResponse(message="Password reset. Sign in again.")


@router.post(
    "/email-verification/request",
    response_model=ActionResponse,
    status_code=202,
    responses=AUTH_ERROR_RESPONSES,
    summary="Send the current account a 24-hour verification link through TLS SMTP",
)
def request_email_verification(principal: CurrentPrincipal, actions: Actions, response: Response):
    try:
        actions.request_email("email_verification", account_id=principal.account_id)
    except (SQLAlchemyError, MailUnavailable):
        raise auth_unavailable() from None
    except ActionInvalid:
        raise action_error() from None
    response.headers["Cache-Control"] = "no-store"
    return ActionResponse(message="If email verification is needed, check your email for a link.")


@router.post(
    "/email-verification/confirm",
    response_model=ActionResponse,
    responses={
        400: {"description": "Invalid, expired or already-used action link"},
        503: {"description": "Account storage unavailable"},
    },
    summary="Verify account email without changing role/status or requiring verification for login",
)
def confirm_email_verification(body: ActionRequest, actions: Actions, response: Response):
    try:
        actions.consume(body.token.get_secret_value(), "email_verification")
    except ActionInvalid:
        raise action_error() from None
    except SQLAlchemyError:
        raise auth_unavailable() from None
    response.headers["Cache-Control"] = "no-store"
    return ActionResponse(message="Email verified.")
