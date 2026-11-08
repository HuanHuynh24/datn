FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN python -m pip install --no-cache-dir --require-hashes -r requirements.txt \
    && useradd --uid 10001 --create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p /data/cv \
    && chown appuser:appuser /data/cv
COPY --chown=appuser:appuser app ./app
USER appuser
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]

FROM runtime AS checks
USER root
COPY requirements-dev.txt ./requirements-dev.txt
RUN python -m pip install --no-cache-dir --require-hashes -r requirements-dev.txt
COPY --chown=appuser:appuser tests ./tests
COPY --chown=appuser:appuser pyproject.toml ./pyproject.toml
COPY --chown=appuser:appuser alembic.ini ./alembic.ini
COPY --chown=appuser:appuser alembic ./alembic
ENV PYTEST_ADDOPTS="-o cache_dir=/tmp/pytest-cache" \
    RUFF_CACHE_DIR=/tmp/ruff-cache
USER appuser
CMD ["python", "-m", "pytest", "-q"]
