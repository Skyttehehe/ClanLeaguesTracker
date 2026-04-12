# Backend Dockerfile - Multi-stage build
FROM node:20-alpine AS builder

# Install OpenSSL so Prisma engine binaries can load during build
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files and prisma schema before install so
# the schema is available if any postinstall hook runs generate
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Copy remaining source and build
COPY . .
RUN npm run build
RUN npx prisma generate

# Production stage
FROM node:20-alpine

# Install OpenSSL so Prisma engine binaries can load at runtime
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma

# Install production deps only
RUN npm ci --only=production

# Copy prisma CLI from builder so we can run generate in this stage
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines

# Generate the client with the correct binary for this image's runtime
RUN npx prisma generate

# Copy compiled app and startup script
COPY --from=builder /app/dist ./dist
COPY start.sh ./start.sh
RUN chmod +x start.sh

EXPOSE 3000

CMD ["sh", "start.sh"]
