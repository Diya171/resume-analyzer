import io
import logging
import os

from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from pydantic import BaseModel, ValidationError
from pypdf import PdfReader
from google import genai
from google.genai import types

load_dotenv()

logger = logging.getLogger("resume_analyzer")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Resume Analyzer API")

# Allow the Vite dev server to call this API locally.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
PDF_MAGIC_BYTES = b"%PDF-"
MIN_TEXT_LENGTH = 50
GEMINI_MODEL = "gemini-3.5-flash-lite"  # verify against current Gemini docs before shipping


class ResumeAnalysis(BaseModel):
    candidate_summary: str
    technical_skills: list[str]
    soft_skills: list[str]
    strengths: list[str]
    weaknesses: list[str]
    suggested_improvements: list[str]
    suitable_job_roles: list[str]
    overall_score: int


def get_genai_client() -> genai.Client:
    """Built lazily inside the request handler (not at import time) so tests
    can mock it without needing a real API key present at import."""
    api_key = os.environ.get("GEMINI_API_KEY")
    return genai.Client(api_key=api_key)


def build_prompt(resume_text: str) -> str:
    return f"""You are an expert technical recruiter analyzing a resume.

Base every field ONLY on evidence explicitly present in the resume text
below. Do not invent, assume, or generalize beyond what is written. Be
specific — reference actual technologies, roles, projects, or achievements
named in the resume rather than generic statements like "good communication
skills" unless the resume text itself demonstrates that.

Resume text:
---
{resume_text}
---

Analyze this resume and return your assessment."""


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze_resume(resume: UploadFile = File(...)):
    # --- Content-type check (not trusted alone, but reject obvious mismatches early) ---
    if resume.content_type != "application/pdf":
        return JSONResponse(
            status_code=400,
            content={"error": "Only PDF files are supported."},
        )

    file_bytes = await resume.read()

    # --- Empty file check ---
    if len(file_bytes) == 0:
        return JSONResponse(
            status_code=400,
            content={"error": "Only PDF files are supported."},
        )

    # --- Size check ---
    if len(file_bytes) > MAX_FILE_SIZE:
        return JSONResponse(
            status_code=400,
            content={"error": "Only PDF files are supported."},
        )

    # --- Magic bytes check (real PDF signature) ---
    if not file_bytes.startswith(PDF_MAGIC_BYTES):
        return JSONResponse(
            status_code=400,
            content={"error": "Only PDF files are supported."},
        )

    # --- Extract text with pypdf ---
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        extracted_text = ""
        for page in reader.pages:
            page_text = page.extract_text() or ""
            extracted_text += page_text
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"error": "Only PDF files are supported."},
        )

    extracted_text = extracted_text.strip()

    # --- Reject scanned/empty-text PDFs ---
    if len(extracted_text) < MIN_TEXT_LENGTH:
        return JSONResponse(
            status_code=422,
            content={
                "error": (
                    "Could not extract readable text from this PDF. It may be a "
                    "scanned image — please upload a text-based PDF."
                )
            },
        )

    # --- Send to Gemini for structured analysis ---
    try:
        client = get_genai_client()
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=build_prompt(extracted_text),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ResumeAnalysis,
            ),
        )
        analysis = ResumeAnalysis.model_validate_json(response.text)
    except ValidationError:
        logger.exception("Gemini response failed schema validation")
        return JSONResponse(
            status_code=502,
            content={"error": "Resume analysis failed. Please try again."},
        )
    except Exception:
        logger.exception("Gemini API call failed")
        return JSONResponse(
            status_code=502,
            content={"error": "Resume analysis failed. Please try again."},
        )

    return analysis.model_dump()


# --- Global fallback for any unhandled exception anywhere in the app ---
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "Something went wrong. Please try again."},
    )