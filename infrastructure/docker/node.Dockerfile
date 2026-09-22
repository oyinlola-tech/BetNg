# syntax=docker/dockerfile:1.7
# TypeScript services. Build context is the repository root.
#   runtime (default): --build-arg SERVICE=gateway|match|betting|wallet|settlement|event|identity --build-arg PORT=<port>
#   migrate:           --target migrate, applies every Prisma migration and exits
ARG NODE_IMAGE=node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

FROM ${NODE_IMAGE} AS base
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    npm_config_fetch_retries=5 \
    npm_config_fetch_timeout=120000 \
    pnpm_config_fetch_retries=5 \
    pnpm_config_fetch_timeout=120000 \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=betng-pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store
COPY . .

FROM base AS build
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]
ARG SERVICE
RUN case "${SERVICE}" in \
      gateway) dir=apps/gateway; pkg=@betng/gateway ;; \
      match|betting|wallet|settlement|event|identity) dir="apps/services/${SERVICE}"; pkg="@betng/${SERVICE}-service" ;; \
      *) echo "SERVICE must be gateway, match, betting, wallet, settlement, event or identity" >&2; exit 1 ;; \
    esac \
 && printf '%s\n' "${dir}" > /tmp/service-dir && printf '%s\n' "${pkg}" > /tmp/service-pkg

RUN --mount=type=cache,id=betng-pnpm-store,target=/pnpm/store \
    pkg="$(cat /tmp/service-pkg)" dir="$(cat /tmp/service-dir)" \
 && pnpm install --frozen-lockfile --prefer-offline --store-dir /pnpm/store --filter "${pkg}..." \
 && if [ -f "${dir}/prisma.config.ts" ]; then \
      url="postgresql://build:build@127.0.0.1:5432/build?schema=${SERVICE}"; \
      env "$(echo "${SERVICE}" | tr '[:lower:]' '[:upper:]')_DATABASE_URL=${url}" \
        pnpm --filter "${pkg}" run db:generate; \
    fi \
 && pnpm --filter "${pkg}..." run build \
 && if [ -d "${dir}/src/generated" ] && [ ! -d "${dir}/dist/generated" ]; then cp -r "${dir}/src/generated" "${dir}/dist/generated"; fi \
 && cp -r "${dir}/dist" /tmp/service-dist

# Production dependencies only, installed into a clean tree, then the compiled output laid over it.
FROM base AS prod
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]
COPY --from=build /tmp/service-dir /tmp/service-pkg /tmp/
RUN --mount=type=cache,id=betng-pnpm-store,target=/pnpm/store \
    pkg="$(cat /tmp/service-pkg)" \
 && rm -rf node_modules \
 && pnpm install --prod --frozen-lockfile --offline --store-dir /pnpm/store --filter "${pkg}..."
COPY --from=build /repo/packages/contracts/dist /repo/packages/contracts/dist
COPY --from=build /repo/packages/service-kit/dist /repo/packages/service-kit/dist
COPY --from=build /tmp/service-dist /tmp/service-dist
RUN dir="$(cat /tmp/service-dir)" \
 && rm -rf "${dir}/dist" && cp -r /tmp/service-dist "${dir}/dist" \
 && mkdir -p /out \
 && cp -a node_modules /out/node_modules \
 && for part in packages/contracts packages/service-kit "${dir}"; do \
      mkdir -p "/out/${part}" && cp -a "${part}/package.json" "${part}/dist" "/out/${part}/"; \
      if [ -d "${part}/node_modules" ]; then cp -a "${part}/node_modules" "/out/${part}/"; fi; \
    done \
 && if [ -d "${dir}/dist/generated/prisma" ] && [ ! -e "${dir}/node_modules/@prisma/client-runtime-utils" ]; then \
      utils="$(find node_modules/.pnpm -maxdepth 4 -path '*/node_modules/@prisma/client-runtime-utils' | head -n 1)"; \
      [ -n "${utils}" ] || { echo "@prisma/client-runtime-utils is missing" >&2; exit 1; }; \
      ln -s "../../../../../${utils}" "/out/${dir}/node_modules/@prisma/client-runtime-utils"; \
    fi \
 && ln -s "${dir}" /out/service \
 && find /out \( -name '*.map' -o -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' -o -name '*.tsbuildinfo' \) -type f -delete

FROM base AS migrate-build
RUN --mount=type=cache,id=betng-pnpm-store,target=/pnpm/store \
    rm -rf node_modules \
 && pnpm install --frozen-lockfile --offline --store-dir /pnpm/store \
      --filter @betng/match-service --filter @betng/betting-service --filter @betng/wallet-service \
      --filter @betng/settlement-service --filter @betng/identity-service \
 && mkdir -p /out/apps/services \
 && cp -a node_modules package.json /out/ \
 && for s in match betting wallet settlement identity; do \
      mkdir -p "/out/apps/services/${s}" \
      && cp -a "apps/services/${s}/package.json" "apps/services/${s}/prisma.config.ts" "apps/services/${s}/prisma" \
         "apps/services/${s}/node_modules" "/out/apps/services/${s}/"; \
    done

FROM ${NODE_IMAGE} AS migrate
RUN apk add --no-cache openssl=3.5.8-r0
ENV NODE_ENV=production \
    HOME=/tmp \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
COPY --from=migrate-build /out /repo
WORKDIR /repo
USER 1000:1000
CMD ["sh", "-c", "set -e; for s in match betting wallet settlement identity; do (cd \"apps/services/$s\" && ./node_modules/.bin/prisma migrate deploy); done"]

FROM ${NODE_IMAGE} AS runtime
ARG PORT=3000
ENV NODE_ENV=production \
    PORT=${PORT} \
    HOME=/tmp
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=prod /out /app
WORKDIR /app/service
USER 1000:1000
EXPOSE ${PORT}
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["/bin/sh", "-c", "wget -q -O /dev/null \"http://127.0.0.1:${PORT}/health\" || exit 1"]
CMD ["node", "dist/server.js"]
