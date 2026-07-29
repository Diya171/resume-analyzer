# Project Notes — Resume Analyzer

## Goal
Upload a resume (PDF), extract text with pypdf, send it to Gemini for
analysis (skills match, feedback, summary), return structured results
to the React frontend.

## Stack decisions
- FastAPI over Flask: async support, automatic docs at /docs.
- google-genai: official Gemini SDK.
- pypdf: lightweight, no external binary deps (vs pdfplumber/poppler).
- Vite + React: fast dev server, no CRA overhead.
- Plain CSS for now — revisit if UI grows complex.
- Gemini model: gemini-3.5-flash-lite (gemini-2.5-flash is retired for
  new API keys as of mid-2026; gemini-3.5-flash hit frequent 503s on the
  free tier due to high demand — the lite variant has been reliable).

## Current status
- [x] Backend skeleton with /health
- [x] Frontend skeleton (default Vite template)
- [x] POST /api/analyze — PDF upload, validation (type/size/magic bytes),
      pypdf text extraction, scanned-PDF rejection
- [x] Gemini integration — structured JSON analysis via response_schema,
      Pydantic validation, generic 502 on any failure (never leaks
      internal errors or API key to client)
- [x] Pytest suite (8 tests): health, PDF rejection paths, empty-text
      rejection, Gemini happy path (mocked), Gemini failure path (mocked),
      Gemini malformed-JSON path (mocked) — no real API calls in tests
- [ ] Frontend upload form + results display
- [ ] Error handling / loading states in UI
- [ ] Deployment plan

## API contract (for frontend work)

**POST /api/analyze**
- Request: multipart/form-data, field name `resume` (PDF file)
- Success (200):
```json
  {
    "candidate_summary": "string",
    "technical_skills": ["string"],
    "soft_skills": ["string"],
    "strengths": ["string"],
    "weaknesses": ["string"],
    "suggested_improvements": ["string"],
    "suitable_job_roles": ["string"],
    "overall_score": 0
  }
```
- Errors:
  - 400 `{"error": "Only PDF files are supported."}` — wrong type, empty,
    too large, or fails magic-byte check
  - 422 `{"error": "Could not extract readable text from this PDF..."}`
    — likely a scanned image with no text layer
  - 502 `{"error": "Resume analysis failed. Please try again."}` —
    Gemini call or response validation failed (rate limit, model
    unavailable, auth issue, etc. — check server logs for specifics)

## Known environment gotchas (Windows + Anaconda)
- Anaconda's `(base)` env can shadow the venv on PATH — always run
  `conda deactivate` before `venv\Scripts\Activate.ps1` if `(base)` is
  showing alongside `(venv)` in the prompt.
- If unsure which Python/pip is active, call the venv's binaries
  explicitly: `.\venv\Scripts\python.exe -m pip ...` /
  `.\venv\Scripts\python.exe -m pytest ...`
- `uvicorn --reload` will watch the entire backend folder by default,
  including `venv/` — this caused an infinite reload loop once. Fix:
  run with `--reload-include main.py` so only that file is watched.
- `.env` (not `.env.example`) is what `load_dotenv()` actually reads —
  must be created locally (`copy .env.example .env`) and is gitignored.
- Free-tier Gemini API keys can return `503 UNAVAILABLE` under high
  demand on some models — this is transient, just retry, or fall back
  to a lighter model variant.

## Open questions
- Should extracted resume text or analysis results be persisted anywhere,
  or processed in-memory only per request? (Currently: in-memory only.)
- Any plan to support job-description matching (compare resume against
  a target job posting) as a future feature?