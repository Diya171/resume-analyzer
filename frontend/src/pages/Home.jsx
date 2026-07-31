import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";

const API_URL = `${import.meta.env.VITE_API_BASE_URL}/api/analyze`;

function isPdfFile(file) {
  const validType = file.type === "application/pdf";
  const validExtension = file.name.toLowerCase().endsWith(".pdf");
  return validType && validExtension;
}

/* ---- Small inline icons (no icon library, just SVG) ---- */

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15.5V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 15.5v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5c.4 2.7 1 4.6 1.9 5.6 1 1 2.9 1.6 5.6 1.9-2.7.4-4.6 1-5.6 1.9-1 1-1.6 2.9-1.9 5.6-.4-2.7-1-4.6-1.9-5.6-1-1-2.9-1.6-5.6-1.9 2.7-.4 4.6-1 5.6-1.9 1-1 1.6-2.9 1.9-5.6z" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 11.5a8 8 0 0 1-8 8 7.9 7.9 0 0 1-3.6-.85L3.5 20l1.35-5.4A8 8 0 1 1 20.5 11.5z" />
    </svg>
  );
}

function IconGauge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 18a8 8 0 0 1 16 0" />
      <path d="M12 18l3.2-4.6" />
      <circle cx="12" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6h12M9 12h12M9 18h12" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
}

function IconScale() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M5 7h14" />
      <path d="M5 7l-3 6a3 3 0 0 0 6 0z" />
      <path d="M19 7l-3 6a3 3 0 0 0 6 0z" />
    </svg>
  );
}

function IconBulb() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 18h5" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2h5c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const STEPS = [
  {
    icon: <IconUpload />,
    color: "icon-violet",
    title: "Upload",
    desc: "Drop in your resume as a PDF, up to 5MB.",
  },
  {
    icon: <IconSparkle />,
    color: "icon-coral",
    title: "AI Analysis",
    desc: "Our model reads it the way a recruiter would.",
  },
  {
    icon: <IconChat />,
    color: "icon-teal",
    title: "Get Feedback",
    desc: "See your score, gaps, and what to fix first.",
  },
];

const GET_ITEMS = [
  { icon: <IconGauge />, color: "icon-violet", label: "Overall Score" },
  { icon: <IconList />, color: "icon-coral", label: "Skills Breakdown" },
  { icon: <IconScale />, color: "icon-teal", label: "Strengths & Weaknesses" },
  { icon: <IconBulb />, color: "icon-violet", label: "Suggested Improvements" },
  { icon: <IconTarget />, color: "icon-coral", label: "Job Role Matches" },
];

export default function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationError, setValidationError] = useState("");
  const [serverError, setServerError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  function handleFile(file) {
    if (!file) return;

    if (!isPdfFile(file)) {
      setSelectedFile(null);
      setValidationError("Only PDF files are supported. Please choose a .pdf file.");
      return;
    }

    setValidationError("");
    setSelectedFile(file);
  }

  function handleInputChange(e) {
    handleFile(e.target.files?.[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDropZoneClick() {
    fileInputRef.current?.click();
  }

  function handleDropZoneKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }

  async function handleAnalyze() {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setServerError("");

    const formData = new FormData();
    formData.append("resume", selectedFile);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setServerError(data.error || "Something went wrong. Please try again.");
        setIsAnalyzing(false);
        return;
      }

      navigate("/results", {
        state: {
          analysis: data,
          filename: selectedFile.name,
        },
      });
    } catch (err) {
      setServerError("Could not reach the server. Please check your connection and try again.");
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-shape hero-shape-a" />
        <div className="hero-shape hero-shape-b" />
        <div className="hero-shape hero-shape-c" />

        <div className="hero-content">
          <span className="hero-eyebrow">Resume Analyzer</span>
          <h1 className="hero-title">
            See your resume the way a <span className="hero-title-accent">recruiter</span> does.
          </h1>
          <p className="hero-subtitle">
            Upload a PDF and get an instant score, a skills breakdown, and specific
            suggestions to make it stronger — before you hit submit.
          </p>
        </div>
      </section>

      <div className="upload-card-wrapper">
        <div className="upload-card">
          <h2>Upload your resume</h2>
          <p className="subtitle">PDF only — feedback is ready in seconds.</p>

          {serverError && (
            <div className="banner banner-error" role="alert">
              <span>{serverError}</span>
              <button
                className="banner-dismiss"
                onClick={() => setServerError("")}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          <div
            className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
            onClick={handleDropZoneClick}
            onKeyDown={handleDropZoneKeyDown}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-label="Upload resume PDF"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleInputChange}
              hidden
            />
            <p className="dropzone-text">
              Drag & drop your resume here, or <span className="dropzone-link">browse</span>
            </p>
            <p className="dropzone-hint">PDF only, up to 5MB</p>
          </div>

          {validationError && <p className="field-error">{validationError}</p>}

          {selectedFile && !validationError && (
            <p className="selected-file">Selected: {selectedFile.name}</p>
          )}

          <button
            className="analyze-button"
            disabled={!selectedFile || isAnalyzing}
            onClick={handleAnalyze}
          >
            {isAnalyzing ? (
              <>
                <span className="spinner" /> Analyzing...
              </>
            ) : (
              "Analyze Resume"
            )}
          </button>
        </div>
      </div>

      <section className="how-it-works section-container">
        <div className="section-heading">
          <span className="section-eyebrow">Three steps</span>
          <h2 className="section-title">How it works</h2>
          <p className="section-subtitle">
            No sign-up, no waiting — just an honest read on where your resume stands.
          </p>
        </div>

        <div className="steps-grid">
          {STEPS.map((step, i) => (
            <div className="step-card" key={step.title}>
              <span className={`step-icon-circle ${step.color}`}>{step.icon}</span>
              <span className="step-number">{`0${i + 1}`}</span>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="get-section section-container">
        <div className="section-heading">
          <span className="section-eyebrow">In your report</span>
          <h2 className="section-title">What you'll get</h2>
          <p className="section-subtitle">
            One upload turns into a full breakdown you can act on right away.
          </p>
        </div>

        <div className="get-grid">
          {GET_ITEMS.map((item) => (
            <div className="get-item" key={item.label}>
              <span className={`get-icon ${item.color}`}>{item.icon}</span>
              <span className="get-label">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <p>
          <strong>Resume Analyzer</strong> — feedback is AI-generated. Always use your own
          judgment before making changes.
        </p>
      </footer>
    </div>
  );
}