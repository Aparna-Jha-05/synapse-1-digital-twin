FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y curl build-essential && rm -rf /var/lib/apt/lists/*

# Full stack (incl. torch + uvicorn) for the container image
COPY requirements.txt requirements-local.txt ./
RUN pip install --no-cache-dir -r requirements-local.txt

COPY . .

# Create data directory
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
