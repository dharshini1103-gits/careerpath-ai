import { useState } from "react";

function JobMatch() {
  const [resumeId, setResumeId] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleMatch = async () => {
    setError("");
    setResult(null);

    if (!resumeId) {
      setError("Please enter your Resume ID.");
      return;
    }

    if (!jobDescription.trim()) {
      setError("Please paste the job description.");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setError("Please login first.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `http://127.0.0.1:8000/api/job-match/match?resume_id=${resumeId}&job_description=${encodeURIComponent(
          jobDescription
        )}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Job matching failed");
      }

      setResult(data.job_match);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "auto" }}>
      <h1>CareerPath AI - Job Match</h1>

      <p>
        Compare your resume with a job description using AI.
      </p>

      {/* Resume ID */}

      <label>Resume ID</label>

      <input
        type="number"
        value={resumeId}
        onChange={(e) => setResumeId(e.target.value)}
        placeholder="Example: 2"
        style={{
          display: "block",
          width: "100%",
          padding: "12px",
          margin: "8px 0 20px",
        }}
      />

      {/* Job Description */}

      <label>Job Description</label>

      <textarea
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        placeholder="Paste the job description here..."
        rows="12"
        style={{
          display: "block",
          width: "100%",
          padding: "12px",
          margin: "8px 0 20px",
        }}
      />

      {/* Button */}

      <button
        onClick={handleMatch}
        disabled={loading}
        style={{
          padding: "12px 25px",
          cursor: "pointer",
        }}
      >
        {loading ? "Analyzing..." : "Analyze Job Match"}
      </button>

      {/* Error */}

      {error && (
        <div style={{ marginTop: "20px" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Result */}

      {result && (
        <div style={{ marginTop: "30px" }}>
          <h2>Job Match Result</h2>

          <div>
            <h3>Match Score</h3>
            <p>{result.match_score}%</p>
          </div>

          <div>
            <h3>ATS Score</h3>
            <p>{result.ats_score}%</p>
          </div>

          <div>
            <h3>Matching Skills</h3>

            <ul>
              {result.matching_skills?.map((skill, index) => (
                <li key={index}>{skill}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Missing Skills</h3>

            <ul>
              {result.missing_skills?.map((skill, index) => (
                <li key={index}>{skill}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Matching Requirements</h3>

            <ul>
              {result.matching_requirements?.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Missing Requirements</h3>

            <ul>
              {result.missing_requirements?.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Strengths</h3>

            <ul>
              {result.strengths?.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Weaknesses</h3>

            <ul>
              {result.weaknesses?.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Recommendation</h3>

            <p>{result.recommendation}</p>
          </div>

          <div>
            <h3>Priority Skills To Learn</h3>

            <ol>
              {result.priority_skills_to_learn?.map(
                (skill, index) => (
                  <li key={index}>{skill}</li>
                )
              )}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default JobMatch;