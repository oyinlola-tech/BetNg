# One image for every TypeScript service; compose picks the service with `command`.
# Build context is the repository root.
FROM node:24-alpine

ENV NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN corepack enable && apk add --no-cache openssl

WORKDIR /app
COPY . .

# Dev dependencies stay: services run through tsx, and Prisma's CLI applies migrations.
RUN pnpm install --frozen-lockfile --prod=false \
 && pnpm --filter @betng/contracts --filter @betng/service-kit build \
 && MATCH_DATABASE_URL=postgresql://build/build?schema=match \
    BETTING_DATABASE_URL=postgresql://build/build?schema=betting \
    WALLET_DATABASE_URL=postgresql://build/build?schema=wallet \
    SETTLEMENT_DATABASE_URL=postgresql://build/build?schema=settlement \
    IDENTITY_DATABASE_URL=postgresql://build/build?schema=identity \
    pnpm db:generate

USER node
CMD ["node", "--version"]
