# Development container for Browser Pool (app only; services run via compose)
FROM oven/bun:latest

# Core CLI tools only (databases run as separate containers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    wget \
    ca-certificates \
    postgresql-client \
    redis-tools \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Non-root user and workspace
RUN useradd -m -s /bin/bash developer && \
    mkdir -p /workspaces/browser-pool && chown -R developer:developer /workspaces

WORKDIR /workspaces/browser-pool

# Create directories for monorepo structure
RUN mkdir -p /workspaces/browser-pool/frontend

# Set environment variables
ENV NODE_ENV=development
ENV BUN_RUNTIME=bun

# Install tsx and concurrently globally
RUN bun install -g tsx concurrently

USER developer
