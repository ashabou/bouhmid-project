# ========================================
# Multi-stage Dockerfile for Prospector Agent
# ========================================

# Stage 1: Base with Python and system dependencies
FROM python:3.11-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ========================================
# Stage 2: Dependencies
FROM base AS dependencies

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (needed for scraping)
RUN playwright install chromium && \
    playwright install-deps chromium

# ========================================
# Stage 3: Production
FROM base AS production

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y dumb-init && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 -s /bin/bash python

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=dependencies /usr/local/bin /usr/local/bin
COPY --from=dependencies /root/.cache/ms-playwright /root/.cache/ms-playwright

# Copy application code
COPY . .

# Copy Alembic migrations
COPY alembic ./alembic
COPY alembic.ini ./

# Change ownership to python user
RUN chown -R python:python /app

# Switch to non-root user
USER python

# Expose API port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health').read()"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
