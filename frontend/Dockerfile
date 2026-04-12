# Frontend Dockerfile - Next.js standalone build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time.
# Set NEXT_PUBLIC_API_BASE_URL in Railway as a build environment variable.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN npm run build

# Production stage - standalone output is self-contained
FROM node:20-alpine

WORKDIR /app

# standalone/ contains its own node_modules - no npm install needed
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Railway sets PORT dynamically; Next.js standalone server.js reads it automatically
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
