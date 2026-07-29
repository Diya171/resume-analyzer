import io
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

from main import app, ResumeAnalysis

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


def make_fake_gemini_response(analysis: ResumeAnalysis) -> MagicMock:
    """Build a fake object mimicking google-genai's response shape,
    i.e. it just needs a `.text` attribute containing JSON."""
    fake_response = MagicMock()
    fake_response.text = analysis.model_dump_json()
    return fake_response


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_analyze_rejects_non_pdf():
    fake_file = io.BytesIO(b"This is just plain text, not a PDF.")
    response = client.post(
        "/api/analyze",
        files={"resume": ("resume.txt", fake_file, "text/plain")},
    )
    assert response.status_code == 400
    assert response.json() == {"error": "Only PDF files are supported."}


def test_analyze_rejects_fake_pdf_extension():
    """Content-type says PDF, but the actual bytes aren't — magic byte check should catch this."""
    fake_file = io.BytesIO(b"This is not really a PDF despite the name.")
    response = client.post(
        "/api/analyze",
        files={"resume": ("resume.pdf", fake_file, "application/pdf")},
    )
    assert response.status_code == 400
    assert response.json() == {"error": "Only PDF files are supported."}


def test_analyze_rejects_empty_file():
    empty_file = io.BytesIO(b"")
    response = client.post(
        "/api/analyze",
        files={"resume": ("resume.pdf", empty_file, "application/pdf")},
    )
    assert response.status_code == 400


def test_analyze_rejects_scanned_pdf_with_no_text():
    """A PDF with no text layer at all (blank page, nothing drawn)."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.save()  # blank page, no text drawn
    buffer.seek(0)
    blank_pdf_bytes = buffer.read()

    response = client.post(
        "/api/analyze",
        files={"resume": ("resume.pdf", blank_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 422
    assert "error" in response.json()


@patch("main.get_genai_client")
def test_analyze_happy_path_with_gemini(mock_get_client):
    """Mocks the Gemini call so we never hit the real API. Verifies the
    full structured response is parsed, validated, and returned."""
    fake_analysis = ResumeAnalysis(
        candidate_summary="Experienced backend engineer with 5 years in Python and cloud infrastructure.",
        technical_skills=["Python", "FastAPI", "AWS"],
        soft_skills=["Communication", "Leadership"],
        strengths=["Strong ownership of projects", "Deep API design experience"],
        weaknesses=["Limited frontend exposure"],
        suggested_improvements=["Add quantifiable metrics to project bullet points"],
        suitable_job_roles=["Backend Engineer", "Platform Engineer"],
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
    assert "Python" in data["technical_skills"]
    assert data["candidate_summary"] == fake_analysis.candidate_summary
    mock_client_instance.models.generate_content.assert_called_once()


@patch("main.get_genai_client")
def test_analyze_gemini_api_failure_returns_502(mock_get_client):
    """Simulates a Gemini API call raising an exception (e.g. auth error,
    timeout, rate limit) — should return a generic 502, never leak details."""
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
    data = response.json()
    assert data == {"error": "Resume analysis failed. Please try again."}
    # Make sure nothing leaks into the response body
    assert "AIzaSy" not in response.text
    assert "401" not in response.text


@patch("main.get_genai_client")
def test_analyze_gemini_invalid_json_returns_502(mock_get_client):
    """Simulates Gemini returning malformed/non-conforming JSON —
    should fail Pydantic validation and return a generic 502."""
    fake_response = MagicMock()
    fake_response.text = '{"candidate_summary": "Missing all other required fields"}'

    mock_client_instance = MagicMock()
    mock_client_instance.models.generate_content.return_value = fake_response
    mock_get_client.return_value = mock_client_instance

    pdf_bytes = make_sample_pdf()
    response = client.post(
        "/api/analyze",
        files={"resume": ("resume.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 502
    assert response.json() == {"error": "Resume analysis failed. Please try again."}