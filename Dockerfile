# ── dev: hot-reload (volume mount хийгддэг, source copy хийхгүй) ──
FROM node:22-alpine3.24 AS dev
RUN apk add --no-cache tzdata
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps
ENV NODE_ENV=development
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── deps ──────────────────────────────────────────────────────────
FROM node:22-alpine3.24 AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

FROM node:22-alpine3.24 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_API_URL=http://api:8080
ARG NEXT_GS_URL=http://geoserver:8080
ARG NEXT_PUBLIC_CESIUM_ION_TOKEN=
ENV NEXT_API_URL=$NEXT_API_URL
ENV NEXT_GS_URL=$NEXT_GS_URL
ENV NEXT_PUBLIC_CESIUM_ION_TOKEN=$NEXT_PUBLIC_CESIUM_ION_TOKEN
# Build-ийн санах ойг ХЯЗГААРЛАНА. Cesium/OpenLayers-тэй bundle нь их зардаг
# бөгөөд Node анхдагчаар боломжтой санах ойн талыг heap болгон авдаг тул
# 4GB-тай орчинд (Docker Desktop-ийн анхдагч) build нь SIGKILL-ээр унадаг.
# Тодорхой хязгаар тавихад Node GC-г эрт хийж, унахын оронд бүтдэг.
#
# 2048 нь ХЭТ ТОМ байсан: Docker Desktop-ийн VM 3.9GB, түүний ~1.5GB-ыг
# backend-ийн контейнерууд эзэлдэг тул build-д ~2GB л сул үлддэг ба swap бараг
# дүүрсэн байдаг. Ө.х. heap-ийн хязгаар нь СУЛ САНАХ ОЙТОЙ ТЭНЦҮҮ байсан тул
# webpack-ийн native хуваарилалт нэмэгдэхэд cgroup хязгаарт хүрч "npm error
# signal SIGKILL" болдог (заримдаа 4+ минут зүтгэсний дараа — swap-д орсноос).
# Хязгаарыг доошлуулахад Node эрт GC хийж, compile нь ~42 секундэд бүтнэ.
#
# Санамж: хэрэв build дахин SIGKILL болвол Docker Desktop-ийн санах ойг
# (Settings → Resources → Memory) 6GB болгож, дараа нь энэ утгыг 2048-3072
# болгож ӨСГӨвөл build бүр ХУРДАН болно.
ENV NODE_OPTIONS=--max-old-space-size=1280
ENV NEXT_TELEMETRY_DISABLED=1
# lint/typecheck-ийг image build дотор алгасах, static-gen worker-ийг хязгаарлах
# (шалтгаан: next.config.mjs дээрх IN_DOCKER_BUILD-ийн тайлбар).
ENV BUILD_IN_DOCKER=1
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

FROM node:22-alpine3.24 AS runner
RUN apk add --no-cache tzdata
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
