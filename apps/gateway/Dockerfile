FROM node:24-alpine AS builder
WORKDIR /app
COPY apps/gateway/package.json ./
RUN corepack enable && pnpm install
COPY apps/gateway/tsconfig.json ./
COPY apps/gateway/src ./src
RUN npx tsc

FROM node:24-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/server.js"]
