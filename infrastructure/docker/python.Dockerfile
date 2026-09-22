# syntax=docker/dockerfile:1.7
# Python services. Build context is the repository root.
#   --build-arg SERVICE=simulation|odds|risk|analytics --build-arg PORT=<port>
ARG PYTHON_IMAGE=python:3.12.14-slim@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea

FROM ${PYTHON_IMAGE} AS build
ARG SERVICE
RUN case "${SERVICE}" in simulation|odds|risk|analytics) ;; *) echo "SERVICE must be simulation, odds, risk or analytics" >&2; exit 1 ;; esac
ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_CONSTRAINT=/build/constraints.txt
WORKDIR /build
COPY infrastructure/docker/python-constraints.txt /build/constraints.txt
COPY services/shared /build/services/shared
COPY services/${SERVICE} /build/services/${SERVICE}
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install /build/services/shared "/build/services/${SERVICE}" \
 && /opt/venv/bin/pip uninstall -y pip \
 && python -m compileall -q /opt/venv/lib

FROM ${PYTHON_IMAGE} AS runtime
ARG SERVICE
ARG PORT=3005
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    BETNG_SERVICE=${SERVICE} \
    PORT=${PORT} \
    NODE_ENV=production \
    HOME=/tmp
RUN useradd --system --uid 10001 --user-group --no-create-home --shell /usr/sbin/nologin betng
COPY --from=build /opt/venv /opt/venv
USER 10001
EXPOSE ${PORT}
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import os,sys,urllib.request\ntry:\n    urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ['PORT'], timeout=2)\nexcept Exception:\n    sys.exit(1)"]
CMD ["sh", "-c", "exec \"betng-${BETNG_SERVICE}\""]
