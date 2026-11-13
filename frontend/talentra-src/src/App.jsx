import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Room, RoomEvent, Track } from "livekit-client";
import {
  LayoutDashboard,
  PanelsTopLeft,
  ChartNoAxesColumn,
  Sparkles,
  Play,
  FileText,
  Settings,
  LogOut,
  Bell,
  ChevronLeft,
  ChevronDown,
  Lightbulb,
  Target,
  AudioLines,
  ClipboardPen,
  Video,
  Mic,
  Volume2,
  Phone,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  CalendarDays,
  Upload,
  Menu,
  X,
  Camera,
  Pause,
  RotateCcw,
} from "lucide-react";

const nav = [
  ["Dashboard", LayoutDashboard],
  ["Interviews", PanelsTopLeft],
  ["Analysis", ChartNoAxesColumn],
  ["AI insights", Sparkles],
  ["Practice", Play],
  ["Reports", FileText],
  ["Settings", Settings],
];
const defaultQuestions = [
  "Tell me about a scalable .NET Web API you designed. What architectural decisions did you make?",
  "How do you improve the performance of a slow SQL Server query?",
  "Explain dependency injection lifetimes in ASP.NET Core and when you would use each.",
  "How would you integrate a RAG pipeline into an existing enterprise application?",
];
function App() {
  const [active, setActive] = useState("Interviews"),
    [menuOpen, setMenuOpen] = useState(false),
    [cameraOn, setCameraOn] = useState(false),
    [callActive, setCallActive] = useState(false),
    [callStatus, setCallStatus] = useState("Not connected"),
    [micOn, setMicOn] = useState(false),
    [recording, setRecording] = useState(true),
    [question, setQuestion] = useState(0),
    [answer, setAnswer] = useState(""),
    [showAnswer, setShowAnswer] = useState(false),
    [notice, setNotice] = useState("");
  const [selectedFile, setSelectedFile] = useState(null),
    [resume, setResume] = useState(null),
    [role, setRole] = useState("Senior .NET Developer"),
    [questions, setQuestions] = useState(defaultQuestions),
    [sessionId, setSessionId] = useState(null),
    [apiBusy, setApiBusy] = useState(false),
    [apiError, setApiError] = useState(""),
    [aiFeedback, setAiFeedback] = useState(null),
    [score, setScore] = useState(null),
    [voiceState, setVoiceState] = useState("idle"),
    [voiceEnabled, setVoiceEnabled] = useState(true),
    [transcript, setTranscript] = useState("");
  const API_BASE =
    import.meta.env.VITE_API_BASE_URL || "https://localhost:64828/api";
  const videoRef = useRef(null),
    streamRef = useRef(null),
    recognitionRef = useRef(null),
    roomRef = useRef(null),
    remoteMediaRef = useRef(null);
  // LiveKit owns the camera/microphone tracks during a call. The local preview
  // attaches the published camera track after React has mounted the video element.
  useEffect(() => {
    const video = videoRef.current;
    const room = roomRef.current;
    const publication = room?.localParticipant?.getTrackPublication(
      Track.Source.Camera,
    );
    if (callActive && video && publication?.track) {
      publication.track.attach(video);
      video.play().catch(() => {});
    }
    return () => {
      if (publication?.track && video) publication.track.detach(video);
    };
  }, [callActive, cameraOn]);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      roomRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function toggleCamera() {
    const room = roomRef.current;
    if (!room || !callActive) {
      setNotice("Start the LiveKit call before enabling your camera.");
      return;
    }
    try {
      const enabled = !cameraOn;
      await room.localParticipant.setCameraEnabled(enabled);
      setCameraOn(enabled);
    } catch (error) {
      console.error("LiveKit camera toggle failed:", error);
      setNotice("Could not change camera state. Check browser permissions.");
    }
  }

  async function startCall() {
    if (!sessionId) {
      setNotice("Start an interview before joining the call.");
      return;
    }
    if (roomRef.current) return;
    setCallStatus("Connecting…");
    try {
      const { data } = await axios.post(
        `${API_BASE}/interviews/${sessionId}/livekit-token`,
        {},
      );
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on(RoomEvent.ConnectionStateChanged, (state) =>
        setCallStatus(state),
      );
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (!remoteMediaRef.current) return;
        const element = track.attach();
        element.dataset.participant = participant.identity;
        if (track.kind === Track.Kind.Video) {
          element.className = "remote-live-video";
          element.playsInline = true;
        } else {
          element.autoplay = true;
        }
        remoteMediaRef.current.appendChild(element);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
      });
      room.on(RoomEvent.Disconnected, () => {
        setCallActive(false);
        setCameraOn(false);
        setMicOn(false);
        setCallStatus("Disconnected");
        if (remoteMediaRef.current) remoteMediaRef.current.replaceChildren();
      });
      await room.connect(data.serverUrl, data.token);
      await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);
      setCameraOn(true);
      setMicOn(true);
      setCallActive(true);
      setCallStatus("Connected");
      action("Connected to the Talentra LiveKit room.");
      if (voiceEnabled) speakText(questions[question]);
    } catch (error) {
      console.error("LiveKit connection failed:", error);
      roomRef.current?.disconnect();
      roomRef.current = null;
      setCallActive(false);
      setCameraOn(false);
      setMicOn(false);
      setCallStatus("Connection failed");
      setNotice(
        error.response?.data?.message ||
          error.message ||
          "Could not connect to LiveKit. Check server configuration.",
      );
    }
  }

  async function endCall() {
    stopListening();
    window.speechSynthesis?.cancel();
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect();
    if (remoteMediaRef.current) remoteMediaRef.current.replaceChildren();
    setCallActive(false);
    setCameraOn(false);
    setMicOn(false);
    setCallStatus("Disconnected");
    action("Call ended. Your submitted answers remain saved in Talentra.");
  }
  function action(label) {
    setNotice(label);
    setTimeout(() => setNotice(""), 3200);
  }
  function speakText(text) {
    if (!voiceEnabled || !("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    utterance.pitch = 1.0;
    utterance.onstart = () => setVoiceState("speaking");
    utterance.onend = () => setVoiceState("idle");
    utterance.onerror = () => setVoiceState("idle");
    window.speechSynthesis.speak(utterance);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setMicOn(false);
    setVoiceState("idle");
  }

  function startListening() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice(
        "Speech recognition is not supported in this browser. Please use Chrome or type your answer.",
      );
      return;
    }
    window.speechSynthesis?.cancel();
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => {
      setMicOn(true);
      setVoiceState("listening");
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += part + " ";
        else interimText += part;
      }
      if (finalText)
        setAnswer(
          (current) => `${current}${current ? " " : ""}${finalText.trim()}`,
        );
      setTranscript(interimText);
    };
    recognition.onerror = (event) => {
      setVoiceState("idle");
      if (!roomRef.current) setMicOn(false);
      if (event.error !== "no-speech" && event.error !== "aborted")
        setNotice(`Microphone recognition error: ${event.error}`);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (!roomRef.current) setMicOn(false);
      setVoiceState((current) => (current === "listening" ? "idle" : current));
      setTranscript("");
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (error) {
      setNotice("Could not start microphone recognition. Please try again.");
    }
  }

  async function toggleMicrophone() {
    const room = roomRef.current;
    if (!room || !callActive) {
      setNotice("Join the LiveKit call before enabling your microphone.");
      return;
    }
    try {
      const enabled = !micOn;
      await room.localParticipant.setMicrophoneEnabled(enabled);
      setMicOn(enabled);
      if (enabled) startListening();
      else stopListening();
    } catch (error) {
      console.error("LiveKit microphone toggle failed:", error);
      setNotice(
        "Could not change microphone state. Check browser permissions.",
      );
    }
  }

  async function uploadResume() {
    if (!selectedFile) {
      setApiError("Choose a PDF, DOCX or TXT CV first.");
      return;
    }
    setApiBusy(true);
    setApiError("");
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      const { data } = await axios.post(`${API_BASE}/resumes/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResume(data);
      setSessionId(null);
      setAiFeedback(null);
      action("CV analyzed successfully with Phi-3 Mini.");
    } catch (e) {
      setApiError(
        e.response?.data?.message ||
          e.response?.data?.detail ||
          e.message ||
          "CV upload failed.",
      );
    } finally {
      setApiBusy(false);
    }
  }
  async function startInterview() {
    if (!resume?.id) {
      setApiError("Upload and analyze a CV before starting.");
      return;
    }
    setApiBusy(true);
    setApiError("");
    try {
      const { data } = await axios.post(`${API_BASE}/interviews/start`, {
        resumeId: resume.id,
        role,
      });
      setSessionId(data.id);
      setQuestions(data.questions || defaultQuestions);
      setQuestion(0);
      setAnswer("");
      setAiFeedback(null);
      setShowAnswer(false);
      action("Personalized interview generated.");
      if (voiceEnabled)
        window.setTimeout(
          () => speakText((data.questions || defaultQuestions)[0]),
          350,
        );
    } catch (e) {
      setApiError(
        e.response?.data?.message ||
          e.response?.data?.detail ||
          e.message ||
          "Could not start interview.",
      );
    } finally {
      setApiBusy(false);
    }
  }
  async function submitAnswer() {
    if (voiceState === "listening") stopListening();
    if (!answer.trim()) {
      action("Please enter an answer first.");
      return;
    }
    if (!sessionId) {
      action("Upload a CV and start an interview to enable AI evaluation.");
      return;
    }
    setApiBusy(true);
    setApiError("");
    try {
      const { data } = await axios.post(`${API_BASE}/interviews/answer`, {
        sessionId,
        questionIndex: question,
        answer,
      });
      setAiFeedback(data.feedback);
      setScore(
        typeof data.feedback?.score === "number"
          ? Math.round(data.feedback.score * 10)
          : null,
      );
      setShowAnswer(true);

      // Ask the backend to generate the next question from the complete
      // conversation so far. Keep the current feedback visible until the
      // candidate chooses "Next question".
      try {
        const next = await axios.post(`${API_BASE}/interviews/next-question`, {
          sessionId,
          questionIndex: question,
        });

        if (next.data.completed) {
          action("Interview completed. You have reached the question limit.");
        } else if (next.data.question && Array.isArray(next.data.questions)) {
          setQuestions(next.data.questions);
          action(
            "Answer evaluated. Your personalized follow-up question is ready.",
          );
        }
      } catch (nextError) {
        setApiError(
          nextError.response?.data?.message ||
            "Your answer was evaluated, but the next adaptive question could not be generated. You can continue with the existing questions.",
        );
      }
    } catch (e) {
      setApiError(
        e.response?.data?.message ||
          e.response?.data?.detail ||
          e.message ||
          "Answer evaluation failed.",
      );
    } finally {
      setApiBusy(false);
    }
  }
  function moveQuestion(next) {
    setQuestion(next);
    setAnswer("");
    setShowAnswer(false);
    setAiFeedback(null);
    if (voiceEnabled) speakText(questions[next]);
  }
  const navClick = (n) => {
    setActive(n);
    setMenuOpen(false);
    if (n !== "Interviews")
      action(`${n} section selected — connect your API to load live data.`);
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "show" : ""}`}>
        <div className="brand">
          Talentra<span className="brand-dot">.</span>
        </div>
        <div className="menu-label">MAIN MENU</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              onClick={() => navClick(name)}
              className={`nav-item ${active === name ? "active" : ""}`}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "Interviews" && <span className="nav-count">2</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-card">
            <div className="plan-icon">
              <Sparkles size={16} />
            </div>
            <b>Pro workspace</b>
            <small>Unlock advanced interview insights</small>
            <button onClick={() => action("Workspace plan details")}>
              Explore plan <ArrowUpRight size={13} />
            </button>
          </div>
          <button
            className="logout"
            onClick={() => action("Logout action — connect authentication")}
          >
            <LogOut size={17} /> Log out
          </button>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}
      <main className="main">
        <header className="topbar">
          <div className="top-left">
            <button
              className="mobile-menu icon-btn"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
            <button
              className="back-btn"
              onClick={() => action("Back to interview list")}
            >
              <ChevronLeft size={19} />
            </button>
            <div>
              <div className="crumb">INTERVIEW SESSION</div>
              <h1>Interview for Senior .NET Developer</h1>
            </div>
          </div>
          <div className="top-actions">
            <button
              className="icon-btn notification"
              onClick={() => action("You are all caught up")}
            >
              <Bell size={19} />
              <i />
            </button>
            <button className="profile" onClick={() => action("Profile menu")}>
              <span className="avatar">YB</span>
              <span>Bijay</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-intro">
            <div>
              <div className="eyebrow">LIVE INTERVIEW ROOM</div>
              <h2>Your interview workspace</h2>
              <p>
                Practice, review your performance, and improve with AI-powered
                feedback.
              </p>
            </div>
            <div className="session-meta">
              <span>
                <span className="live-dot" /> Session in progress
              </span>
              <span>
                <Clock size={14} /> 24:18 elapsed
              </span>
            </div>
          </div>
          <section className="cv-connect card">
            <div className="cv-copy">
              <span className="eyebrow">PERSONALIZED INTERVIEW</span>
              <h3>
                {resume
                  ? `CV analyzed: ${resume.candidateName || resume.fileName}`
                  : "Start with your resume"}
              </h3>
              <p>
                {resume
                  ? "Your resume profile is ready. Choose a target role and generate interview questions tailored to your experience."
                  : "Upload a PDF, DOCX or TXT resume. Phi-3 Mini will extract your skills and prepare role-specific questions."}
              </p>
              {resume?.analysis?.technicalSkills?.length > 0 && (
                <div className="cv-skills">
                  {resume.analysis.technicalSkills.slice(0, 8).map((x, i) => (
                    <span key={i}>{x}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="cv-actions">
              {!resume ? (
                <>
                  <label className="file-picker">
                    <Upload size={16} />
                    <span>
                      {selectedFile ? selectedFile.name : "Choose CV file"}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) =>
                        setSelectedFile(e.target.files?.[0] || null)
                      }
                    />
                  </label>
                  <button
                    className="primary-btn"
                    disabled={apiBusy || !selectedFile}
                    onClick={uploadResume}
                  >
                    {apiBusy ? "Analyzing…" : "Upload & analyze CV"}
                  </button>
                </>
              ) : (
                <>
                  <select
                    className="role-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option>Senior .NET Developer</option>
                    <option>Technical Lead - .NET</option>
                    <option>.NET + AI Developer</option>
                    <option>Full Stack Developer (React + .NET)</option>
                  </select>
                  <button
                    className="primary-btn"
                    disabled={apiBusy}
                    onClick={startInterview}
                  >
                    {apiBusy
                      ? "Generating…"
                      : sessionId
                        ? "Regenerate questions"
                        : "Start AI interview"}{" "}
                    <ArrowUpRight size={15} />
                  </button>
                </>
              )}
            </div>
            {apiError && <div className="api-error">{apiError}</div>}
          </section>
          <div className="dashboard-grid">
            <section className="left-column">
              <div className="video-card">
                <div className="video-stage">
                  {cameraOn ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="live-video"
                    />
                  ) : (
                    <div className="video-placeholder">
                      <div className="person-avatar">YB</div>
                      <div className="placeholder-name">
                        Your camera preview
                      </div>
                      <span>Enable your camera to appear here</span>
                      <button onClick={toggleCamera} className="enable-camera">
                        <Camera size={16} /> Enable camera
                      </button>
                    </div>
                  )}
                  <div className="video-top">
                    <div className="candidate-chip">
                      <span className="avatar small">YB</span>
                      <div>
                        <b>Bijay Behera</b>
                        <small>Candidate</small>
                      </div>
                    </div>
                    <div className="recording">
                      <span />{" "}
                      {callActive ? "LiveKit connected" : "Not connected"}
                    </div>
                  </div>
                  <div
                    ref={remoteMediaRef}
                    className="livekit-remote-media"
                    aria-label="Remote LiveKit participants"
                  />
                  <div className="interviewer-tile">
                    <div className={`ai-avatar ai-avatar-${voiceState}`}>
                      <Sparkles size={25} />
                    </div>
                    <b>Talentra AI</b>
                    <small>
                      {voiceState === "speaking"
                        ? "Speaking"
                        : voiceState === "listening"
                          ? "Listening to you"
                          : "AI interviewer"}
                    </small>
                    <div className="voice-bars">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                  <div className="video-bottom">
                    <div className="video-progress">
                      <span>{callActive ? callStatus : "Not connected"}</span>
                      <div>
                        <i />
                      </div>
                      <span>30:00</span>
                    </div>
                    <div className="controls">
                      <button
                        className={
                          cameraOn ? "control active-control" : "control"
                        }
                        onClick={toggleCamera}
                        title="Toggle camera"
                      >
                        <Video size={18} />
                      </button>
                      <button
                        className={
                          micOn ? "control active-control" : "control muted"
                        }
                        onClick={toggleMicrophone}
                        title="Start or stop voice answer"
                      >
                        <Mic size={18} />
                      </button>
                      <button
                        className="control"
                        onClick={() => action("Speaker settings")}
                        title="Speaker"
                      >
                        <Volume2 size={18} />
                      </button>
                      <button
                        className="control end-call"
                        onClick={callActive ? endCall : startCall}
                        title={
                          callActive ? "End LiveKit call" : "Join LiveKit call"
                        }
                      >
                        <Phone size={18} />
                      </button>
                      <button
                        className="control"
                        onClick={() => action("More interview controls")}
                      >
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="video-footer">
                  <div>
                    <span className="status-pulse" />{" "}
                    <b>
                      {recording
                        ? "Interview is being recorded"
                        : "Recording paused"}
                    </b>
                    <small>Your session is private and secure</small>
                  </div>
                  <button
                    className="text-action"
                    onClick={() => setRecording(!recording)}
                  >
                    {recording ? <Pause size={15} /> : <Play size={15} />}{" "}
                    {recording ? "Pause recording" : "Resume recording"}
                  </button>
                </div>
              </div>
              <div className="lower-grid">
                <div className="score-card card">
                  <div className="card-heading">
                    <div>
                      <span className="eyebrow">PERFORMANCE</span>
                      <h3>AI interview score</h3>
                    </div>
                    <span className="trend">
                      <ArrowUpRight size={14} /> +8%
                    </span>
                  </div>
                  <div className="score-ring">
                    <div>
                      <strong>
                        {score === null ? "—" : score}
                        <span>{score === null ? "" : "%"}</span>
                      </strong>
                      <small>
                        {score === null
                          ? "Awaiting evaluation"
                          : "Latest answer score"}
                      </small>
                    </div>
                  </div>
                  <div className="score-caption">
                    <b>
                      {score === null
                        ? "Your score will appear here"
                        : score >= 70
                          ? "Good progress — keep going"
                          : "Keep practicing to improve"}
                    </b>
                    <span>
                      {score === null
                        ? "Submit an interview answer to receive your first AI score."
                        : "This score reflects your latest evaluated answer."}
                    </span>
                  </div>
                  <div className="readiness">
                    <span>Interview readiness</span>
                    <b>Good</b>
                  </div>
                  <div className="readiness-track">
                    <i />
                  </div>
                </div>
                <div className="breakdown-card card">
                  <div className="card-heading">
                    <div>
                      <span className="eyebrow">DETAILED RESULTS</span>
                      <h3>AI score breakdown</h3>
                    </div>
                    <button
                      className="dots"
                      onClick={() => action("Score breakdown options")}
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                  <div className="donut-wrap">
                    <div className="donut">
                      <div className="donut-hole">
                        <b>78%</b>
                        <small>Average</small>
                      </div>
                    </div>
                    <div className="legend">
                      <div>
                        <i className="c1" />
                        Technical <b>20%</b>
                      </div>
                      <div>
                        <i className="c2" />
                        Communication <b>25%</b>
                      </div>
                      <div>
                        <i className="c3" />
                        Confidence <b>30%</b>
                      </div>
                      <div>
                        <i className="c4" />
                        Clarity <b>15%</b>
                      </div>
                      <div>
                        <i className="c5" />
                        Problem solving <b>10%</b>
                      </div>
                    </div>
                  </div>
                  <div className="breakdown-note">
                    {score === null
                      ? "Category breakdown will be available after more interview answers are evaluated."
                      : "Continue answering questions to build a more complete skill breakdown."}
                  </div>
                </div>
              </div>
            </section>
            <aside className="right-column">
              <div className="recommend-card card">
                <div className="card-heading">
                  <div>
                    <span className="eyebrow">PERSONALIZED FOR YOU</span>
                    <h3>Practice recommendations</h3>
                  </div>
                  <span className="sparkle">
                    <Sparkles size={17} />
                  </span>
                </div>
                <div className="recommend-grid">
                  <button onClick={() => action("Opening concept practice")}>
                    <span className="rec-icon yellow">
                      <Lightbulb />
                    </span>
                    <b>Core concepts</b>
                    <small>Strengthen fundamentals</small>
                  </button>
                  <button onClick={() => action("Opening goal practice")}>
                    <span className="rec-icon coral">
                      <Target />
                    </span>
                    <b>Set a goal</b>
                    <small>Focus your preparation</small>
                  </button>
                  <button
                    onClick={() => action("Opening communication practice")}
                  >
                    <span className="rec-icon blue">
                      <AudioLines />
                    </span>
                    <b>Communication</b>
                    <small>Practice clear answers</small>
                  </button>
                  <button onClick={() => action("Opening notes")}>
                    <span className="rec-icon purple">
                      <ClipboardPen />
                    </span>
                    <b>Review notes</b>
                    <small>Revisit key feedback</small>
                  </button>
                </div>
              </div>
              <div className="insights-card card">
                <div className="card-heading">
                  <div>
                    <span className="eyebrow">YOUR AI COACH</span>
                    <h3>
                      <Sparkles size={17} /> AI insights
                    </h3>
                  </div>
                  <span className="new-pill">NEW</span>
                </div>
                <div className="insight-item">
                  <span className="insight-symbol success">
                    <CheckCircle2 size={17} />
                  </span>
                  <div>
                    <b>Strength insight</b>
                    <p>
                      You demonstrated strong confidence while discussing
                      backend architecture and API design.
                    </p>
                  </div>
                </div>
                <div className="insight-item">
                  <span className="insight-symbol warning">
                    <AlertTriangle size={17} />
                  </span>
                  <div>
                    <b>Opportunity to improve</b>
                    <p>
                      Your answers became less structured during behavioral and
                      scenario-based questions.
                    </p>
                  </div>
                </div>
                <div className="insight-item">
                  <span className="insight-symbol target">
                    <Target size={17} />
                  </span>
                  <div>
                    <b>Actionable recommendation</b>
                    <p>
                      Practice the STAR method and explain technical decisions
                      using real project examples.
                    </p>
                  </div>
                </div>
                <button
                  className="full-link"
                  onClick={() => setActive("AI insights")}
                >
                  View all AI insights <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="next-card">
                <div className="next-icon">
                  <CalendarDays size={19} />
                </div>
                <div>
                  <b>Keep your momentum</b>
                  <span>Next practice · System design</span>
                </div>
                <button onClick={() => setActive("Practice")}>
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </aside>
          </div>
          <section className="question-panel card">
            <div className="question-head">
              <div>
                <span className="eyebrow">PRACTICE MODE</span>
                <h3>Current interview question</h3>
              </div>
              <span className="question-count">
                Question {question + 1} of {questions.length}
              </span>
            </div>
            <p className="question-text">{questions[question]}</p>
            <div className="voice-toolbar">
              <button
                className="secondary-btn"
                onClick={() => speakText(questions[question])}
              >
                <Volume2 size={15} /> Hear question
              </button>
              <button
                className={
                  voiceState === "listening"
                    ? "primary-btn listening-btn"
                    : "secondary-btn"
                }
                onClick={toggleMicrophone}
              >
                <Mic size={15} />{" "}
                {voiceState === "listening"
                  ? "Stop speaking"
                  : "Answer by voice"}
              </button>
              <label className="voice-toggle">
                <input
                  type="checkbox"
                  checked={voiceEnabled}
                  onChange={(e) => {
                    setVoiceEnabled(e.target.checked);
                    if (!e.target.checked) window.speechSynthesis?.cancel();
                  }}
                />{" "}
                AI voice
              </label>
            </div>
            {transcript && (
              <div className="transcript-preview">Listening: {transcript}</div>
            )}
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here, or use your microphone during a live interview..."
            />
            <div className="question-actions">
              <span>
                {" "}
                <Sparkles size={14} /> AI feedback available after submission
              </span>
              <div>
                <button
                  className="secondary-btn"
                  onClick={() => {
                    setAnswer("");
                    setShowAnswer(false);
                  }}
                >
                  <RotateCcw size={14} /> Clear
                </button>
                <button
                  className="primary-btn"
                  disabled={apiBusy}
                  onClick={submitAnswer}
                >
                  {apiBusy ? "Evaluating…" : "Submit answer"}{" "}
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </div>
            {showAnswer && (
              <div className="inline-feedback ai-feedback">
                <CheckCircle2 size={17} />
                <div>
                  <b>AI evaluation · {aiFeedback?.score ?? "—"}/10</b>
                  <p>
                    {aiFeedback?.summary || "Answer evaluated successfully."}
                  </p>
                  {aiFeedback?.strengths?.length > 0 && (
                    <p>
                      <strong>Strengths:</strong>{" "}
                      {aiFeedback.strengths.join("; ")}
                    </p>
                  )}
                  {aiFeedback?.improvements?.length > 0 && (
                    <p>
                      <strong>Improve:</strong>{" "}
                      {aiFeedback.improvements.join("; ")}
                    </p>
                  )}
                  {aiFeedback?.sampleAnswer && (
                    <details>
                      <summary>View suggested answer</summary>
                      <p>{aiFeedback.sampleAnswer}</p>
                    </details>
                  )}
                </div>
              </div>
            )}
            <div className="question-nav">
              <button
                disabled={question === 0}
                onClick={() => moveQuestion(question - 1)}
              >
                Previous question
              </button>
              <button
                disabled={question >= questions.length - 1}
                onClick={() =>
                  moveQuestion(Math.min(question + 1, questions.length - 1))
                }
              >
                Next question <ArrowUpRight size={14} />
              </button>
            </div>
          </section>
          <footer className="footer">
            <span>© 2026 Talentra AI Interview Platform</span>
            <span>
              Designed for focused practice{" "}
              <span className="footer-heart">♥</span>
            </span>
          </footer>
        </div>
      </main>
      {notice && (
        <div className="toast">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}
export default App;
