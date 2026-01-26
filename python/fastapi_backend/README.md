# FastAPI Backend for Secret Rooms

FastAPI backend service for Sonic Codex, Ghost Codex, and Pandora Codex.

## Setup

```bash
cd python/fastapi_backend
pip install -r requirements.txt
```

## Run

```bash
python main.py
```

Or with uvicorn:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## Environment Variables

- `SECRET_ROOM_PASSCODE` - Secret Room passcode (default: BJ0990)

## Endpoints

All endpoints require `X-Secret-Room-Passcode` header.

### Sonic Codex
- `GET /api/v1/trapdoor/sonic` - Get info
- `POST /api/v1/trapdoor/sonic/capture/start` - Start audio capture
- `GET /api/v1/trapdoor/sonic/jobs` - List jobs
- `GET /api/v1/trapdoor/sonic/jobs/{job_id}` - Get job details
- `GET /api/v1/trapdoor/sonic/jobs/{job_id}/download` - Download job package

### Ghost Codex
- `GET /api/v1/trapdoor/ghost` - Get info
- `POST /api/v1/trapdoor/ghost/canary/generate` - Generate canary token
- `GET /api/v1/trapdoor/ghost/trap/{token_id}` - Check canary token
- `GET /api/v1/trapdoor/ghost/alerts` - List alerts
- `POST /api/v1/trapdoor/ghost/persona/create` - Create persona
- `GET /api/v1/trapdoor/ghost/personas` - List personas

### Pandora Codex
- `GET /api/v1/trapdoor/pandora` - Get info
- `POST /api/v1/trapdoor/pandora/chainbreaker` - Chain-Breaker operation
- `POST /api/v1/trapdoor/pandora/dfu/detect` - Detect DFU mode
- `POST /api/v1/trapdoor/pandora/dfu/enter` - Enter DFU mode
- `GET /api/v1/trapdoor/pandora/devices` - List devices
- `POST /api/v1/trapdoor/pandora/manipulate` - Hardware manipulation
- `POST /api/v1/trapdoor/pandora/jailbreak/execute` - Execute jailbreak
- `GET /api/v1/trapdoor/pandora/jailbreak/methods` - List jailbreak methods

## Status

Currently returns placeholder responses. Implementation pending.
