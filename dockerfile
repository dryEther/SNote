# --- Stage 1: Build frontend ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source and build with VITE_API_URL=/api
COPY frontend ./
ENV VITE_SERVER_URL=/api
RUN npm run build


# --- Stage 2: Build backend ---
FROM node:20-alpine AS backend-build
WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./
RUN npm install --production

# Copy backend source
COPY backend ./


# --- Stage 3: Final container ---
FROM nginx:alpine

# Install node + chromium for puppeteer
RUN apk add --no-cache \
    nodejs \
    npm \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy backend
COPY --from=backend-build /app/backend ./backend

# Copy frontend dist into nginx html
RUN rm -rf /usr/share/nginx/html/*
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy startup script
COPY start.sh .
RUN chmod +x start.sh

# Set Puppeteer Chromium path
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

EXPOSE 3000
CMD ["./start.sh"]
# --- End of Dockerfile ---