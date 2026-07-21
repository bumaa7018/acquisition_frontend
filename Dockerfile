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
ENV NEXT_API_URL=$NEXT_API_URL
ENV NEXT_GS_URL=$NEXT_GS_URL
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
