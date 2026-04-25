# Build stage
FROM node:18-slim AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Runtime stage
FROM node:18-slim

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy built application from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Expose port 8000
EXPOSE 8000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8000

# Start the application
CMD ["node", "dist/index.js"]