# The contest web app: UI and API in one Next.js process.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-slim
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=build /app ./
# Never run as root; the problems volume is the only thing this container writes.
RUN useradd --system --uid 10002 web && chown -R web /app
USER web
EXPOSE 3000
# Migrations run on every start; they are idempotent. Then the server.
CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
