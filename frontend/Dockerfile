FROM node:20-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Accept the Paper Trade mode from docker-compose
ARG VITE_PAPER_TRADE_MODE
ENV VITE_PAPER_TRADE_MODE=$VITE_PAPER_TRADE_MODE

RUN npm run build

# Production Server 
FROM nginx:alpine

# Copy the built React/Vite assets to NGINX
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration if needed, otherwise default port 80 is used
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
