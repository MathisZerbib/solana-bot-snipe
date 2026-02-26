FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
# Install Python/G++ build dependencies for nested node-gyp native crypto modules
RUN apk add --no-cache python3 make g++ linux-headers eudev-dev
RUN npm install

COPY . .

# Accept Build-Time Hooks from docker-compose
ARG VITE_PAPER_TRADE_MODE
ENV VITE_PAPER_TRADE_MODE=$VITE_PAPER_TRADE_MODE

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production Server 
FROM nginx:alpine

# Copy the built React/Vite assets to NGINX
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration if needed, otherwise default port 80 is used
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
