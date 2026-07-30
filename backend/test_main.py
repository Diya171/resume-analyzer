import io
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

from main import app, ResumeAnalysis, JobMatchAnalysis

client = TestClient(app)


def make_sample_pdf(text="John Doe\nSoftware Engineer\n" + ("Experienced developer. " * 10)) -> bytes:
    """Generate a small in-memory PDF with real extractable text."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    text_obj = c.beginText(50, 750)
    for line in text.split("\n"):
        text_obj.textLine(line)
    c.drawText(text_obj)
    c.save()
    buffer.seek(0)
    return buffer.read()


def make_fake_gemini_response(model_instance) -> MagicMock:
    fake_response = MagicMock()
    fake_response.text = model_instance.model_dump_json()
    return fake_response


def make_job_description(word_count: int) -> str:
    """Build a job description with an exact word count for boundary testing."""
    return " ".join(["requirement"] * word_count)


# --- /health ---

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# --- /api/analyze (existing behavior, plus new extracted_text field) ---

def test_analyze_rejects_non_pdf():
    fake_file = io.BytesIO(b"This is just plain text, not a PDF.")
    response = client.post(
        "/api/analyze",
        files={"resume": ("resume.txt", fake_file, "text/plain")},
    )
    assert response.status_code == 400
    assert response.json() == {"error": "Only PDF files are supported."}


def test_analyze_rejects_scanned_pdf_with_no_text():
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.save()
    buffer.seek(0)
    blank_pdf_bytes = buffer.read()

    response = client.post(
        "/api/analyze",
        files={"resume": ("resume.pdf", blank_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 422
    assert "error" in response.json()


@patch("main.get_genai_client")
def test_analyze_happy_path_includes_extracted_text(mock_get_client):
    fake_analysis = ResumeAnalysis(
        candidate_summary="Experienced backend engineer with 5 years in Python and cloud infrastructure.",
        technical_skills=["Python", "FastAPI", "AWS"],
        soft_skills=["Communication", "Leadership"],
        strengths=["Strong ownership of projects"],
        weaknesses=["Limited frontend exposure"],
        suggested_improvements=["Add quantifiable metrics to project bullet points"],
        suitable_job_roles=["Backend Engineer"],
        overall_score=82,
    )

    mock_client_instance = MagicMock()
    mock_client_instance.models.generate_content.return_value = make_fake_gemini_response(fake_analysis)
    mock_get_client.return_value = mock_client_instance

    pdf_bytes = make_sample_pdf()
    response = client.post(
        "/api/analyze",
        files={"resume": ("resume.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["overall_score"] == 82
    assert "extracted_text" in data
    assert "John Doe" in data["extracted_text"]
    assert "Software Engineer" in data["extracted_text"]


@patch("main.get_genai_client")
def test_analyze_gemini_api_failure_returns_502(mock_get_client):
    mock_client_instance = MagicMock()
    mock_client_instance.models.generate_content.side_effect = Exception(
        "401 Unauthorized: invalid API key AIzaSyFAKEKEY12345"
    )
    mock_get_client.return_value = mock_client_instance

    pdf_bytes = make_sample_pdf()
    response = client.post(
        "/api/analyze",
        files={"resume": ("resume.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 502
    assert response.json() == {"error": "Resume analysis failed. Please try again."}
    assert "AIzaSy" not in response.text
    assert "401" not in response.text


# --- /api/match-job ---

@patch("main.get_genai_client")
def test_match_job_happy_path(mock_get_client):
    fake_match = JobMatchAnalysis(
        match_score=74,
        verdict="Moderate Match",
        matching_skills=["3+ years Python experience", "AWS deployment experience"],
        missing_skills=["Requires '5+ years of Kubernetes experience' — not evidenced in resume"],
        gap_analysis=[
            "Job requires Senior-level (5+ yrs); resume shows ~3 years of professional experience"
        ],
        tailoring_suggestions=[
            "Add a line about any container/orchestration exposure, even at a learning/POC level"
        ],
    )

    mock_client_instance = MagicMock()
    mock_client_instance.models.generate_content.return_value = make_fake_gemini_response(fake_match)
    mock_get_client.return_value = mock_client_instance

    response = client.post(
        "/api/match-job",
        json={
            "resume_text": "John Doe. Software Engineer with 3 years of Python and AWS experience.",
            "job_description": make_job_description(25),
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["match_score"] == 74
    assert data["verdict"] == "Moderate Match"
    assert "Kubernetes" in data["missing_skills"][0]
    mock_client_instance.models.generate_content.assert_called_once()


def test_match_job_rejects_missing_resume_text():
    response = client.post(
        "/api/match-job",
        json={
            "resume_text": "",
            "job_description": make_job_description(25),
        },
    )
    assert response.status_code == 400
    assert response.json() == {"error": "No resume data provided. Please analyze a resume first."}


def test_match_job_rejects_too_short_job_description():
    response = client.post(
        "/api/match-job",
        json={
            "resume_text": "Some resume text here.",
            "job_description": make_job_description(19),  # one under the minimum
        },
    )
    assert response.status_code == 400
    assert response.json() == {
        "error": "Job description is too short — please provide at least 20 words."
    }


def test_match_job_rejects_too_long_job_description():
    response = client.post(
        "/api/match-job",
        json={
            "resume_text": "Some resume text here.",
            "job_description": make_job_description(5001),  # one over the maximum
        },
    )
    assert response.status_code == 400
    assert response.json() == {
        "error": "Job description is too long — please keep it under 5000 words."
    }


@patch("main.get_genai_client")
def test_match_job_gemini_failure_returns_502(mock_get_client):
    mock_client_instance = MagicMock()
    mock_client_instance.models.generate_content.side_effect = Exception(
        "503 Service Unavailable"
    )
    mock_get_client.return_value = mock_client_instance

    response = client.post(
        "/api/match-job",
        json={
            "resume_text": "Some resume text here.",
            "job_description": make_job_description(25),
        },
    )

    assert response.status_code == 502
    assert response.json() == {"error": "Job match analysis failed. Please try again."}