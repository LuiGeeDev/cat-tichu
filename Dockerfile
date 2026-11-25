# syntax=docker/dockerfile:1

# ---------- 1. 클라이언트 빌드 ----------
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY src ./src
COPY shared ./shared
COPY public ./public
RUN npm run build

# ---------- 2. 실행 이미지 ----------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=8787
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY shared ./shared
COPY public ./public
COPY --from=build /app/dist ./dist

USER node
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1

CMD ["node", "server/index.js"]
