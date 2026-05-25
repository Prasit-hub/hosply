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
RUN npx prisma generate
RUN npm run build

# --- Stage 2: Minimal Production Image ---
FROM node:20-alpine AS runner

# Install essential runtime packages
RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3006

# Copy node_modules and built output from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/ecosystem.config.js ./ecosystem.config.js

# Create persistent directories with proper permissions
RUN mkdir -p /app/data /app/uploads

# Expose healthcare clinical portal port
EXPOSE 3006

# Startup script: Push migrations/schema to SQLite, and run production server
CMD npx prisma db push && npm run start
