# Frontend Dockerfile - Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build Next.js
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3001

CMD ["npm", "start"]
