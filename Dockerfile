FROM node:20-alpine

WORKDIR /app

# Ensure native bindings can be built if needed (like for sqlite3 on Alpine)
RUN apk add --no-cache python3 make g++ linux-headers eudev-dev

COPY package*.json ./
RUN npm install

COPY . .

# Ensure data directory exists for the SQLite database
RUN mkdir -p /app/data

# Build the TypeScript project
RUN npm run build

# Start the bot
CMD ["npm", "start"]
