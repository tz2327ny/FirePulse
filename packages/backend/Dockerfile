FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
RUN npm install --workspace=packages/shared --workspace=packages/backend

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/

# Generate Prisma client
RUN npx prisma generate --schema=packages/backend/prisma/schema.prisma

# Build shared
RUN npm run build --workspace=packages/shared

# Build backend
RUN npm run build --workspace=packages/backend

# Production stage
FROM node:20-alpine
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/packages/backend/dist ./packages/backend/dist
COPY --from=base /app/packages/backend/package.json ./packages/backend/
COPY --from=base /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=base /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=base /app/package.json ./

EXPOSE 3001
EXPOSE 41234/udp

CMD ["sh", "-c", "npx prisma migrate deploy --schema=packages/backend/prisma/schema.prisma && node packages/backend/dist/index.js"]
