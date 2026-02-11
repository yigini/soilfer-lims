# ─── Stage 1: Build the React client ───
FROM node:20-alpine AS builder

WORKDIR /app

# Install client dependencies
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm ci --ignore-scripts

# Install server dependencies (for Prisma generate)
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --ignore-scripts

# Copy source
COPY client/ ./client/
COPY server/ ./server/

# Generate Prisma client
RUN cd server && npx prisma generate

# Build the Vite app
RUN cd client && npm run build


# ─── Stage 2: Production image ───
FROM node:20-alpine

# Labels
LABEL org.opencontainers.image.title="SoilFER-LIMS"
LABEL org.opencontainers.image.description="Laboratory Information Management System for Soil Analysis"

WORKDIR /app

# Install production server dependencies only
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --omit=dev --ignore-scripts

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
RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
