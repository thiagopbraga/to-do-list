# Imagem única para api e worker: o ARG APP escolhe o processo.
# Base Debian (bookworm-slim), nunca Alpine: better-sqlite3 é módulo nativo e exige glibc.

FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY libs/shared/package.json libs/shared/
COPY libs/db/package.json libs/db/
COPY libs/ingest/package.json libs/ingest/
COPY libs/generation/package.json libs/generation/
COPY libs/apkg/package.json libs/apkg/
COPY libs/queue/package.json libs/queue/
COPY libs/storage/package.json libs/storage/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY . .
RUN npx tsc -b tsconfig.build.json \
 && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

ARG APP=api
ENV APP=${APP}

COPY --from=build /app/node_modules ./node_modules

COPY --from=build /app/libs/shared/package.json ./libs/shared/
COPY --from=build /app/libs/shared/dist ./libs/shared/dist
COPY --from=build /app/libs/db/package.json ./libs/db/
COPY --from=build /app/libs/db/dist ./libs/db/dist
COPY --from=build /app/libs/db/drizzle ./libs/db/drizzle
COPY --from=build /app/libs/ingest/package.json ./libs/ingest/
COPY --from=build /app/libs/ingest/dist ./libs/ingest/dist
COPY --from=build /app/libs/generation/package.json ./libs/generation/
COPY --from=build /app/libs/generation/dist ./libs/generation/dist
COPY --from=build /app/libs/apkg/package.json ./libs/apkg/
COPY --from=build /app/libs/apkg/dist ./libs/apkg/dist
COPY --from=build /app/libs/apkg/assets ./libs/apkg/assets
COPY --from=build /app/libs/queue/package.json ./libs/queue/
COPY --from=build /app/libs/queue/dist ./libs/queue/dist
COPY --from=build /app/libs/storage/package.json ./libs/storage/
COPY --from=build /app/libs/storage/dist ./libs/storage/dist

COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/worker/package.json ./apps/worker/
COPY --from=build /app/apps/worker/dist ./apps/worker/dist

USER node
CMD ["sh", "-c", "exec node apps/$APP/dist/main.js"]
