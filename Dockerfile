FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.4.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile
COPY . .

FROM base AS api
ENV NODE_ENV=production
USER node
CMD ["pnpm", "--filter", "@shekinah/api", "start"]

FROM base AS admin-dev
CMD ["pnpm", "--filter", "@shekinah/admin", "dev"]

FROM base AS admin-build
RUN pnpm --filter @shekinah/admin build

FROM nginx:1.28-alpine AS admin
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=admin-build /app/apps/admin/dist /usr/share/nginx/html
