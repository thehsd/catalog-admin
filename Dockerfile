# ═══════════════════════════════════════════════════════════════════════════════════════
# catalog-admin — React + Vite SPA served by Nginx, production image
# ═══════════════════════════════════════════════════════════════════════════════════════
# Two stages, and the boundary between them is the point: Node builds, Nginx serves. The
# final image contains static files and a web server. No Node.js runtime, no pnpm, no
# node_modules, no TypeScript source — none of it is needed to hand a browser a bundle, and
# every megabyte of it would be attack surface that outlives the build.
#
#   build   node:24-slim  → dist/
#   nginx   nginx-unprivileged:alpine → serves dist/ and proxies /api/ to catalog-api
# ═══════════════════════════════════════════════════════════════════════════════════════


# ─────────────────────────────────────────────────────────────────────────────────────────
# build
# ─────────────────────────────────────────────────────────────────────────────────────────
FROM node:24-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV npm_config_update_notifier=false

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ═══════════════════════════════════════════════════════════════════════════════════════
# BUILD ARGUMENTS — PUBLIC VALUES ONLY
# ═══════════════════════════════════════════════════════════════════════════════════════
# Vite inlines every VITE_* variable into the JavaScript it ships. Whatever is set here is
# not configuration — it is *published content*, readable by anyone who opens the site and
# also visible in `docker history` on the image. Both args below are already-public URLs
# and nothing else is accepted.
#
# REVALIDATION_SECRET is not here and must never be added. The admin does not need it: it
# PATCHes Express, and Express — a server, where a secret can actually be kept — calls the
# Next.js webhook. A browser application has no place to keep a secret, so it is given none.
# ═══════════════════════════════════════════════════════════════════════════════════════

# `/api` rather than an origin: a same-origin relative path, proxied by this image's own
# Nginx to http://catalog-api:4000. Compiling `http://catalog-api:4000` in instead would
# ship a hostname only Docker containers can resolve to a browser that cannot resolve it,
# and every request would fail with a DNS error.
ARG VITE_API_BASE_URL=/api
# Browser-visible link to the public storefront. A Docker service name would be wrong here
# for the same reason: this value ends up in an href a human clicks.
ARG VITE_PUBLIC_WEB_URL=http://localhost:3000

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_PUBLIC_WEB_URL=$VITE_PUBLIC_WEB_URL

COPY tsconfig.json vite.config.ts index.html ./
# src/ includes src/fonts/*.woff2, referenced from src/index.css.
COPY src ./src

# `pnpm build` is `tsc --noEmit && vite build`: a type error fails the image rather than
# shipping a bundle that type-checking would have rejected.
RUN pnpm build

# Guard against a silent Vite output-directory change.
RUN test -f dist/index.html


# ─────────────────────────────────────────────────────────────────────────────────────────
# nginx
# ─────────────────────────────────────────────────────────────────────────────────────────
# The unprivileged variant of the official image: the master process runs as `nginx`
# (uid 101), not root. Docker's default `net.ipv4.ip_unprivileged_port_start=0` is what lets
# an unprivileged process bind port 80, so the container port stays 80 and the config needs
# no port juggling.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS nginx

# Replaces the image's default server block, which listens on 8080 and knows nothing about
# SPA fallback or the /api proxy.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Only the build output crosses the stage boundary. Nothing from /app — not src/, not
# node_modules/, not the manifests — exists in this image.
COPY --from=build /app/dist /usr/share/nginx/html

# Already the image's default; stated so `docker inspect` shows it and a future edit to the
# base image cannot silently promote this container to root.
USER nginx

EXPOSE 80

# Foreground, exec form: nginx is PID 1 and handles SIGTERM/SIGQUIT itself.
CMD ["nginx", "-g", "daemon off;"]
