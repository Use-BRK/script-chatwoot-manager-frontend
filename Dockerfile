# syntax=docker/dockerfile:1.7

# ----------- Dependencies -----------
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ----------- Builder -----------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json next.config.mjs postcss.config.js tailwind.config.ts tsconfig.json ./
COPY src ./src

# Variáveis de build — o EasyPanel injeta via env vars do serviço.
# Next.js exige que NEXT_PUBLIC_* estejam presentes em BUILD TIME.
ARG NEXT_PUBLIC_BUNDLE_API_URL=""
ARG NEXT_PUBLIC_BUNDLE_API_KEY=""
ARG NEXT_PUBLIC_GITHUB_TOKEN=""
ARG NEXT_PUBLIC_GITHUB_REPO=""
ARG NEXT_PUBLIC_GITHUB_BRANCH="main"
ARG NEXT_PUBLIC_STRIP_COMMENTS="false"

ENV NEXT_PUBLIC_BUNDLE_API_URL=$NEXT_PUBLIC_BUNDLE_API_URL \
    NEXT_PUBLIC_BUNDLE_API_KEY=$NEXT_PUBLIC_BUNDLE_API_KEY \
    NEXT_PUBLIC_GITHUB_TOKEN=$NEXT_PUBLIC_GITHUB_TOKEN \
    NEXT_PUBLIC_GITHUB_REPO=$NEXT_PUBLIC_GITHUB_REPO \
    NEXT_PUBLIC_GITHUB_BRANCH=$NEXT_PUBLIC_GITHUB_BRANCH \
    NEXT_PUBLIC_STRIP_COMMENTS=$NEXT_PUBLIC_STRIP_COMMENTS

# Next.js telemetry opt-out
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ----------- Runtime -----------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0" \
    NEXT_TELEMETRY_DISABLED=1

# Usuário não-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js standalone output (copiamos o necessário)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
