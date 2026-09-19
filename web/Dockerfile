# The contest web app: the UI, sign-in, and a thin proxy to the contest engine.
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
# Never run as root.
RUN useradd --system --uid 10002 web && chown -R web /app
USER web
EXPOSE 3000
# The engine owns the schema and migrates it; the web app only serves.
CMD ["pnpm", "start"]
