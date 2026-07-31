import { useState, useRef } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import "./Results.css";

const MATCH_API_URL = "http://localhost:8000/api/match-job";
const MIN_WORDS = 20;
const MAX_WORDS = 5000;

const RING_SIZE = 160;
const RING_RADIUS = 64;
const RING_STROKE = 14;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function getScoreBand(score) {
  if (score < 50) return "score-red";
  if (score <= 75) return "score-amber";
  return "score-green";
}

function ScoreRing({ score, variant = "primary" }) {
  const clamped = Math.max(0, Math.min(100, score ?? 0));
  const offset = RING_CIRCUMFERENCE * (1 - clamped / 100);
  const band = getScoreBand(clamped);

  return (
    <div className={`score-ring-wrapper ${band} score-variant-${variant}`}>
      <svg className="score-ring" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <circle
          className="score-ring-bg"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
        />
        <circle
          className="score-ring-fg"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="score-ring-label">
        <span className="score-number">{clamped}</span>
        <span className="score-max">/ 100</span>
      </div>
    </div>
  );
}

function ChipList({ items, variant }) {
  if (!items?.length) return <p className="empty">None listed.</p>;
  return (
    <div className="chip-list">
      {items.map((item, i) => (
        <span className={`chip ${variant ? `chip-${variant}` : ""}`} key={i}>
          {item}
        </span>
      ))}
    </div>
  );
}

function BulletList({ items }) {
  if (!items?.length) return <p className="empty">None listed.</p>;
  return (
    <ul className="bullet-list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function NumberedList({ items }) {
  if (!items?.length) return <p className="empty">None listed.</p>;
  return (
    <ol className="numbered-list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

function verdictClass(verdict) {
  if (verdict === "Strong Match") return "verdict-strong";
  if (verdict === "Moderate Match") return "verdict-moderate";
  if (verdict === "Weak Match") return "verdict-weak";
  return "";
}

function JobMatchSection({ resumeText }) {
  const [isOpen, setIsOpen] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [matchResult, setMatchResult] = useState(null);

  const wordCount = jobDescription.trim()
    ? jobDescription.trim().split(/\s+/).length
    : 0;
  const isWordCountValid = wordCount >= MIN_WORDS && wordCount <= MAX_WORDS;

  async function handleGetMatch() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(MATCH_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText,
          job_description: jobDescription,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setIsLoading(false);
        return;
      }

      setMatchResult(data);
      setIsLoading(false);
    } catch (err) {
      setError("Could not reach the server. Please check your connection and try again.");
      setIsLoading(false);
    }
  }

  function handleCheckAnother() {
    setMatchResult(null);
    setJobDescription("");
    setError("");
  }

  if (!isOpen) {
    return (
      <div className="job-match-trigger">
        <button className="check-match-button" onClick={() => setIsOpen(true)}>
          Check Job Match
        </button>
      </div>
    );
  }

  return (
    <section className="card job-match-card">
      <h2 className="card-title">Check Job Match</h2>

      {error && (
        <div className="banner banner-error" role="alert">
          <span>{error}</span>
          <button className="banner-dismiss" onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      {!matchResult && (
        <>
          <textarea
            className="job-description-input"
            placeholder="Paste the job description here..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={8}
          />
          <div className="word-counter-row">
            <span
              className={`word-counter ${
                wordCount > 0 && !isWordCountValid ? "word-counter-invalid" : ""
              }`}
            >
              {wordCount} / {MAX_WORDS} words
            </span>
          </div>

          <button
            className="get-match-button"
            disabled={!isWordCountValid || isLoading}
            onClick={handleGetMatch}
          >
            {isLoading ? (
              <>
                <span className="spinner" /> Analyzing Match...
              </>
            ) : (
              "Get Match Score"
            )}
          </button>
        </>
      )}

      {matchResult && (
        <div className="match-result">
          <div className="match-score-block">
            <ScoreRing score={matchResult.match_score} variant="match" />
            <span className={`verdict-badge ${verdictClass(matchResult.verdict)}`}>
              {matchResult.verdict}
            </span>
          </div>

          <div className="two-col-grid">
            <div className="subpanel">
              <h3 className="subpanel-title">Matching Skills</h3>
              <ChipList items={matchResult.matching_skills} variant="match" />
            </div>
            <div className="subpanel">
              <h3 className="subpanel-title">Missing Skills</h3>
              <ChipList items={matchResult.missing_skills} variant="missing" />
            </div>
          </div>

          <div className="subpanel">
            <h3 className="subpanel-title">Gap Analysis</h3>
            <BulletList items={matchResult.gap_analysis} />
          </div>

          <div className="subpanel">
            <h3 className="subpanel-title">Tailoring Suggestions</h3>
            <NumberedList items={matchResult.tailoring_suggestions} />
          </div>

          <button className="check-another-button" onClick={handleCheckAnother}>
            Check Another Job
          </button>
        </div>
      )}
    </section>
  );
}

function buildPdfFilename(filename) {
  if (!filename) return "Resume_Analysis.pdf";
  const withoutExtension = filename.replace(/\.pdf$/i, "");
  const safeName = withoutExtension.replace(/[^a-zA-Z0-9_\-]/g, "_");
  return `${safeName}_Analysis.pdf`;
}

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const analysis = location.state?.analysis;
  const filename = location.state?.filename;

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const reportRef = useRef(null);

  if (!analysis) {
    return <Navigate to="/" replace />;
  }

  const {
    candidate_summary,
    technical_skills = [],
    soft_skills = [],
    strengths = [],
    weaknesses = [],
    suggested_improvements = [],
    suitable_job_roles = [],
    overall_score,
    extracted_text,
  } = analysis;

  async function handleDownloadPdf() {
    if (!reportRef.current) return;

    setIsExporting(true);
    setExportError("");

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const canvasPageHeight = (pageHeight * canvas.width) / imgWidth;

      let renderedHeight = 0;
      let isFirstPage = true;

      while (renderedHeight < canvas.height) {
        const sliceHeight = Math.min(canvasPageHeight, canvas.height - renderedHeight);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const ctx = pageCanvas.getContext("2d");
        ctx.drawImage(
          canvas,
          0,
          renderedHeight,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );

        const pageImgData = pageCanvas.toDataURL("image/png");
        const pageImgHeight = (sliceHeight * imgWidth) / canvas.width;

        if (!isFirstPage) {
          pdf.addPage();
        }
        pdf.addImage(pageImgData, "PNG", 0, 0, imgWidth, pageImgHeight);

        renderedHeight += sliceHeight;
        isFirstPage = false;
      }

      pdf.save(buildPdfFilename(filename));
    } catch (err) {
      console.error("PDF export failed:", err);
      setExportError("Could not generate the PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="results-page">
      <div className="results-container">
        <header className="results-header">
          <div>
            <h1 className="page-title">Resume Analysis</h1>
            {filename && <p className="filename">{filename}</p>}
          </div>
          <div className="header-actions">
            <button
              className="download-pdf-button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <span className="spinner spinner-dark" /> Generating...
                </>
              ) : (
                "Download PDF"
              )}
            </button>
            <button className="analyze-another-button" onClick={() => navigate("/")}>
              Analyze Another Resume
            </button>
          </div>
        </header>

        {exportError && (
          <div className="banner banner-error" role="alert">
            <span>{exportError}</span>
            <button
              className="banner-dismiss"
              onClick={() => setExportError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* Everything inside this ref is exactly what gets captured into
            the PDF — Check Job Match is deliberately rendered outside it. */}
        <div ref={reportRef} className="pdf-report">
          <section className="card score-card">
            <ScoreRing score={overall_score} />
            <p className="candidate-summary">{candidate_summary}</p>
          </section>

          <section className="card">
            <h2 className="card-title">Skills</h2>
            <div className="two-col-grid">
              <div className="subpanel">
                <h3 className="subpanel-title">Technical Skills</h3>
                <ChipList items={technical_skills} variant="skill" />
              </div>
              <div className="subpanel">
                <h3 className="subpanel-title">Soft Skills</h3>
                <ChipList items={soft_skills} variant="skill" />
              </div>
            </div>
          </section>

          <div className="two-col-grid">
            <section className="card accent-strength">
              <h2 className="card-title">Strengths</h2>
              <BulletList items={strengths} />
            </section>
            <section className="card accent-weakness">
              <h2 className="card-title">Weaknesses</h2>
              <BulletList items={weaknesses} />
            </section>
          </div>

          <div className="two-col-grid">
            <section className="card">
              <h2 className="card-title">Suitable Job Roles</h2>
              <ChipList items={suitable_job_roles} variant="role" />
            </section>
            <section className="card">
              <h2 className="card-title">Suggested Improvements</h2>
              <NumberedList items={suggested_improvements} />
            </section>
          </div>
        </div>

        <JobMatchSection resumeText={extracted_text} />
      </div>
    </div>
  );
}