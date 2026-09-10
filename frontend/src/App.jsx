import { useEffect, useState } from "react";
import "./index.css";

const API_URL = "http://127.0.0.1:8000";

/* =========================================================
   SAFE HELPERS
   ========================================================= */

function formatKey(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function displayValue(value) {
  if (value === null || value === undefined) return "";

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/* =========================================================
   SAFE VALUE
   ========================================================= */

function SafeValue({ value }) {
  if (value === null || value === undefined) {
    return <span className="muted">No information available.</span>;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return <span>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return <span className="muted">No information available.</span>;
    }

    return (
      <div className="safe-value-list">
        {value.map((item, index) => (
          <div className="safe-value-item" key={index}>
            <SafeValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return <SafeObject object={value} />;
  }

  return <span>{String(value)}</span>;
}

/* =========================================================
   SAFE OBJECT
   ========================================================= */

function SafeObject({ object }) {
  if (!object || typeof object !== "object") {
    return null;
  }

  return (
    <div className="safe-object">
      {Object.entries(object).map(([key, value]) => (
        <div className="safe-object-row" key={key}>
          <strong>{formatKey(key)}</strong>

          <div className="safe-object-value">
            <SafeValue value={value} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   TAG LIST
   ========================================================= */

function TagList({ items = [] }) {
  const list = safeArray(items);

  if (!list.length) {
    return <p className="muted">No information available.</p>;
  }

  return (
    <div className="tag-list">
      {list.map((item, index) => {
        let text = "";

        if (typeof item === "object" && item !== null) {
          text =
            item.name ||
            item.title ||
            item.skill ||
            item.topic ||
            item.value ||
            item.technology ||
            item.technology_name ||
            displayValue(item);
        } else {
          text = String(item);
        }

        return (
          <span className="skill-tag" key={index}>
            {text}
          </span>
        );
      })}
    </div>
  );
}

/* =========================================================
   APP
   ========================================================= */

function App() {
  /* =======================================================
     AUTH
     ======================================================= */

  const [token, setToken] = useState(
    localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      ""
  );

  const [user, setUser] = useState(null);

  /* =======================================================
     RESUME
     ======================================================= */

  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(
    localStorage.getItem("selectedResumeId") || null
  );
  const [selectedResume, setSelectedResume] = useState(null);

  const [uploading, setUploading] = useState(false);

  /* =======================================================
     AI DATA
     ======================================================= */

  const [analysis, setAnalysis] = useState(null);
  const [atsScore, setAtsScore] = useState(null);
  const [skillGap, setSkillGap] = useState(null);
  const [roadmap, setRoadmap] = useState(null);

  /* =======================================================
     JOB MATCH
     ======================================================= */

  const [jobDescription, setJobDescription] = useState("");
  const [jobMatch, setJobMatch] = useState(null);

  /* =======================================================
     INTERVIEW
     ======================================================= */

  const [interviewSession, setInterviewSession] = useState(null);
  const [interviewQuestion, setInterviewQuestion] = useState("");
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [interviewResult, setInterviewResult] = useState(null);

  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(1);

  const TOTAL_INTERVIEW_QUESTIONS = 5;

  /* =======================================================
     UI
     ======================================================= */

  const [activeSection, setActiveSection] = useState("resume");

  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /* =======================================================
     AUTH HEADERS
     ======================================================= */

  function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
  }

  /* =======================================================
     CLEAR MESSAGES
     ======================================================= */

  function clearMessages() {
    setMessage("");
    setError("");
  }

  /* =======================================================
     API REQUEST
     ======================================================= */

  async function apiRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,

        headers: {
          ...authHeaders(),
          ...(options.headers || {}),
        },
      });

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        let detail = `Request failed with status ${response.status}`;

        if (data?.detail) {
          if (Array.isArray(data.detail)) {
            detail = data.detail
              .map((item) => item?.msg || "Validation error")
              .join(", ");
          } else if (typeof data.detail === "string") {
            detail = data.detail;
          } else {
            detail = JSON.stringify(data.detail);
          }
        }

        throw new Error(detail);
      }

      return data;
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          "Cannot connect to backend. Make sure FastAPI is running on http://127.0.0.1:8000."
        );
      }

      throw err;
    }
  }

  /* =======================================================
     EXTRACT RESUME TEXT
     ======================================================= */

  function getResumeText(resume) {
    if (!resume) return "";

    return (
      resume.resume_text ||
      resume.resumeText ||
      resume.text ||
      resume.extracted_text ||
      resume.extractedText ||
      resume.content ||
      resume.parsed_text ||
      resume.parsedText ||
      ""
    );
  }

  /* =======================================================
     EXTRACT RESUME JOB DESCRIPTION
     ======================================================= */

  function getResumeJobDescription(resume) {
    if (!resume) return "";

    return (
      resume.job_description ||
      resume.jobDescription ||
      resume.target_role ||
      resume.targetRole ||
      "Generative AI Developer"
    );
  }

  /* =======================================================
     GET CURRENT RESUME
     ======================================================= */

  function getCurrentResume() {
    if (!selectedResumeId) return null;

    return (
      resumes.find(
        (resume) =>
          Number(resume.id) === Number(selectedResumeId)
      ) || selectedResume
    );
  }

  /* =======================================================
     CURRENT USER
     ======================================================= */

  async function loadUser() {
    if (!token) return;

    try {
      const data = await apiRequest(`${API_URL}/api/auth/me`);
      setUser(data);
    } catch (err) {
      console.error("User loading error:", err);
    }
  }

  /* =======================================================
     LOAD RESUMES
     ======================================================= */

  async function loadResumes() {
    if (!token) return;

    try {
      const data = await apiRequest(
        `${API_URL}/api/resume/my-resumes`
      );

      const list = Array.isArray(data)
        ? data
        : data?.resumes ||
          data?.data ||
          [];

      setResumes(list);

      if (list.length > 0) {
        setSelectedResumeId((previous) => {
          if (previous) {
            const exists = list.some(
              (resume) =>
                Number(resume.id) === Number(previous)
            );

            if (exists) return previous;
          }

          const firstId = list[0].id ?? list[0].resume_id;
          if (firstId) {
            localStorage.setItem("selectedResumeId", String(firstId));
            return firstId;
          }
          return previous;
        });
      }
    } catch (err) {
      console.error("Resume loading error:", err);
      setError(err.message);
    }
  }

  /* =======================================================
     INITIAL LOAD
     ======================================================= */

  useEffect(() => {
    if (!token) return;

    loadUser();
    loadResumes();
  }, [token]);

  /* =======================================================
     UPDATE SELECTED RESUME OBJECT
     ======================================================= */

  useEffect(() => {
    if (!selectedResumeId) {
      setSelectedResume(null);
      return;
    }

    const resume = resumes.find(
      (item) =>
        Number(item.id) === Number(selectedResumeId)
    );

    setSelectedResume(resume || null);
  }, [selectedResumeId, resumes]);

  /* =======================================================
     LOGOUT
     ======================================================= */

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");

    setToken("");
    setUser(null);

    setResumes([]);
    setSelectedResumeId(null);
    setSelectedResume(null);

    setAnalysis(null);
    setAtsScore(null);
    setSkillGap(null);
    setRoadmap(null);
    setJobMatch(null);

    resetInterview();
  }

  /* =======================================================
     RESET INTERVIEW
     ======================================================= */

  function resetInterview() {
    setInterviewSession(null);
    setInterviewQuestion("");
    setInterviewAnswer("");
    setInterviewResult(null);
    setInterviewStarted(false);
    setQuestionNumber(1);
  }

  /* =======================================================
     SELECT RESUME
     ======================================================= */

  function selectResume(id) {
    setSelectedResumeId(id);

    const resume = resumes.find(
      (item) => Number(item.id) === Number(id)
    );

    setSelectedResume(resume || null);

    /*
     * IMPORTANT:
     * Only reset frontend state.
     * Do NOT call any backend AI endpoint here.
     */

    setAnalysis(null);
    setAtsScore(null);
    setSkillGap(null);
    setRoadmap(null);
    setJobMatch(null);

    resetInterview();

    clearMessages();
  }

  /* =======================================================
     UPLOAD RESUME
     ======================================================= */

  async function handleResumeUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    clearMessages();
    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);

      const response = await fetch(
        `${API_URL}/api/resume/upload`,
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${token}`,
          },

          body: formData,
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.detail || "Failed to upload resume."
        );
      }

      setMessage("Resume uploaded successfully.");

      await loadResumes();

      const newId =
        data?.id ??
        data?.resume_id ??
        data?.resume?.id ??
        data?.resume?.resume_id;

      if (newId) {
        setSelectedResumeId(String(newId));
        localStorage.setItem("selectedResumeId", String(newId));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  /* =======================================================
     ANALYZE RESUME
     ======================================================= */

  async function analyzeResume() {
    if (!selectedResumeId) {
      setError("Please select a resume first.");
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      const data = await apiRequest(
        `${API_URL}/api/ai/analyze-resume?resume_id=${selectedResumeId}`,
        {
          method: "POST",
        }
      );

      console.log("ANALYSIS RESPONSE:", data);

      setAnalysis(
        data?.analysis ||
          data?.result ||
          data?.data ||
          data
      );

      setMessage("Resume analysis completed successfully.");
      setActiveSection("analysis");
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     ATS SCORE
     ======================================================= */
  async function getATSScore() {
  if (!selectedResumeId) {
    setError("Please select a resume first.");
    return;
  }

  clearMessages();
  setLoading(true);

  try {
    const resumeId = Number(selectedResumeId);

    if (!Number.isInteger(resumeId)) {
      throw new Error("Invalid resume ID.");
    }

    console.log("ATS REQUEST:", {
      resume_id: resumeId,
    });

    const data = await apiRequest(
      `${API_URL}/api/ai/ats-score`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resume_id: resumeId,
        }),
      }
    );

    console.log("ATS RESPONSE:", data);

    setAtsScore(
      data?.ats_score_result ||
        data?.ats_score ||
        data?.result ||
        data?.data ||
        data
    );

    setMessage("ATS score generated successfully.");
    setActiveSection("ats");
  } catch (err) {
    console.error("ATS error:", err);
    setError(`ATS Score: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

  /* =======================================================
     SKILL GAP
     ======================================================= */

  async function getSkillGap() {
    if (!selectedResumeId) {
      setError("Please select a resume first.");
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      /*
       * IMPORTANT:
       * Skill gap is an independent endpoint.
       * Do not use analysis response here.
       */

      const data = await apiRequest(
        `${API_URL}/api/ai/skill-gap?resume_id=${selectedResumeId}`,
        {
          method: "POST",
        }
      );

      console.log("SKILL GAP RESPONSE:", data);

      const result =
        data?.skill_gap ||
        data?.result ||
        data?.analysis ||
        data?.data ||
        data;

      setSkillGap(result);

      setMessage(
        "Skill gap analysis completed successfully."
      );

      setActiveSection("analysis");
    } catch (err) {
      console.error("Skill gap error:", err);
      setError(`Skill Gap: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     ROADMAP
     ======================================================= */

  async function generateRoadmap() {
    if (!selectedResumeId) {
      setError("Please select a resume first.");
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      const targetRole = "gen ai";

      const data = await apiRequest(
        `${API_URL}/api/ai/roadmap?resume_id=${selectedResumeId}&target_role=${encodeURIComponent(
          targetRole
        )}`,
        {
          method: "POST",
        }
      );

      console.log("ROADMAP RESPONSE:", data);

      const result =
        data?.roadmap ||
        data?.result ||
        data?.analysis ||
        data?.data ||
        data;

      setRoadmap(result);

      setMessage("Career roadmap generated successfully.");

      setActiveSection("roadmap");
    } catch (err) {
      console.error("Roadmap error:", err);
      setError(`Roadmap: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     JOB MATCH
     ======================================================= */

  async function matchJob() {
    if (!selectedResumeId) {
      setError("Please select a resume first.");
      return;
    }

    if (!jobDescription.trim()) {
      setError("Please enter a job description.");
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      const url =
        `${API_URL}/api/job-match/match` +
        `?resume_id=${selectedResumeId}` +
        `&job_description=${encodeURIComponent(
          jobDescription
        )}`;

      const data = await apiRequest(url, {
        method: "POST",
      });

      console.log("JOB MATCH RESPONSE:", data);

      setJobMatch(data);

      setMessage(
        "Job match analysis completed successfully."
      );

      setActiveSection("jobmatch");
    } catch (err) {
      console.error("Job match error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     START AI INTERVIEW
     ======================================================= */

  async function startInterview() {
  if (!selectedResumeId) {
    setError("Please select a resume first.");
    return;
  }

  clearMessages();
  setInterviewLoading(true);

  try {
    let resume = getCurrentResume();

    console.log("SELECTED RESUME:", resume);
    console.log("SELECTED RESUME ID:", selectedResumeId);

    /*
     * Get resume text from currently loaded resume
     */
    let resumeText = getResumeText(resume);

    /*
     * If /my-resumes only returned metadata,
     * get the selected resume details.
     */
    if (!resumeText) {
      try {
        const detail = await apiRequest(
          `${API_URL}/api/resume/${selectedResumeId}`
        );

        console.log("RESUME DETAIL RESPONSE:", detail);

        const detailedResume =
          detail?.resume ||
          detail?.data ||
          detail;

        if (
          detailedResume &&
          typeof detailedResume === "object"
        ) {
          resume = {
            ...(resume || {}),
            ...detailedResume,
          };

          resumeText = getResumeText(resume);
        }
      } catch (detailError) {
        console.warn(
          "Resume detail endpoint failed:",
          detailError.message
        );
      }
    }

    /*
     * Resume text is required by interview API
     */
    if (!resumeText) {
      throw new Error(
        "The selected resume text could not be loaded. Please upload the resume again and refresh the page."
      );
    }

    /*
     * Job description
     */
    const jobDescriptionForInterview =
      jobDescription.trim() ||
      getResumeJobDescription(resume) ||
      "Generative AI Developer";

    console.log("INTERVIEW REQUEST:", {
      job_description: jobDescriptionForInterview,
      resume_text_length: resumeText.length,
    });

    /*
     * Start AI Interview
     */
    const data = await apiRequest(
      `${API_URL}/api/ai/interview/start`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_description: jobDescriptionForInterview,
          resume_text: resumeText,
        }),
      }
    );

    console.log("INTERVIEW START RESPONSE:", data);

    /*
     * Save interview session
     */
    setInterviewSession(data);

    /*
     * Get first question
     */
    const question =
      data?.question ||
      data?.first_question ||
      data?.current_question ||
      data?.next_question ||
      data?.data?.question ||
      data?.data?.first_question ||
      "";

    if (!question) {
      console.error(
        "Interview response does not contain a question:",
        data
      );

      throw new Error(
        "Interview started but the backend did not return a question."
      );
    }

    setInterviewQuestion(
      typeof question === "string"
        ? question
        : displayValue(question)
    );

    setInterviewAnswer("");
    setInterviewResult(null);
    setInterviewStarted(true);
    setQuestionNumber(1);

    setMessage("AI interview started successfully.");
    setActiveSection("interview");
  } catch (err) {
    console.error("Start interview error:", err);

    setError(
      `AI Interview: ${
        err?.message || "Unable to start interview."
      }`
    );
  } finally {
    setInterviewLoading(false);
  }
}

  /* =======================================================
     SESSION ID
     ======================================================= */

  function getInterviewSessionId() {
    return (
      interviewSession?.session_id ||
      interviewSession?.id ||
      interviewSession?.session?.id ||
      interviewSession?.data?.session_id ||
      interviewSession?.data?.id ||
      null
    );
  }

  /* =======================================================
     EVALUATE ANSWER
     ======================================================= */

  async function evaluateAnswer() {
    if (!interviewAnswer.trim()) {
      setError("Please enter your answer.");
      return;
    }

    const sessionId = getInterviewSessionId();

    if (!sessionId) {
      setError("Interview session ID is missing.");
      return;
    }

    clearMessages();
    setInterviewLoading(true);

    try {
      const data = await apiRequest(
        `${API_URL}/api/ai/interview/evaluate`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            session_id: sessionId,
            question: interviewQuestion,
            answer: interviewAnswer,
          }),
        }
      );

      console.log("INTERVIEW EVALUATION:", data);

      setInterviewResult(
        data?.evaluation ||
          data?.result ||
          data
      );

      setMessage("Answer evaluated successfully.");
    } catch (err) {
      console.error("Evaluate answer error:", err);
      setError(`Interview Evaluation: ${err.message}`);
    } finally {
      setInterviewLoading(false);
    }
  }

  /* =======================================================
     NEXT QUESTION
     ======================================================= */

  async function getNextQuestion() {
    const sessionId = getInterviewSessionId();

    if (!sessionId) {
      setError("Interview session is missing.");
      return;
    }

    clearMessages();
    setInterviewLoading(true);

    try {
      const data = await apiRequest(
        `${API_URL}/api/ai/interview/next-question`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            session_id: sessionId,
          }),
        }
      );

      console.log("NEXT QUESTION RESPONSE:", data);

      const nextQuestion =
        data?.question ||
        data?.next_question ||
        data?.current_question ||
        data?.data?.question ||
        "";

      if (!nextQuestion) {
        throw new Error(
          "No next question was returned by the backend."
        );
      }

      setInterviewQuestion(
        typeof nextQuestion === "string"
          ? nextQuestion
          : displayValue(nextQuestion)
      );

      setInterviewAnswer("");
      setInterviewResult(null);

      setQuestionNumber((previous) => previous + 1);

      setMessage("Next interview question generated.");
    } catch (err) {
      console.error("Next question error:", err);
      setError(`Next Question: ${err.message}`);
    } finally {
      setInterviewLoading(false);
    }
  }

  /* =======================================================
     FINAL INTERVIEW REPORT
     ======================================================= */

  async function getFinalInterviewReport() {
    const sessionId = getInterviewSessionId();

    if (!sessionId) {
      setError("Interview session is missing.");
      return;
    }

    clearMessages();
    setInterviewLoading(true);

    try {
      const data = await apiRequest(
        `${API_URL}/api/ai/interview/final-report`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            session_id: sessionId,
          }),
        }
      );

      console.log("FINAL INTERVIEW REPORT:", data);

      setInterviewResult(
        data?.report ||
          data?.final_report ||
          data?.result ||
          data
      );

      setMessage("Final interview report generated.");
    } catch (err) {
      console.error("Final report error:", err);
      setError(`Final Interview Report: ${err.message}`);
    } finally {
      setInterviewLoading(false);
    }
  }

  /* =======================================================
     RENDER ATS
     ======================================================= */

  function renderATS() {
    if (!atsScore) return null;

    const atsData =
      atsScore?.ats_score_result &&
      typeof atsScore.ats_score_result === "object"
        ? atsScore.ats_score_result
        : atsScore?.result &&
          typeof atsScore.result === "object"
        ? atsScore.result
        : atsScore?.data &&
          typeof atsScore.data === "object"
        ? atsScore.data
        : atsScore;

    const score =
      atsData?.ats_score ??
      atsData?.score ??
      atsData?.atsScore ??
      "--";

    return (
      <section className="result-card">
        <h2>ATS Resume Score</h2>

        <div className="ats-score">
          <div className="score-circle">
            {score !== undefined ? score : "--"}
          </div>

          <div>
            <h3>ATS Compatibility</h3>

            <p>
              Your resume has been analyzed for ATS
              compatibility, keywords and resume structure.
            </p>
          </div>
        </div>

        {atsData?.strengths && (
          <div className="result-section">
            <h3>Strengths</h3>
            <TagList items={atsData.strengths} />
          </div>
        )}

        {atsData?.weaknesses && (
          <div className="result-section">
            <h3>Areas to Improve</h3>
            <TagList items={atsData.weaknesses} />
          </div>
        )}

        {atsData?.recommendations && (
          <div className="result-section">
            <h3>Recommendations</h3>

            <ul className="bullet-list">
              {safeArray(atsData.recommendations).map(
                (item, index) => (
                  <li key={index}>
                    <SafeValue value={item} />
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        {!atsData?.strengths &&
          !atsData?.weaknesses &&
          !atsData?.recommendations && (
            <SafeObject object={atsData} />
          )}
      </section>
    );
  }

  /* =======================================================
     RENDER SKILL GAP
     ======================================================= */

  function renderSkillGap() {
    if (!skillGap) return null;

    const data =
      skillGap?.skill_gap ||
      skillGap?.result ||
      skillGap?.analysis ||
      skillGap;

    const currentSkills = safeArray(
      data?.current_skills ||
        data?.currentSkills ||
        data?.existing_skills ||
        data?.skills_you_have
    );

    const missingSkills = safeArray(
      data?.missing_skills ||
        data?.missingSkills ||
        data?.skills_to_learn ||
        data?.skill_gaps ||
        data?.skills_missing
    );

    const priority =
      data?.priority ||
      data?.priorities ||
      data?.priority_skills ||
      {};

    const high = safeArray(
      priority?.high ||
        priority?.High ||
        data?.high_priority ||
        data?.high_priority_skills
    );

    const medium = safeArray(
      priority?.medium ||
        priority?.Medium ||
        data?.medium_priority ||
        data?.medium_priority_skills
    );

    const low = safeArray(
      priority?.low ||
        priority?.Low ||
        data?.low_priority ||
        data?.low_priority_skills
    );

    const learningOrder = safeArray(
      data?.learning_order ||
        data?.learningOrder ||
        data?.recommended_learning_order ||
        data?.learning_path
    );

    return (
      <section className="result-card skill-gap-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              AI Skill Intelligence
            </span>

            <h2>Skill Gap Analysis</h2>

            <p>
              Skills you already have and skills you
              should learn next.
            </p>
          </div>
        </div>

        <div className="result-section">
          <h3>Current Skills</h3>
          <TagList items={currentSkills} />
        </div>

        <div className="result-section">
          <h3>Missing Skills</h3>
          <TagList items={missingSkills} />
        </div>

        <div className="priority-grid">
          <div className="priority-card high">
            <div className="priority-header">
              <span className="priority-dot"></span>
              <h3>High Priority</h3>
            </div>

            {high.length ? (
              <ul>
                {high.map((item, index) => (
                  <li key={index}>
                    <SafeValue value={item} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No high priority skills.
              </p>
            )}
          </div>

          <div className="priority-card medium">
            <div className="priority-header">
              <span className="priority-dot"></span>
              <h3>Medium Priority</h3>
            </div>

            {medium.length ? (
              <ul>
                {medium.map((item, index) => (
                  <li key={index}>
                    <SafeValue value={item} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No medium priority skills.
              </p>
            )}
          </div>

          <div className="priority-card low">
            <div className="priority-header">
              <span className="priority-dot"></span>
              <h3>Low Priority</h3>
            </div>

            {low.length ? (
              <ul>
                {low.map((item, index) => (
                  <li key={index}>
                    <SafeValue value={item} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No low priority skills.
              </p>
            )}
          </div>
        </div>

        <div className="result-section">
          <h3>Recommended Learning Order</h3>

          <div className="learning-order">
            {learningOrder.length ? (
              learningOrder.map((item, index) => (
                <div className="learning-item" key={index}>
                  <div className="learning-number">
                    {index + 1}
                  </div>

                  <div className="learning-content">
                    {typeof item === "object" &&
                    item !== null ? (
                      <>
                        <strong>
                          {item.title ||
                            item.skill ||
                            item.name ||
                            item.topic ||
                            "Learning Topic"}
                        </strong>

                        {item.description && (
                          <p>
                            <SafeValue
                              value={item.description}
                            />
                          </p>
                        )}

                        {item.reason && (
                          <p>
                            <SafeValue value={item.reason} />
                          </p>
                        )}
                      </>
                    ) : (
                      <strong>{String(item)}</strong>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">
                No learning order available.
              </p>
            )}
          </div>
        </div>

        {data?.summary && (
          <div className="result-section">
            <h3>Summary</h3>
            <SafeValue value={data.summary} />
          </div>
        )}

        {data?.recommendation && (
          <div className="recommendation-box">
            <h3>Recommendation</h3>
            <SafeValue value={data.recommendation} />
          </div>
        )}

        {!currentSkills.length &&
          !missingSkills.length &&
          !high.length &&
          !medium.length &&
          !low.length &&
          !learningOrder.length && (
            <div className="result-section">
              <SafeObject object={data} />
            </div>
          )}
      </section>
    );
  }

  /* =======================================================
     ROADMAP PHASE
     ======================================================= */

  function RoadmapPhase({ phase, index }) {
    if (!phase || typeof phase !== "object") {
      return (
        <div className="roadmap-phase">
          <div className="phase-number">{index + 1}</div>

          <div className="phase-body">
            <SafeValue value={phase} />
          </div>
        </div>
      );
    }

    const phaseNumber =
      phase?.phase ||
      phase?.phase_number ||
      phase?.number ||
      index + 1;

    const title =
      phase?.title ||
      phase?.name ||
      phase?.phase_title ||
      `Phase ${phaseNumber}`;

    const duration =
      phase?.duration ||
      phase?.time ||
      phase?.timeline ||
      phase?.estimated_duration ||
      "";

    const skills = safeArray(
      phase?.skills_to_learn ||
        phase?.skills ||
        phase?.technologies
    );

    const topics = safeArray(
      phase?.topics ||
        phase?.learning_topics
    );

    const projects = safeArray(
      phase?.projects ||
        phase?.recommended_projects
    );

    const project = phase?.project || "";

    const goal =
      phase?.goal ||
      phase?.objective ||
      "";

    return (
      <div className="roadmap-phase">
        <div className="phase-number">
          {phaseNumber}
        </div>

        <div className="phase-body">
          <div className="phase-header">
            <div>
              <h3>{String(title)}</h3>

              {duration && (
                <span className="duration">
                  <SafeValue value={duration} />
                </span>
              )}
            </div>
          </div>

          {skills.length > 0 && (
            <div className="phase-section">
              <h4>Skills To Learn</h4>
              <TagList items={skills} />
            </div>
          )}

          {topics.length > 0 && (
            <div className="phase-section">
              <h4>Topics</h4>

              <ul className="bullet-list">
                {topics.map((topic, topicIndex) => (
                  <li key={topicIndex}>
                    <SafeValue value={topic} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {project && (
            <div className="project-box">
              <h4>Project</h4>
              <SafeValue value={project} />
            </div>
          )}

          {projects.length > 0 && (
            <div className="project-box">
              <h4>Projects</h4>

              <ul className="bullet-list">
                {projects.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <SafeValue value={item} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {goal && (
            <div className="goal-box">
              <h4>Goal</h4>
              <SafeValue value={goal} />
            </div>
          )}
        </div>
      </div>
    );
  }

  /* =======================================================
     ROADMAP
     ======================================================= */

  function renderRoadmap() {
    if (!roadmap) return null;

    const data =
      roadmap?.roadmap &&
      typeof roadmap.roadmap === "object" &&
      !Array.isArray(roadmap.roadmap)
        ? roadmap.roadmap
        : roadmap?.result &&
          typeof roadmap.result === "object"
        ? roadmap.result
        : roadmap;

    const targetRole =
      data?.target_role ||
      data?.targetRole ||
      data?.role ||
      "Target Career";

    const currentLevel =
      data?.current_level ||
      data?.currentLevel ||
      data?.level ||
      "Not specified";

    const duration =
      data?.estimated_total_duration ||
      data?.estimated_duration ||
      data?.duration ||
      "";

    const currentSkills = safeArray(
      data?.current_skills ||
        data?.currentSkills ||
        data?.existing_skills
    );

    const skillGaps = safeArray(
      data?.skill_gaps ||
        data?.skills_to_learn ||
        data?.missing_skills ||
        data?.skillsToLearn
    );

    let phases =
      data?.phases ||
      data?.roadmap_phases ||
      data?.learning_phases ||
      [];

    if (Array.isArray(data)) {
      phases = data;
    }

    phases = safeArray(phases);

    const recommendedProjects = safeArray(
      data?.recommended_projects ||
        data?.projects
    );

    const interviewTopics = safeArray(
      data?.interview_topics ||
        data?.interviewTopics
    );

    const jobReadySkills = safeArray(
      data?.job_ready_skills ||
        data?.jobReadySkills ||
        data?.job_ready
    );

    return (
      <section className="result-card roadmap-card">
        <div className="roadmap-hero">
          <div>
            <span className="eyebrow">
              Personalized Career Roadmap
            </span>

            <h2>
              <SafeValue value={targetRole} />
            </h2>

            <div className="roadmap-meta">
              <span>
                Level:{" "}
                <strong>
                  <SafeValue value={currentLevel} />
                </strong>
              </span>

              {duration && (
                <span>
                  Duration:{" "}
                  <strong>
                    <SafeValue value={duration} />
                  </strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {data?.career_summary && (
          <div className="result-section">
            <h3>Career Summary</h3>

            <div className="summary-text">
              <SafeValue value={data.career_summary} />
            </div>
          </div>
        )}

        {currentSkills.length > 0 && (
          <div className="result-section">
            <h3>Current Skills</h3>
            <TagList items={currentSkills} />
          </div>
        )}

        {skillGaps.length > 0 && (
          <div className="result-section">
            <h3>Skills To Learn</h3>
            <TagList items={skillGaps} />
          </div>
        )}

        {phases.length > 0 && (
          <div className="result-section">
            <h3>Learning Roadmap</h3>

            <div className="roadmap-timeline">
              {phases.map((phase, index) => (
                <RoadmapPhase
                  key={index}
                  phase={phase}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {recommendedProjects.length > 0 && (
          <div className="result-section">
            <h3>Recommended Projects</h3>

            <div className="project-grid">
              {recommendedProjects.map(
                (project, index) => (
                  <div
                    className="project-card"
                    key={index}
                  >
                    <div className="project-icon">
                      {index + 1}
                    </div>

                    <div>
                      <SafeValue value={project} />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {interviewTopics.length > 0 && (
          <div className="result-section">
            <h3>Interview Topics</h3>

            <ul className="bullet-list">
              {interviewTopics.map(
                (topic, index) => (
                  <li key={index}>
                    <SafeValue value={topic} />
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        {jobReadySkills.length > 0 && (
          <div className="result-section">
            <h3>Job Ready Skills</h3>
            <TagList items={jobReadySkills} />
          </div>
        )}

        {data?.final_recommendation && (
          <div className="recommendation-box">
            <h3>Final Recommendation</h3>

            <SafeValue
              value={data.final_recommendation}
            />
          </div>
        )}

        {!currentSkills.length &&
          !skillGaps.length &&
          !phases.length &&
          !recommendedProjects.length &&
          !interviewTopics.length &&
          !jobReadySkills.length &&
          !data?.career_summary &&
          !data?.final_recommendation && (
            <div className="result-section">
              <SafeObject object={data} />
            </div>
          )}
      </section>
    );
  }

  /* =======================================================
     JOB MATCH
     ======================================================= */

  function renderJobMatch() {
    if (!jobMatch) return null;

    return (
      <section className="result-card">
        <h2>Job Match Result</h2>

        {Object.entries(jobMatch).map(
          ([key, value]) => {
            if (
              key === "message" ||
              key === "resume_id"
            ) {
              return null;
            }

            return (
              <div
                className="result-section"
                key={key}
              >
                <h3>{formatKey(key)}</h3>
                <SafeValue value={value} />
              </div>
            );
          }
        )}
      </section>
    );
  }

  /* =======================================================
     FORMATTED RESUME ANALYSIS
     ======================================================= */

  function cleanAnalysisText(text) {
    return String(text || "")
      .replace(/\r/g, "")
      .replace(/```(?:markdown|text)?/gi, "")
      .replace(/```/g, "")
      .replace(/\s*---+\s*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function renderInlineText(text) {
    const value = String(text || "");
    const parts = value.split(/(\*\*[^*]+\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={index}>{part}</span>;
    });
  }

  function renderAnalysisText(text) {
    const cleaned = cleanAnalysisText(text);

    if (!cleaned) {
      return (
        <p className="muted">
          No analysis content available.
        </p>
      );
    }

    const sections = [];
    const headingRegex =
      /(?:^|\n)\s*###?\s*(?:\d+\.\s*)?(.+?)(?=\n|$)/g;

    let matches = [...cleaned.matchAll(headingRegex)];

    if (!matches.length) {
      // Gemini sometimes returns "**Technical Skills:**" instead of ### headings.
      const boldHeadingRegex =
        /(?:^|\n)\s*\*\*([^*\n]+)\*\*\s*:?\s*/g;

      matches = [...cleaned.matchAll(boldHeadingRegex)];
    }

    if (!matches.length) {
      return (
        <div className="analysis-fallback-text">
          {cleaned.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index}>
              {renderInlineText(paragraph.trim())}
            </p>
          ))}
        </div>
      );
    }

    const firstMatchStart = matches[0].index ?? 0;
    const intro = cleaned.slice(0, firstMatchStart).trim();

    if (intro) {
      sections.push({
        title: "Overview",
        content: intro,
      });
    }

    matches.forEach((match, index) => {
      const title = String(match[1] || "")
        .replace(/\*\*/g, "")
        .replace(/:$/, "")
        .trim();

      const start = (match.index ?? 0) + match[0].length;
      const end =
        index + 1 < matches.length
          ? matches[index + 1].index ?? cleaned.length
          : cleaned.length;

      const content = cleaned
        .slice(start, end)
        .replace(/^[:\-\s]+/, "")
        .trim();

      if (title && content) {
        sections.push({ title, content });
      }
    });

    return (
      <div className="analysis-sections">
        {sections.map((section, index) => (
          <article className="analysis-section" key={`${section.title}-${index}`}>
            <div className="analysis-section-number">
              {String(index + 1).padStart(2, "0")}
            </div>

            <div className="analysis-section-body">
              <h3>{section.title}</h3>

              <div className="analysis-section-content">
                {section.content.split(/\n+/).map((line, lineIndex) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;

                  if (/^[-*•]\s+/.test(trimmed)) {
                    return (
                      <div className="analysis-bullet" key={lineIndex}>
                        <span>•</span>
                        <span>
                          {renderInlineText(
                            trimmed.replace(/^[-*•]\s+/, "")
                          )}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <p key={lineIndex}>
                      {renderInlineText(trimmed)}
                    </p>
                  );
                })}
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  }

  /* =======================================================
     ANALYSIS
     ======================================================= */

  function renderAnalysis() {
    if (!analysis) return null;

    const actualAnalysis =
      analysis?.analysis ||
      analysis?.result ||
      analysis;

    return (
      <section className="result-card analysis-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              AI Career Intelligence
            </span>
            <h2>Resume Analysis</h2>
            <p>
              A structured view of the insights generated from your resume.
            </p>
          </div>
        </div>

        {typeof actualAnalysis === "string" ? (
          renderAnalysisText(actualAnalysis)
        ) : (
          <SafeObject object={actualAnalysis} />
        )}
      </section>
    );
  }

  /* =======================================================
     INTERVIEW RESULT
     ======================================================= */

  function renderInterviewResult() {
    if (!interviewResult) return null;

    return (
      <div className="interview-result">
        <div className="result-section">
          <h3>AI Evaluation</h3>

          <SafeValue value={interviewResult} />
        </div>
      </div>
    );
  }

  /* =======================================================
     INTERVIEW UI
     ======================================================= */

  function renderInterview() {
    return (
      <section className="result-card interview-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              AI Career Intelligence
            </span>

            <h2>AI Interview</h2>

            <p>
              Practice a personalized AI-powered
              interview based on your resume.
            </p>
          </div>
        </div>

        {!interviewStarted && (
          <div className="interview-start-card">
            <div className="interview-icon">
              AI
            </div>

            <h3>Ready for your AI interview?</h3>

            <p>
              The interview will analyze your resume
              and generate questions based on your
              skills, projects and experience.
            </p>

            <div className="interview-info-grid">
              <div>
                <strong>5</strong>
                <span>Questions</span>
              </div>

              <div>
                <strong>AI</strong>
                <span>Evaluation</span>
              </div>

              <div>
                <strong>Resume</strong>
                <span>Based</span>
              </div>
            </div>

            <button
              className="primary-button interview-start-button"
              onClick={startInterview}
              disabled={
                interviewLoading ||
                !selectedResumeId
              }
            >
              {interviewLoading
                ? "Starting Interview..."
                : "Start AI Interview"}
            </button>

            {!selectedResumeId && (
              <p className="muted">
                Please select a resume before starting.
              </p>
            )}
          </div>
        )}

        {interviewStarted && (
          <>
            <div className="interview-progress">
              <div className="progress-top">
                <span>
                  Question {questionNumber} of{" "}
                  {TOTAL_INTERVIEW_QUESTIONS}
                </span>

                <span>
                  {Math.min(
                    Math.round(
                      (questionNumber /
                        TOTAL_INTERVIEW_QUESTIONS) *
                        100
                    ),
                    100
                  )}
                  %
                </span>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(
                      (questionNumber /
                        TOTAL_INTERVIEW_QUESTIONS) *
                        100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {interviewQuestion && (
              <div className="question-box">
                <span className="eyebrow">
                  Question {questionNumber}
                </span>

                <h3>{interviewQuestion}</h3>

                <label className="input-label">
                  Your Answer
                </label>

                <textarea
                  className="interview-answer"
                  value={interviewAnswer}
                  onChange={(e) =>
                    setInterviewAnswer(
                      e.target.value
                    )
                  }
                  placeholder="Type your answer here..."
                  rows={8}
                  disabled={interviewLoading}
                />

                <div className="interview-actions">
                  <button
                    className="primary-button"
                    onClick={evaluateAnswer}
                    disabled={
                      interviewLoading ||
                      !interviewAnswer.trim()
                    }
                  >
                    {interviewLoading
                      ? "Evaluating..."
                      : "Submit Answer"}
                  </button>

                  {interviewResult &&
                    questionNumber <
                      TOTAL_INTERVIEW_QUESTIONS && (
                      <button
                        className="secondary-button"
                        onClick={getNextQuestion}
                        disabled={
                          interviewLoading
                        }
                      >
                        Next Question →
                      </button>
                    )}

                  {interviewResult &&
                    questionNumber >=
                      TOTAL_INTERVIEW_QUESTIONS && (
                      <button
                        className="secondary-button"
                        onClick={
                          getFinalInterviewReport
                        }
                        disabled={
                          interviewLoading
                        }
                      >
                        Generate Final Report
                      </button>
                    )}
                </div>
              </div>
            )}

            {renderInterviewResult()}

            <div className="interview-footer">
              <button
                className="secondary-button"
                onClick={resetInterview}
                disabled={interviewLoading}
              >
                Restart Interview
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  /* =======================================================
     NOT LOGGED IN
     ======================================================= */

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="logo-mark">
            CP
          </div>

          <h1>CareerPath AI</h1>

          <p>
            Please login to access your career
            intelligence dashboard.
          </p>

          <p className="muted">
            Your authentication token is missing.
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     MAIN UI
     ======================================================= */

  return (
    <div className="app">
      {/* HEADER */}

      <header className="topbar">
        <div className="brand">
          <div className="logo-mark">
            CP
          </div>

          <div>
            <h1>CareerPath AI</h1>

            <span>
              Career Intelligence Dashboard
            </span>
          </div>
        </div>

        <div className="user-area">
          <span>
            {user?.email ||
              user?.username ||
              "User"}
          </span>

          <button
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* ALERTS */}

      {(message || error) && (
        <div className="alerts">
          {message && (
            <div className="success-alert">
              <span>{message}</span>

              <button
                onClick={() => setMessage("")}
              >
                ×
              </button>
            </div>
          )}

          {error && (
            <div className="error-alert">
              <span>{error}</span>

              <button
                onClick={() => setError("")}
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      {/* DASHBOARD */}

      <main className="dashboard">
        {/* SIDEBAR */}

        <aside className="sidebar">
          <button
            className={
              activeSection === "resume"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() =>
              setActiveSection("resume")
            }
          >
            Resume
          </button>

          <button
            className={
              activeSection === "analysis"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() =>
              setActiveSection("analysis")
            }
          >
            AI Analysis
          </button>

          <button
            className={
              activeSection === "roadmap"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() =>
              setActiveSection("roadmap")
            }
          >
            Career Roadmap
          </button>

          <button
            className={
              activeSection === "skills"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() =>
              setActiveSection("skills")
            }
          >
            Skill Gap
          </button>

          <button
            className={
              activeSection === "jobmatch"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() =>
              setActiveSection("jobmatch")
            }
          >
            Job Match
          </button>

          <button
            className={
              activeSection === "ats"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() =>
              setActiveSection("ats")
            }
          >
            ATS Score
          </button>

          <button
            className={
              activeSection === "interview"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() =>
              setActiveSection("interview")
            }
          >
            AI Interview
          </button>
        </aside>

        {/* CONTENT */}

        <div className="content">
          {/* =================================================
              RESUME
              ================================================= */}

          {activeSection === "resume" && (
            <>
              <section className="page-heading">
                <span className="eyebrow">
                  Resume Management
                </span>

                <h2>Resume</h2>

                <p>
                  Upload your resume and select the
                  resume you want to analyze.
                </p>
              </section>

              <section className="result-card upload-card">
                <label className="upload-button">
                  {uploading
                    ? "Uploading..."
                    : "Upload Resume"}

                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={
                      handleResumeUpload
                    }
                    disabled={uploading}
                    hidden
                  />
                </label>
              </section>

              <section className="result-card">
                <div className="section-heading">
                  <div>
                    <h2>Your Resumes</h2>

                    <p>
                      Select a resume to continue.
                    </p>
                  </div>
                </div>

                {resumes.length === 0 ? (
                  <p className="muted">
                    No resumes uploaded yet.
                  </p>
                ) : (
                  <div className="resume-list">
                    {resumes.map((resume) => {
                      const id = resume.id;

                      const filename =
                        resume.filename ||
                        resume.file_name ||
                        resume.name ||
                        "Resume";

                      const selected =
                        Number(
                          selectedResumeId
                        ) === Number(id);

                      return (
                        <button
                          key={id}
                          className={
                            selected
                              ? "resume-item selected"
                              : "resume-item"
                          }
                          onClick={() =>
                            selectResume(id)
                          }
                        >
                          <div className="resume-icon">
                            PDF
                          </div>

                          <div className="resume-info">
                            <strong>
                              {filename}
                            </strong>

                            <span>
                              ID: {id}
                            </span>
                          </div>

                          {selected && (
                            <span className="selected-badge">
                              Selected
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {/* =================================================
              AI ANALYSIS
              ================================================= */}

          {activeSection === "analysis" && (
            <>
              <section className="page-heading">
                <span className="eyebrow">
                  AI Career Intelligence
                </span>

                <h2>AI Career Analysis</h2>

                <p>
                  Selected Resume ID:{" "}
                  <strong>
                    {selectedResumeId || "--"}
                  </strong>
                </p>
              </section>

              <section className="action-card">
                <button
                  className="primary-button"
                  onClick={analyzeResume}
                  disabled={
                    loading ||
                    !selectedResumeId
                  }
                >
                  Analyze Resume
                </button>

                <button
                  className="secondary-button"
                  onClick={getATSScore}
                  disabled={
                    loading ||
                    !selectedResumeId
                  }
                >
                  ATS Score
                </button>

                <button
                  className="secondary-button"
                  onClick={getSkillGap}
                  disabled={
                    loading ||
                    !selectedResumeId
                  }
                >
                  Skill Gap
                </button>

                <button
                  className="secondary-button"
                  onClick={generateRoadmap}
                  disabled={
                    loading ||
                    !selectedResumeId
                  }
                >
                  Generate Roadmap
                </button>
              </section>

              {loading && (
                <div className="loading-card">
                  <div className="spinner"></div>

                  <p>
                    AI is processing your request...
                  </p>
                </div>
              )}

              {renderAnalysis()}
              {renderATS()}
              {renderSkillGap()}
            </>
          )}

          {/* =================================================
              ATS
              ================================================= */}
          {activeSection === "ats" && (
            <>
              <section className="page-heading">
                <span className="eyebrow">Resume Intelligence</span>
                <h2>ATS Score</h2>
                <p>
                  Check how well your selected resume performs for Applicant Tracking Systems.
                </p>
              </section>

              <section className="action-card">
                <button
                  className="primary-button"
                  onClick={getATSScore}
                  disabled={loading || !selectedResumeId}
                >
                  {loading ? "Analyzing..." : "Calculate ATS Score"}
                </button>
              </section>

              {renderATS()}
            </>
          )}

          {/* =================================================
              SKILL GAP
              ================================================= */}
          {activeSection === "skills" && (
            <>
              <section className="page-heading">
                <span className="eyebrow">AI Skill Intelligence</span>
                <h2>Skill Gap Analysis</h2>
                <p>
                  See what you already know and what to learn next.
                </p>
              </section>

              <section className="action-card">
                <button
                  className="primary-button"
                  onClick={getSkillGap}
                  disabled={loading || !selectedResumeId}
                >
                  {loading ? "Analyzing..." : "Analyze Skill Gap"}
                </button>
              </section>

              {renderSkillGap()}
            </>
          )}

          {/* =================================================
              ROADMAP
              ================================================= */}

          {activeSection === "roadmap" && (
            <>
              <section className="page-heading">
                <span className="eyebrow">
                  Career Planning
                </span>

                <h2>Career Roadmap</h2>

                <p>
                  Generate a personalized roadmap
                  for your target role.
                </p>
              </section>

              <section className="action-card">
                <button
                  className="primary-button"
                  onClick={generateRoadmap}
                  disabled={
                    loading ||
                    !selectedResumeId
                  }
                >
                  {loading
                    ? "Generating..."
                    : "Generate Roadmap"}
                </button>
              </section>

              {loading && (
                <div className="loading-card">
                  <div className="spinner"></div>

                  <p>
                    Creating your personalized
                    roadmap...
                  </p>
                </div>
              )}

              {renderRoadmap()}
            </>
          )}

          {/* =================================================
              JOB MATCH
              ================================================= */}

          {activeSection === "jobmatch" && (
            <>
              <section className="page-heading">
                <span className="eyebrow">
                  Job Intelligence
                </span>

                <h2>Job Match</h2>

                <p>
                  Compare your resume against a
                  job description.
                </p>
              </section>

              <section className="result-card">
                <label className="input-label">
                  Job Description
                </label>

                <textarea
                  className="job-description"
                  rows={12}
                  value={jobDescription}
                  onChange={(e) =>
                    setJobDescription(
                      e.target.value
                    )
                  }
                  placeholder="Paste the job description here..."
                />

                <button
                  className="primary-button"
                  onClick={matchJob}
                  disabled={
                    loading ||
                    !selectedResumeId ||
                    !jobDescription.trim()
                  }
                >
                  {loading
                    ? "Matching..."
                    : "Match Job"}
                </button>
              </section>

              {renderJobMatch()}
            </>
          )}

          {/* =================================================
              AI INTERVIEW
              ================================================= */}

          {activeSection === "interview" &&
            renderInterview()}
        </div>
      </main>
    </div>
  );
}

export default App;