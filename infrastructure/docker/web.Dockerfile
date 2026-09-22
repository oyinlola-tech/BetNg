# syntax=docker/dockerfile:1.7
# Static browser apps. Build context is the repository root; APP selects web | tv | shop | admin.
ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29-alpine

FROM ${NODE_IMAGE} AS build

ARG APP
RUN case "${APP}" in web|tv|shop|admin) ;; *) echo "APP must be web, tv, shop or admin" >&2; exit 1 ;; esac

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN corepack enable

WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=betng-pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store

COPY . .
RUN --mount=type=cache,id=betng-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --store-dir /pnpm/store \
      --filter "@betng/${APP}..." --filter betng

RUN for name in contracts client-sdk design-tokens brand ui-core; do \
      pnpm --filter "@betng/${name}" build || exit 1; \
    done

# Public build-time configuration only; every VITE_ value ships to the browser.
ARG VITE_APP_ENV=production
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_REALTIME_TRANSPORT
ARG VITE_REALTIME_AUTH
ARG VITE_AUTH_TRANSPORT
ARG VITE_REQUEST_TIMEOUT_MS
ARG VITE_FEATURE_FLAGS
ARG VITE_LOG_LEVEL
ARG VITE_SITE_URL
ARG VITE_UPLOAD_HOSTS
ARG VITE_CHECKOUT_HOSTS

RUN case "${VITE_APP_ENV}" in production|staging) ;; *) echo "VITE_APP_ENV must be production or staging" >&2; exit 1 ;; esac \
 && VITE_APP_ENV="${VITE_APP_ENV}" \
    pnpm --filter "@betng/${APP}" exec vite build \
 && if grep -rlE "VITE_DATA_SOURCE|createMock|betng-demo|demo@betng\.test" "apps/${APP}/dist/assets"; then \
      echo "A production bundle references development-only data." >&2; exit 1; \
    fi \
 && node scripts/check-public-env.mjs --dist "apps/${APP}/dist" \
 && node infrastructure/nginx/csp-hashes.mjs "apps/${APP}/dist/index.html" /out/csp \
 && mv "apps/${APP}/dist" /out/html

FROM ${NGINX_IMAGE}

ARG APP
ENV BETNG_APP=${APP}

USER root
RUN rm -rf /etc/nginx/conf.d/* /etc/nginx/templates /docker-entrypoint.d /usr/share/nginx/html/*
COPY infrastructure/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/nginx/frontend.conf /etc/nginx/conf.d/frontend.conf
COPY infrastructure/nginx/security-headers.conf.template /etc/nginx/betng/security-headers.conf.template
COPY --chmod=0755 infrastructure/nginx/entrypoint.sh /usr/local/bin/betng-entrypoint
COPY --from=build /out/csp /etc/nginx/betng/csp
COPY --from=build /out/html /usr/share/nginx/html
USER 101

EXPOSE 8080
STOPSIGNAL SIGQUIT
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/betng-entrypoint"]
