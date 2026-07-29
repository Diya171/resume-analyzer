import { useLocation, useNavigate, Link } from "react-router-dom";
import "./Results.css";

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const analysis = location.state?.analysis;
  const filename = location.state?.filename;

  if (!analysis) {
    return (
      <div className="page">
        <div className="card">
          <h1>No analysis to show</h1>
          <p className="subtitle">
            It looks like you navigated here directly. Please upload a resume first.
          </p>
          <Link className="back-link" to="/">
            ← Back to upload
          </Link>
        </div>
      </div>
    );
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
  } = analysis;

  return (
    <div className="page">
      <div className="card results-card">
        <button className="back-link" onClick={() => navigate("/")}>
          ← Analyze another resume
        </button>

        <h1>Resume Analysis</h1>
        {filename && <p className="filename">{filename}</p>}

        <div className="score-block">
          <div className="score-circle">{overall_score}</div>
          <span className="score-label">Overall Score / 100</span>
        </div>

        <Section title="Summary">
          <p>{candidate_summary}</p>
        </Section>

        <Section title="Technical Skills">
          <TagList items={technical_skills} />
        </Section>

        <Section title="Soft Skills">
          <TagList items={soft_skills} />
        </Section>

        <Section title="Strengths">
          <BulletList items={strengths} />
        </Section>

        <Section title="Weaknesses">
          <BulletList items={weaknesses} />
        </Section>

        <Section title="Suggested Improvements">
          <BulletList items={suggested_improvements} />
        </Section>

        <Section title="Suitable Job Roles">
          <TagList items={suitable_job_roles} />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="section">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function TagList({ items }) {
  if (!items.length) return <p className="empty">None listed.</p>;
  return (
    <div className="tag-list">
      {items.map((item, i) => (
        <span className="tag" key={i}>
          {item}
        </span>
      ))}
    </div>
  );
}

function BulletList({ items }) {
  if (!items.length) return <p className="empty">None listed.</p>;
  return (
    <ul className="bullet-list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}