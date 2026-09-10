import { useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function Interview() {
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");

  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");

  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(false);

  const [questionNumber, setQuestionNumber] = useState(1);
  const [interviewStarted, setInterviewStarted] = useState(false);

  // =====================================================
  // START INTERVIEW
  // =====================================================

  const startInterview = async () => {
    if (!jobDescription || !resumeText) {
      alert("Please enter job description and resume text.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/ai/interview/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            job_description: jobDescription,
            resume_text: resumeText,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to start interview");
      }

      setQuestion(data.interview);
      setQuestionNumber(1);
      setAnswer("");
      setEvaluation(null);
      setInterviewStarted(true);

    } catch (error) {
      console.error(error);
      alert(error.message);
    }

    setLoading(false);
  };

  // =====================================================
  // EVALUATE ANSWER
  // =====================================================

  const evaluateAnswer = async () => {
    if (!answer.trim()) {
      alert("Please enter your answer.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/ai/interview/evaluate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: question.question,
            answer: answer,
            job_description: jobDescription,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Answer evaluation failed"
        );
      }

      setEvaluation(data.evaluation);

    } catch (error) {
      console.error(error);
      alert(error.message);
    }

    setLoading(false);
  };

  // =====================================================
  // NEXT QUESTION
  // =====================================================

  const nextQuestion = async () => {
    if (!answer.trim()) {
      alert("Please answer the current question first.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/ai/interview/next-question`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            job_description: jobDescription,
            resume_text: resumeText,
            previous_question: question.question,
            previous_answer: answer,
            question_number: questionNumber,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to generate next question"
        );
      }

      setQuestion(data.interview);
      setQuestionNumber(data.interview.question_number);

      setAnswer("");
      setEvaluation(null);

    } catch (error) {
      console.error(error);
      alert(error.message);
    }

    setLoading(false);
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div style={styles.container}>

      <h1>CareerPath AI</h1>

      <h2>AI Interview Simulator</h2>

      {!interviewStarted && (
        <div style={styles.card}>

          <label>Job Description</label>

          <textarea
            value={jobDescription}
            onChange={(e) =>
              setJobDescription(e.target.value)
            }
            placeholder="Paste the job description here..."
            style={styles.textarea}
          />

          <label>Resume Text</label>

          <textarea
            value={resumeText}
            onChange={(e) =>
              setResumeText(e.target.value)
            }
            placeholder="Paste your resume text here..."
            style={styles.textarea}
          />

          <button
            onClick={startInterview}
            disabled={loading}
            style={styles.button}
          >
            {loading
              ? "Starting Interview..."
              : "Start AI Interview"}
          </button>

        </div>
      )}

      {interviewStarted && question && (
        <div style={styles.card}>

          <div style={styles.questionHeader}>
            <span>
              Question {questionNumber}
            </span>

            <span>
              {question.category}
            </span>

            <span>
              {question.difficulty}
            </span>
          </div>

          <h2>
            {question.question}
          </h2>

          <textarea
            value={answer}
            onChange={(e) =>
              setAnswer(e.target.value)
            }
            placeholder="Type your answer..."
            style={styles.answerBox}
          />

          <div style={styles.buttonRow}>

            <button
              onClick={evaluateAnswer}
              disabled={loading}
              style={styles.button}
            >
              {loading
                ? "Evaluating..."
                : "Evaluate Answer"}
            </button>

            <button
              onClick={nextQuestion}
              disabled={loading}
              style={styles.secondaryButton}
            >
              Next Question
            </button>

          </div>

          {evaluation && (
            <div style={styles.evaluation}>

              <h2>AI Evaluation</h2>

              <p>
                <strong>
                  Technical Correctness:
                </strong>{" "}
                {evaluation.technical_correctness}/10
              </p>

              <p>
                <strong>
                  Relevance:
                </strong>{" "}
                {evaluation.relevance}/10
              </p>

              <p>
                <strong>
                  Clarity:
                </strong>{" "}
                {evaluation.clarity}/10
              </p>

              <p>
                <strong>
                  Communication:
                </strong>{" "}
                {evaluation.communication}/10
              </p>

              <h3>
                Overall Score:{" "}
                {evaluation.overall_score}/10
              </h3>

              <h3>Strengths</h3>

              <ul>
                {evaluation.strengths?.map(
                  (item, index) => (
                    <li key={index}>
                      {item}
                    </li>
                  )
                )}
              </ul>

              <h3>Weaknesses</h3>

              <ul>
                {evaluation.weaknesses?.map(
                  (item, index) => (
                    <li key={index}>
                      {item}
                    </li>
                  )
                )}
              </ul>

              <h3>Improvements</h3>

              <ul>
                {evaluation.improvements?.map(
                  (item, index) => (
                    <li key={index}>
                      {item}
                    </li>
                  )
                )}
              </ul>

              <h3>Interviewer Feedback</h3>

              <p>
                {evaluation.feedback}
              </p>

            </div>
          )}

        </div>
      )}

    </div>
  );
}


// =====================================================
// STYLES
// =====================================================

const styles = {

  container: {
    maxWidth: "900px",
    margin: "40px auto",
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },

  card: {
    padding: "25px",
    border: "1px solid #ddd",
    borderRadius: "12px",
    marginTop: "20px",
  },

  textarea: {
    width: "100%",
    minHeight: "150px",
    padding: "12px",
    marginTop: "8px",
    marginBottom: "20px",
    boxSizing: "border-box",
  },

  answerBox: {
    width: "100%",
    minHeight: "180px",
    padding: "12px",
    marginTop: "20px",
    boxSizing: "border-box",
  },

  button: {
    padding: "12px 20px",
    marginTop: "15px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    background: "#2563eb",
    color: "white",
  },

  secondaryButton: {
    padding: "12px 20px",
    marginTop: "15px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },

  buttonRow: {
    display: "flex",
    gap: "10px",
  },

  questionHeader: {
    display: "flex",
    gap: "20px",
    marginBottom: "20px",
  },

  evaluation: {
    marginTop: "30px",
    padding: "20px",
    borderTop: "1px solid #ddd",
  },
};

export default Interview;