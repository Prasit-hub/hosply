# --- Stage 1: Build & Compile Native Bindings ---
FROM node:20-alpine AS builder

# Install build dependencies for native modules (better-sqlite3 and bcrypt)
RUN apk add --no-cache python3 make g++ git libc6-compat

WORKDIR /app

# Copy dependency configuration
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (compiles better-sqlite3 and bcrypt natively in alpine)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Generate Prisma Client and compile the Next.js production bundle
RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npx prisma generate
RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npm run build

# --- Stage 2: Minimal Production Image ---
FROM node:20-alpine AS runner

# Install essential runtime packages
RUN apk add --no-cache libc6-compat postgresql-client

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Copy node_modules and built output from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Create persistent directories with proper permissions
RUN mkdir -p /app/data /app/uploads

# Expose healthcare clinical portal port
EXPOSE 4000

# Startup script: Wait for postgres, push schema, and run production server
CMD until pg_isready -h db -U hosply_admin; do echo "Waiting for database..."; sleep 2; done && npx prisma db push && npm run start && src/server.ts
