# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend files
COPY backend/ ./backend/

# Install Python dependencies
WORKDIR /app/backend
RUN pip install -e .

# Copy built frontend from previous stage
WORKDIR /app
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Set working directory for runtime
WORKDIR /app/backend

# Expose port
EXPOSE 2024

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:2024/health || exit 1

# Start application
CMD ["python", "-m", "agent.app"]
