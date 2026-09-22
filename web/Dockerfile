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
ENV NODE_ENV=production
COPY --from=build /app ./
# Never run as root. Not --system: that caps the UID at SYS_UID_MAX (999).
RUN useradd --no-create-home --shell /usr/sbin/nologin --uid 10002 web && chown -R web /app
USER web
EXPOSE 3000
# The engine owns the schema and migrates it; the web app only serves.
# Started with node directly: `pnpm start` would have corepack fetch pnpm at
# run time, and the hall has no internet (nor does the web user have a home
# to cache it in).
CMD ["node", "node_modules/next/dist/bin/next", "start"]
