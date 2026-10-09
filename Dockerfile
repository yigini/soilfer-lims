# ─── Stage 1: Build the React client ───
FROM node:24-alpine AS builder

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
COPY shared/ ./shared/
COPY profiles/ ./profiles/

# Generate Prisma client (Prisma 7 uses prisma.config.ts)
RUN cd server && npx prisma generate

# Build the Vite app
RUN cd client && npm run build


# ─── Stage 2: Production image ───
FROM node:24-alpine

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
COPY shared/ ./shared/
COPY --from=builder /app/server/prisma_client ./server/prisma_client/
COPY profiles/ ./profiles/

# Copy built client
COPY --from=builder /app/client/dist ./client/dist/

# Backup schema.prisma so entrypoint can restore it if volume overlays prisma dir
RUN mkdir -p /app/server/.schema-backup && \
    cp /app/server/prisma/schema.prisma /app/server/.schema-backup/schema.prisma

# Exact #179 release DDL must remain visible outside the persistent Prisma volume.
COPY server/prisma/migrations/20261005000000_workflow_state_evidence/migration.sql /app/server/.migrations-backup/179/20261005000000_workflow_state_evidence/migration.sql
COPY server/prisma/migrations/20261005000100_workflow_state_guards/migration.sql /app/server/.migrations-backup/179/20261005000100_workflow_state_guards/migration.sql
COPY server/prisma/migrations/20261006000000_result_attempt_link/migration.sql /app/server/.migrations-backup/182/20261006000000_result_attempt_link/migration.sql
COPY server/prisma/migrations/20261004064500_add_result_raw_input/migration.sql /app/server/.migrations-backup/272/20261004064500_add_result_raw_input/migration.sql
COPY server/prisma/migrations/20261006000100_sample_holds_cancellation/migration.sql /app/server/.migrations-backup/183/20261006000100_sample_holds_cancellation/migration.sql
COPY server/prisma/migrations/20261006000200_reference_material_catalogue/migration.sql /app/server/.migrations-backup/184/20261006000200_reference_material_catalogue/migration.sql
COPY server/prisma/migrations/20261006000200_reference_material_catalogue/fresh-prisma-tables.json /app/server/.migrations-backup/184/20261006000200_reference_material_catalogue/fresh-prisma-tables.json
COPY server/prisma/migrations/20261006000300_qc_rules/migration.sql /app/server/.migrations-backup/185/20261006000300_qc_rules/migration.sql
COPY server/prisma/migrations/20261006000300_qc_rules/fresh-prisma-tables.json /app/server/.migrations-backup/185/20261006000300_qc_rules/fresh-prisma-tables.json
COPY server/prisma/migrations/20261006000400_normalized_qc_runs/migration.sql /app/server/.migrations-backup/186/20261006000400_normalized_qc_runs/migration.sql
COPY server/prisma/migrations/20261006000400_normalized_qc_runs/fresh-prisma-tables.json /app/server/.migrations-backup/186/20261006000400_normalized_qc_runs/fresh-prisma-tables.json
COPY server/prisma/migrations/20261007000100_qc_gate_scope/migration.sql /app/server/.migrations-backup/187/20261007000100_qc_gate_scope/migration.sql
COPY server/prisma/migrations/20261007000200_qc_bracket_membership/migration.sql /app/server/.migrations-backup/187/20261007000200_qc_bracket_membership/migration.sql
COPY server/prisma/migrations/20261007000300_proficiency_evidence/migration.sql /app/server/.migrations-backup/189/20261007000300_proficiency_evidence/migration.sql
COPY server/prisma/migrations/20261007000400_result_equipment_evidence/migration.sql /app/server/.migrations-backup/189/20261007000400_result_equipment_evidence/migration.sql
COPY server/prisma/migrations/20261009000100_nonconformity_reports/migration.sql /app/server/.migrations-backup/193/20261009000100_nonconformity_reports/migration.sql
COPY server/prisma/migrations/20261004190000_add_workitem_duplicate_marker/migration.sql /app/server/.migrations-backup/178/20261004190000_add_workitem_duplicate_marker/migration.sql
COPY server/prisma/migrations/20261004190100_unique_active_workitem/migration.sql /app/server/.migrations-backup/178/20261004190100_unique_active_workitem/migration.sql
COPY server/prisma/migrations/20261008000100_work_attempt_contract/migration.sql /app/server/.migrations-backup/190/20261008000100_work_attempt_contract/migration.sql
COPY server/prisma/migrations/20261008000200_repeat_correction_contract/migration.sql /app/server/.migrations-backup/191/20261008000200_repeat_correction_contract/migration.sql
COPY server/prisma/migrations/20261009000100_reported_value_selection/migration.sql /app/server/.migrations-backup/192/20261009000100_reported_value_selection/migration.sql
COPY server/prisma/migrations/20261009000200_batch_reagent_lots/migration.sql /app/server/.migrations-backup/194/20261009000200_batch_reagent_lots/migration.sql

# Copy and set entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
