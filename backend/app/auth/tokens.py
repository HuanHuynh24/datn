from datetime import UTC, datetime

import jwt
from pydantic import SecretStr, ValidationError

from app.auth.schemas import AccessClaims, validate_account_id

ACCESS_TOKEN_TTL_SECONDS = 1800


class InvalidAccessToken(Exception):
    """Publicly sanitized token rejection; never include the supplied JWT."""


class TokenCodec:
    def __init__(self, secret: SecretStr, issuer: str, audience: str):
        if len(secret.get_secret_value().encode("utf-8")) < 32:
            raise ValueError("JWT signing key is too short")
        if not issuer or not audience:
            raise ValueError("JWT issuer and audience are required")
        self._secret = secret
        self._issuer = issuer
        self._audience = audience

    def create_access_token(self, account_id: str) -> str:
        validate_account_id(account_id)
        issued = int(datetime.now(UTC).timestamp())
        claims = AccessClaims(
            sub=account_id,
            iss=self._issuer,
            aud=self._audience,
            iat=issued,
            nbf=issued,
            exp=issued + ACCESS_TOKEN_TTL_SECONDS,
            token_use="access",
        )
        return jwt.encode(claims.model_dump(), self._secret.get_secret_value(), algorithm="HS256")

    def verify_access_token(self, token: str) -> AccessClaims:
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg") != "HS256" or header.get("typ") != "JWT":
                raise InvalidAccessToken()
            if any(key in header for key in ("kid", "jku", "jwk", "x5u", "crit")):
                raise InvalidAccessToken()
            payload = jwt.decode(
                token,
                self._secret.get_secret_value(),
                algorithms=["HS256"],
                issuer=self._issuer,
                audience=self._audience,
                leeway=0,
                options={
                    "require": ["sub", "iss", "aud", "iat", "nbf", "exp", "token_use"],
                    "strict_aud": True,
                },
            )
            claims = AccessClaims.model_validate(payload)
            if claims.nbf != claims.iat or claims.exp - claims.iat != ACCESS_TOKEN_TTL_SECONDS:
                raise InvalidAccessToken()
            return claims
        except (jwt.InvalidTokenError, ValidationError, ValueError):
            raise InvalidAccessToken() from None
