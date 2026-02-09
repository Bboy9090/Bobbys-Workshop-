# 🗺️ Secret Rooms Integration - Implementation Complete

## Summary

Successfully integrated three new Secret Rooms into Bobby's Workshop:

1. **🎵 Sonic Codex** (Room #8) - Audio processing and transcription
2. **👻 Ghost Codex** (Room #9) - Metadata shredding and privacy tools  
3. **⚡ Pandora Codex** (Enhanced) - Hardware manipulation and Chain-Breaker

## Architecture

### Backend Structure

```
backend/
├── main.py                    # FastAPI application
├── modules/
│   ├── sonic/                 # Sonic Codex modules
│   │   ├── routes.py
│   │   ├── job_manager.py
│   │   ├── capture.py
│   │   ├── upload.py
│   │   ├── extractor.py
│   │   ├── enhancement/
│   │   │   ├── preprocess.py
│   │   │   ├── consonant_boost.py
│   │   │   ├── presets.py
│   │   │   └── deepfilter.py
│   │   ├── transcription/
│   │   │   ├── whisper_engine.py
│   │   │   ├── language_detector.py
│   │   │   ├── diarization.py
│   │   │   └── vad.py
│   │   └── exporter.py
│   ├── ghost/                 # Ghost Codex modules
│   │   ├── routes.py
│   │   ├── shredder.py
│   │   ├── canary.py
│   │   └── persona.py
│   └── pandora/               # Pandora Codex modules
│       ├── routes.py
│       ├── detector.py
│       └── websocket.py
└── requirements.txt

server/routes/v1/trapdoor/
├── sonic.js                   # Node.js proxy to FastAPI
├── ghost.js                   # Node.js proxy to FastAPI
└── pandora.js                 # Node.js proxy to FastAPI
```

### Frontend Structure

```
src/components/trapdoor/
├── TrapdoorSonicCodex.tsx     # Sonic Codex UI
├── TrapdoorGhostCodex.tsx     # Ghost Codex UI
└── TrapdoorPandoraCodex.tsx   # Pandora Codex UI

src/components/screens/
└── WorkbenchSecretRooms.tsx   # Updated to include new rooms
```

## Implementation Details

### 1. Sonic Codex

**Features:**
- Audio capture (Live/File/URL)
- Forensic enhancement (spectral gating, consonant boost)
- Whisper transcription
- Speaker diarization (placeholder)
- Export forensic packages

**Endpoints:**
- `POST /api/v1/trapdoor/sonic/upload` - Upload audio/video
- `POST /api/v1/trapdoor/sonic/extract` - Extract audio from video
- `POST /api/v1/trapdoor/sonic/capture/start` - Start live capture
- `GET /api/v1/trapdoor/sonic/jobs` - List jobs
- `GET /api/v1/trapdoor/sonic/jobs/:jobId` - Get job details
- `GET /api/v1/trapdoor/sonic/jobs/:jobId/download` - Download package
- `WS /api/v1/trapdoor/sonic/ws/:jobId` - Job progress WebSocket

### 2. Ghost Codex

**Features:**
- Metadata shredder (images, videos, audio, PDFs)
- Canary token generator
- Burner persona creation

**Endpoints:**
- `POST /api/v1/trapdoor/ghost/shred` - Shred file metadata
- `POST /api/v1/trapdoor/ghost/canary/generate` - Generate canary token
- `GET /api/v1/trapdoor/ghost/trap/:tokenId` - Check canary alert
- `GET /api/v1/trapdoor/ghost/alerts` - List alerts
- `POST /api/v1/trapdoor/ghost/persona/create` - Create persona
- `GET /api/v1/trapdoor/ghost/personas` - List personas

### 3. Pandora Codex

**Features:**
- USB device detection
- DFU mode detection
- Hardware manipulation
- Jailbreak automation
- Real-time WebSocket streaming

**Endpoints:**
- `GET /api/v1/trapdoor/pandora/hardware/status` - Get hardware status
- `POST /api/v1/trapdoor/pandora/enter-dfu` - Enter DFU mode
- `POST /api/v1/trapdoor/pandora/jailbreak` - Execute jailbreak
- `POST /api/v1/trapdoor/pandora/flash` - Flash firmware
- `WS /api/v1/trapdoor/pandora/hardware/stream` - Real-time device updates

## Authentication

All endpoints require:
- `X-Secret-Room-Passcode` header (or `X-API-Key`)
- Trapdoor authentication middleware
- Shadow logging for audit trail

## Dependencies

### Python (requirements.txt)
- FastAPI, Uvicorn
- PyAudio, SoundFile, NumPy, SciPy
- OpenAI Whisper
- Pillow (PIL)
- PyUSB

### Node.js
- Uses native `fetch` API (no additional dependencies)

## Setup Instructions

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Start FastAPI backend:**
   ```bash
   cd backend
   uvicorn main:app --reload --port 8000
   ```

3. **Set environment variables:**
   ```bash
   export SECRET_ROOM_PASSCODE=your-passcode
   export FASTAPI_URL=http://127.0.0.1:8000
   ```

4. **Start Node.js server:**
   ```bash
   npm run server:dev
   ```

5. **Access Secret Rooms:**
   - Navigate to Secret Rooms in the UI
   - Enter passcode
   - Select Sonic Codex, Ghost Codex, or Pandora Codex

## Integration Points

### Cross-Room Integration

1. **Sonic Codex → Ghost Codex:**
   - Export button can trigger metadata shredding
   - Clean packages with no metadata

2. **Pandora Codex → Sonic Codex:**
   - After jailbreak, extract audio from device
   - Process with Sonic Codex

3. **Ghost Codex → All Rooms:**
   - Universal "Ghost Shred" option in export dialogs
   - Protect all exports with metadata stripping

4. **Shadow Archive → All Rooms:**
   - All operations logged to Shadow Archive
   - Encrypted audit trail

## Notes

- FastAPI backend runs on port 8000 by default
- Node.js proxies requests to FastAPI
- File uploads should be sent directly to FastAPI (not proxied)
- WebSocket connections for real-time updates
- Job storage in `jobs/` directory
- Ghost data in `ghost_data/` directory

## Future Enhancements

- [ ] Implement speaker diarization (requires pyannote.audio)
- [ ] Add DeepFilter noise reduction
- [ ] Complete canary token tracking
- [ ] Hidden partition management
- [ ] Advanced hardware manipulation features

## Status

✅ Backend structure created
✅ FastAPI routes implemented
✅ Node.js proxy routes created
✅ Frontend components created
✅ Navigation updated
✅ Integration complete

All three Secret Rooms are now fully integrated and accessible through the Trapdoor interface.
