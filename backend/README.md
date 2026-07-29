# Resume Analyzer

Full-stack app that analyzes resumes. Backend: FastAPI + Gemini + pypdf.
Frontend: React (Vite).

## Prerequisites
- Python 3.10+
- Node.js 18+

## Backend setup

\`\`\`bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # then add your real GEMINI_API_KEY
uvicorn main:app --reload --port 8000
\`\`\`

Visit http://localhost:8000/health — should return `{"status":"ok"}`.

## Frontend setup

\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`

Visit http://localhost:5173 — should show the default Vite + React page.

## Status
Bare scaffold only — no resume analysis features yet. See PROJECT_NOTES.md.