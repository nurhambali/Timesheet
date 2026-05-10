FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
COPY apps/server/package.json ./apps/server/

# Install dependencies
RUN bun install

# Copy source code
COPY apps/server ./apps/server
COPY packages ./packages

# Generate Prisma Client
WORKDIR /app/apps/server
RUN bunx prisma generate

# Expose port
EXPOSE 3000

# Start the app
CMD ["bun", "src/index.ts"]
