# ─── Stage 1: Build the React client ───
FROM node:20-alpine AS builder

WORKDIR /app

# Copy client package files (lockfile included for reproducible builds)
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci --ignore-scripts

# Copy server package files (for Prisma generate)
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --ignore-scripts

# Copy source
COPY client/ ./client/
COPY server/ ./server/

# Generate Prisma client (Prisma 7 uses prisma.config.ts)
RUN cd server && npx prisma generate

# Build the Vite app with explicit tutorial release enablement
ENV VITE_TUTORIAL_ENABLED=true
RUN cd client && npm run build


# ─── Stage 2: Production image ───
FROM node:20-alpine

# Labels
LABEL org.opencontainers.image.title="SoilFER-LIMS"
LABEL org.opencontainers.image.description="Laboratory Information Management System for Soil Analysis"

WORKDIR /app

# Install build tools needed for better-sqlite3 native addon
RUN apk add --no-cache python3 make g++

# Install production server dependencies
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev --ignore-scripts

# Build the better-sqlite3 native addon (requires python3/make/g++)
RUN cd server && npm rebuild better-sqlite3

# Remove build tools to keep image small
RUN apk del python3 make g++

# Copy server source
COPY server/ ./server/

# Copy Prisma client generated in builder
COPY --from=builder /app/server/prisma_client ./server/prisma_client/

# Copy built client
COPY --from=builder /app/client/dist ./client/dist/

# Backup schema.prisma so entrypoint can restore it if volume overlays prisma dir
RUN mkdir -p /app/server/.schema-backup && \
    cp /app/server/prisma/schema.prisma /app/server/.schema-backup/schema.prisma

# Copy and set entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
