import React, { useState, useRef } from "react";
import axios from "axios";

function App() {
  const [language, setLanguage] = useState("en-IN");
  const [voice, setVoice] = useState("FEMALE");
  const [transcript, setTranscript] = useState("");
  const [geminiResponse, setGeminiResponse] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);
  const [recording, setRecording] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Start microphone recording
  const startRecording = async () => {
    setRecording(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    audioChunksRef.current = [];

    mediaRecorderRef.current.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      setAudioBlob(blob);
      // Placeholders until backend integration
      setTranscript("Transcribed text will appear here...");
      setGeminiResponse("Gemini response will appear here...");
    };

    mediaRecorderRef.current.start();
  };

  // Stop recording and send audio to backend (stub for now)
  const stopRecording = () => {
    setRecording(false);
    mediaRecorderRef.current.stop();

    // Uncomment this when backend is ready
    setTimeout(() => sendAudioToBackend(), 500);
  };

  // Axios function to send audio to backend (stub)
  const sendAudioToBackend = async () => {
  if (!audioBlob) return;

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("language", language);
  formData.append("voice", voice);

  try {
    const response = await axios.post(
      "http://127.0.0.1:8000/process-audio/",
      formData,
      { headers: { "Content-Type": "multipart/form-data" }, responseType: "blob" }
    );

    // Play TTS audio
    const audioURL = URL.createObjectURL(response.data);
    const audio = new Audio(audioURL);
    audio.play();

    // For now, update placeholders manually (later backend can return JSON)
    setTranscript("Transcribed text from backend...");
    setGeminiResponse("Gemini response from backend...");
  } catch (error) {
    console.error("Error sending audio:", error);
  }
};


  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>Bittu 🌱 Mental Health Assistant</h2>

      {/* Language Selector */}
      <div style={{ marginBottom: "10px" }}>
        <label>
          Language:{" "}
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en-IN">English (India)</option>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="hi-IN">Hindi</option>
            <option value="ta-IN">Tamil</option>
          </select>
        </label>
      </div>

      {/* Voice Selector */}
      <div style={{ marginBottom: "10px" }}>
        <label>
          Voice:{" "}
          <select value={voice} onChange={(e) => setVoice(e.target.value)}>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
          </select>
        </label>
      </div>

      {/* Microphone Controls */}
      <div style={{ marginBottom: "10px" }}>
        <button onClick={startRecording} disabled={recording}>
          Start Recording
        </button>
        <button onClick={stopRecording} disabled={!recording}>
          Stop Recording
        </button>
      </div>

      {/* Transcript Display */}
      <div style={{ marginTop: "20px" }}>
        <h3>Transcript:</h3>
        <p>{transcript}</p>
      </div>

      {/* Gemini Response Display */}
      <div style={{ marginTop: "20px" }}>
        <h3>Gemini Response:</h3>
        <p>{geminiResponse}</p>
      </div>

      {/* Audio Playback */}
      <div style={{ marginTop: "20px" }}>
        <h3>Audio Playback:</h3>
        {audioBlob ? (
          <audio controls src={URL.createObjectURL(audioBlob)} />
        ) : (
          <p>No audio recorded yet.</p>
        )}
      </div>
    </div>
  );
}

export default App;
