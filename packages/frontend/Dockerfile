FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/
RUN npm install --workspace=packages/shared --workspace=packages/frontend

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/frontend/ ./packages/frontend/

# Build shared
RUN npm run build --workspace=packages/shared

# Build frontend
RUN npm run build --workspace=packages/frontend

# Serve with nginx
FROM nginx:alpine
COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
