FROM python:3.11-slim
WORKDIR /app
ENV POETRY_VERSION=1.8.4 \
    POETRY_VIRTUALENVS_CREATE=false \
    PYTHONUNBUFFERED=1
RUN pip install "poetry==$POETRY_VERSION"
COPY apps/ml/pyproject.toml ./pyproject.toml
RUN poetry install --no-interaction --no-ansi --without dev
COPY apps/ml/app ./app
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]
