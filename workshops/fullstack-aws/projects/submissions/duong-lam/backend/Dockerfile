# The API as a Docker image: Python + our code + its packages. Runs the same on any machine.
# Build:  docker build -t simplebank-api ./backend
FROM python:3.12-slim

# No .pyc files, and print() output (like the dev-mode emails) shows up right away in `docker logs`
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Packages first: Docker caches this step, so a code-only change rebuilds in seconds
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Don't run as root inside the container (if someone breaks in, they get a powerless user)
RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8000

# Docker asks this every 30 s; "unhealthy" shows in `docker ps` if the API or MongoDB is down
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health', timeout=8)"

# 0.0.0.0 = accept connections from outside the container (127.0.0.1 would only allow itself)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
