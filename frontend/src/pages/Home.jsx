import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";

const API_URL = "http://localhost:8000/api/analyze";

function isPdfFile(file) {
  const validType = file.type === "application/pdf";
  const validExtension = file.name.toLowerCase().endsWith(".pdf");
  return validType && validExtension;
}

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
      <div className="card">
        <h1>Resume Analyzer</h1>
        <p className="subtitle">Upload a PDF resume to get instant, AI-powered feedback.</p>

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
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
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
  );
}