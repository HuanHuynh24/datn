import secrets
from datetime import UTC, datetime

import jwt
import pytest
from pydantic import SecretStr

from app.auth.tokens import InvalidAccessToken, TokenCodec


@pytest.fixture
def codec():
    return TokenCodec(SecretStr(secrets.token_urlsafe(48)), "recruitment-api", "recruitment-web")


def payload():
    now = int(datetime.now(UTC).timestamp())
    return dict(
        sub="1",
        iss="recruitment-api",
        aud="recruitment-web",
        iat=now,
        nbf=now,
        exp=now + 1800,
        token_use="access",
    )


def test_real_token_roundtrip_and_30_minute_lifetime(codec):
    token = codec.create_access_token("9223372036854775807")
    claims = codec.verify_access_token(token)
    assert claims.sub == "9223372036854775807"
    assert claims.exp - claims.iat == 1800
    assert claims.nbf == claims.iat
    assert set(claims.model_dump()) == {"sub", "iss", "aud", "iat", "nbf", "exp", "token_use"}


@pytest.mark.parametrize("account_id", ["0", "-1", "01", "1.0", "abc", "١", "9223372036854775808"])
def test_invalid_subject_cannot_be_issued(codec, account_id):
    with pytest.raises(ValueError):
        codec.create_access_token(account_id)


@pytest.mark.parametrize(
    "change",
    [
        {"iss": "wrong"},
        {"aud": "wrong"},
        {"token_use": "refresh"},
        {"sub": "0"},
        {"sub": 1},
        {"iat": True},
        {"exp": "9999999999"},
        {"exp": 1},
        {"nbf": 9999999999},
        {"iat": 9999999999},
        {"role": "ADMIN"},
        {"company_id": "99"},
    ],
)
def test_signed_but_invalid_claims_rejected(change):
    secret = SecretStr(secrets.token_urlsafe(48))
    codec = TokenCodec(secret, "recruitment-api", "recruitment-web")
    claims = payload() | change
    token = jwt.encode(claims, secret.get_secret_value(), algorithm="HS256")
    with pytest.raises(InvalidAccessToken):
        codec.verify_access_token(token)


@pytest.mark.parametrize("missing", ["sub", "iss", "aud", "iat", "nbf", "exp", "token_use"])
def test_required_claims(missing):
    secret = SecretStr(secrets.token_urlsafe(48))
    claims = payload()
    del claims[missing]
    token = jwt.encode(claims, secret.get_secret_value(), algorithm="HS256")
    with pytest.raises(InvalidAccessToken):
        TokenCodec(secret, "recruitment-api", "recruitment-web").verify_access_token(token)


def test_wrong_key_algorithm_header_and_lifetime(codec):
    secret = SecretStr(secrets.token_urlsafe(48))
    own_codec = TokenCodec(secret, "recruitment-api", "recruitment-web")
    token = own_codec.create_access_token("1")
    with pytest.raises(InvalidAccessToken):
        codec.verify_access_token(token)
    for algorithm, headers in [
        ("HS384", {}),
        ("HS256", {"typ": "refresh"}),
        ("HS256", {"kid": "attacker"}),
        ("none", {}),
    ]:
        key = None if algorithm == "none" else secret.get_secret_value()
        token = jwt.encode(payload(), key, algorithm=algorithm, headers=headers)
        with pytest.raises(InvalidAccessToken):
            own_codec.verify_access_token(token)
    token = jwt.encode(
        payload() | {"exp": payload()["iat"] + 3600}, secret.get_secret_value(), algorithm="HS256"
    )
    with pytest.raises(InvalidAccessToken):
        own_codec.verify_access_token(token)


def test_malformed_token_and_short_secret(codec):
    with pytest.raises(InvalidAccessToken):
        codec.verify_access_token("not-a-jwt")
    with pytest.raises(ValueError):
        TokenCodec(SecretStr("short"), "issuer", "audience")
