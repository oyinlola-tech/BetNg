# One recipe for every Python service: `--build-arg SERVICE=simulation|odds|risk|analytics`.
# Build context is the repository root.
FROM python:3.12-slim

ARG SERVICE
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    BETNG_SERVICE=${SERVICE}

WORKDIR /app
COPY services/shared ./services/shared
COPY services/${SERVICE} ./services/${SERVICE}

RUN pip install ./services/shared ./services/${SERVICE} \
 && useradd --system --no-create-home betng

USER betng
CMD ["sh", "-c", "exec betng-${BETNG_SERVICE}"]
