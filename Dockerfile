# Stage 1: Build the React/Vite frontend
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# Stage 2: Production runtime
FROM node:22-alpine AS runner

WORKDIR /app

COPY package.json package-lock.json ./

# Install all deps (including devDeps) — server.ts has a top-level import from 'vite'
# which would throw even in production if vite is missing, despite the code path not running
RUN npm ci

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy the server source
COPY server.ts ./

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npx", "tsx", "server.ts"]
