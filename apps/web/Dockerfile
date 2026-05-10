FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN bun install

# Copy source code
COPY apps/web ./apps/web
COPY packages ./packages

# Build the app
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED 1
RUN bun run build

# Expose port
EXPOSE 3001

# Start the app
CMD ["bun", "run", "start"]
