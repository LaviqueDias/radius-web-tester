# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache openssl

# Copy root and workspace package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# Install all dependencies
RUN npm install

# Copy source code and Prisma schema
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Generate Prisma client and compile
RUN npm run build --workspace=packages/shared
RUN npm run prisma:generate --workspace=apps/api
RUN npm run build --workspace=apps/api

# Stage 2: Production runner
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies: radclient (freeradius-utils), openssl, dumb-init
RUN apk add --no-cache freeradius-utils openssl dumb-init curl

ENV NODE_ENV=production
ENV PORT=3001
ENV RADCLIENT_PATH=/usr/bin/radclient

# Copy package manifests and production dependencies
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm install --omit=dev

# Copy compiled shared code
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy compiled api code and prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/app.js"]
