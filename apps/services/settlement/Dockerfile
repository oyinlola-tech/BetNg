FROM node:24-alpine AS builder
WORKDIR /app
COPY apps/services/settlement/package.json ./
RUN corepack enable && pnpm install
COPY apps/services/settlement/tsconfig.json ./
COPY apps/services/settlement/src ./src
RUN npx tsc

FROM node:24-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3004
CMD ["node", "dist/server.js"]
