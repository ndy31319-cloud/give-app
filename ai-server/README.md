# AI Server

FastAPI service for policy chatbot and donation image analysis.

## Local run

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Copy `.env.example` to `.env` and set `GEMINI_API_KEY` and `DB_URL` before starting.

## Endpoints

- `GET /health`
- `POST /api/chat/`
- `POST /api/post/generate-post`
- `GET /docs`

## Render

- Root Directory: `ai-server`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/health`

Register `GEMINI_API_KEY` and `DB_URL` in the Render service environment. Do not commit `.env`.
