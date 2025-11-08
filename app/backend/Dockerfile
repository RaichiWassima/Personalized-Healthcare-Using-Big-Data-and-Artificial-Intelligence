FROM python:3.9-slim
WORKDIR /app
COPY . .
RUN apt-get update && \
    apt-get install -y build-essential gcc netcat-openbsd && \
    pip install -r requirements.txt && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN chmod +x /app/wait-for-it.sh

ENTRYPOINT ["/app/wait-for-it.sh"]
CMD ["python", "app.py"]