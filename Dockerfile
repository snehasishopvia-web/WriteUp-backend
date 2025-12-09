FROM node:20.12.2-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose the port the app runs on
EXPOSE 8192

# Command to run the application (will be overridden by docker-compose)
CMD ["npm", "run", "start"]
