import React, { useState, useRef } from "react";
import axios from "axios";

function App() {
  const [language, setLanguage] = useState("en-IN");
  const [voice, setVoice] = useState("FEMALE");
  const [transcript, setTranscript] = useState("");
  const [geminiResponse, setGeminiResponse] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [responseAudio, setResponseAudio] = useState(null);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Start microphone recording
  const startRecording = async () => {
    try {
      setError("");
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
        // Send to backend immediately after recording stops
        sendAudioToBackend(blob);
      };

      mediaRecorderRef.current.start();
    } catch (error) {
      setError("Failed to access microphone. Please check permissions.");
      setRecording(false);
      console.error("Error starting recording:", error);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      setRecording(false);
      mediaRecorderRef.current.stop();
      // Stop all tracks to release the microphone
      mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
    }
  };

  // Send audio to backend
  const sendAudioToBackend = async (blob = audioBlob) => {
    if (!blob) {
      setError("No audio to send");
      return;
    }

    setProcessing(true);
    setError("");

    const formData = new FormData();
    formData.append("file", blob, "audio.webm");
    formData.append("language", language);
    formData.append("voice", voice);

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/process-audio/",
        formData,
        { 
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 30000 // 30 second timeout
        }
      );

      if (response.data.success) {
        // Update transcript and response
        setTranscript(response.data.transcript);
        setGeminiResponse(response.data.gemini_response);

        // Convert base64 audio to blob and play
        if (response.data.audio_base64) {
          const audioBytes = atob(response.data.audio_base64);
          const audioArray = new Uint8Array(audioBytes.length);
          for (let i = 0; i < audioBytes.length; i++) {
            audioArray[i] = audioBytes.charCodeAt(i);
          }
          const audioBlob = new Blob([audioArray], { type: "audio/mpeg" });
          const audioURL = URL.createObjectURL(audioBlob);
          
          setResponseAudio(audioURL);
          
          // Auto-play the response
          const audio = new Audio(audioURL);
          audio.play().catch(e => console.log("Audio autoplay failed:", e));
        }
      } else {
        setError("Failed to process audio");
      }
    } catch (error) {
      console.error("Error sending audio:", error);
      if (error.response?.data?.detail) {
        setError(`Server error: ${error.response.data.detail}`);
      } else if (error.code === 'ECONNABORTED') {
        setError("Request timed out. Please try again.");
      } else if (error.code === 'ERR_NETWORK') {
        setError("Cannot connect to server. Make sure backend is running on http://127.0.0.1:8000");
      } else {
        setError("Failed to process audio. Please try again.");
      }
    } finally {
      setProcessing(false);
    }
  };

  // Test backend connection
  const testConnection = async () => {
    try {
      const response = await axios.get("http://127.0.0.1:8000/health");
      if (response.data.status === "healthy") {
        alert("✅ Backend connection successful!");
        setError("");
      }
    } catch (error) {
      setError("❌ Cannot connect to backend. Make sure it's running on http://127.0.0.1:8000");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial", maxWidth: "800px", margin: "0 auto" }}>
      <h2>Bittu 🌱 Mental Health Assistant</h2>
      
      {/* Connection Test */}
      <div style={{ marginBottom: "20px", padding: "10px", backgroundColor: "#f0f0f0", borderRadius: "5px" }}>
        <button onClick={testConnection} style={{ marginRight: "10px" }}>
          Test Backend Connection
        </button>
        <small>Click to verify backend is running</small>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ 
          marginBottom: "20px", 
          padding: "10px", 
          backgroundColor: "#ffebee", 
          color: "#c62828",
          borderRadius: "5px",
          border: "1px solid #ef5350"
        }}>
          {error}
        </div>
      )}

      {/* Language Selector */}
      <div style={{ marginBottom: "10px" }}>
        <label>
          Language:{" "}
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            disabled={processing}
          >
            <option value="en-IN">English (India)</option>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="hi-IN">Hindi</option>
            <option value="ta-IN">Tamil</option>
          </select>
        </label>
      </div>

      {/* Voice Selector */}
      <div style={{ marginBottom: "20px" }}>
        <label>
          Voice:{" "}
          <select 
            value={voice} 
            onChange={(e) => setVoice(e.target.value)}
            disabled={processing}
          >
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
          </select>
        </label>
      </div>

      {/* Microphone Controls */}
      <div style={{ marginBottom: "20px" }}>
        <button 
          onClick={startRecording} 
          disabled={recording || processing}
          style={{
            backgroundColor: recording ? "#4caf50" : "#2196f3",
            color: "white",
            border: "none",
            padding: "10px 20px",
            marginRight: "10px",
            borderRadius: "5px",
            cursor: recording || processing ? "not-allowed" : "pointer"
          }}
        >
          {recording ? "🎤 Recording..." : "🎤 Start Recording"}
        </button>
        <button 
          onClick={stopRecording} 
          disabled={!recording || processing}
          style={{
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "5px",
            cursor: !recording || processing ? "not-allowed" : "pointer"
          }}
        >
          ⏹️ Stop Recording
        </button>
        {processing && <span style={{ marginLeft: "10px" }}>Processing...</span>}
      </div>

      {/* Transcript Display */}
      <div style={{ marginBottom: "20px" }}>
        <h3>Your Message:</h3>
        <div style={{ 
          padding: "10px", 
          backgroundColor: "#e3f2fd", 
          borderRadius: "5px",
          minHeight: "50px"
        }}>
          {transcript || "Your transcribed speech will appear here..."}
        </div>
      </div>

      {/* Gemini Response Display */}
      <div style={{ marginBottom: "20px" }}>
        <h3>Bittu's Response:</h3>
        <div style={{ 
          padding: "10px", 
          backgroundColor: "#f1f8e9", 
          borderRadius: "5px",
          minHeight: "50px"
        }}>
          {geminiResponse || "Bittu's response will appear here..."}
        </div>
      </div>

      {/* Audio Playback */}
      <div style={{ marginBottom: "20px" }}>
        <h3>Your Recording:</h3>
        {audioBlob ? (
          <audio controls src={URL.createObjectURL(audioBlob)} style={{ width: "100%" }} />
        ) : (
          <p style={{ fontStyle: "italic", color: "#666" }}>No audio recorded yet.</p>
        )}
      </div>

      {/* Response Audio Playback */}
      <div style={{ marginBottom: "20px" }}>
        <h3>Bittu's Voice Response:</h3>
        {responseAudio ? (
          <audio controls src={responseAudio} style={{ width: "100%" }} />
        ) : (
          <p style={{ fontStyle: "italic", color: "#666" }}>Voice response will appear here after processing.</p>
        )}
      </div>

      {/* Instructions */}
      <div style={{ 
        marginTop: "30px", 
        padding: "15px", 
        backgroundColor: "#fff3e0", 
        borderRadius: "5px",
        fontSize: "14px"
      }}>
        <h4>How to use:</h4>
        <ol>
          <li>First, click "Test Backend Connection" to ensure the server is running</li>
          <li>Select your preferred language and voice</li>
          <li>Click "Start Recording" and speak your message</li>
          <li>Click "Stop Recording" when done</li>
          <li>Wait for Bittu to process your message and respond</li>
        </ol>
        <p><strong>Note:</strong> Make sure your backend server is running on http://127.0.0.1:8000</p>
      </div>
    </div>
  );
}

export default App;