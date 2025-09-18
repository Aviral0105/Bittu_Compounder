import os
from fastapi import FastAPI, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.cloud import speech, texttospeech
import tempfile
import uvicorn
import json
import base64
import google.generativeai as genai
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()  # This loads the .env file

# Point to your service account key
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(
    os.path.dirname(__file__), "google-creds.json"
)

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI()

# Allow frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Google clients
speech_client = speech.SpeechClient()
tts_client = texttospeech.TextToSpeechClient()

# Initialize Gemini model
model = genai.GenerativeModel('gemini-1.5-flash')

# Mental health assistant prompt
SYSTEM_PROMPT = """You are Bittu, a compassionate and empathetic mental health assistant. Your role is to:

1. Listen actively and provide emotional support
2. Offer practical coping strategies and techniques
3. Encourage professional help when appropriate
4. Be non-judgmental and understanding
5. Keep responses conversational and warm
6. Focus on the user's mental wellbeing

Guidelines:
- Always be supportive and encouraging
- Provide helpful mental health tips and coping strategies
- If someone expresses suicidal thoughts or severe distress, gently encourage them to seek professional help
- Keep responses concise but meaningful (2-3 sentences typically)
- Be culturally sensitive and respectful
- Never diagnose or provide medical advice

Remember: You're here to support, listen, and guide users toward better mental health."""

def get_gemini_response(user_message: str, language: str) -> str:
    """Get response from Gemini API for mental health support"""
    try:
        # Adjust prompt based on language
        language_instruction = ""
        if language.startswith("hi"):
            language_instruction = " Please respond in Hindi."
        elif language.startswith("ta"):
            language_instruction = " Please respond in Tamil."
        else:
            language_instruction = " Please respond in English."
        
        full_prompt = f"{SYSTEM_PROMPT}\n\nUser message: {user_message}\n{language_instruction}"
        
        response = model.generate_content(full_prompt)
        return response.text
        
    except Exception as e:
        print(f"Gemini API error: {e}")
        # Fallback response if API fails
        fallback_responses = {
            "hi": "मैं समझ रहा हूं कि आप कुछ कह रहे थे। क्या आप मुझसे अपनी भावनाओं के बारे में और बता सकते हैं?",
            "ta": "நீங்கள் ஏதோ சொல்ல முயற்சித்தது எனக்குப் புரிகிறது. உங்கள் உணர்வுகளைப் பற்றி மேலும் சொல்ல முடியுமா?",
            "default": "I understand you're reaching out. I'm here to listen and support you. Can you tell me more about how you're feeling right now?"
        }
        
        if language.startswith("hi"):
            return fallback_responses["hi"]
        elif language.startswith("ta"):
            return fallback_responses["ta"]
        else:
            return fallback_responses["default"]


@app.post("/process-audio/")
async def process_audio(file: UploadFile, language: str = Form("en-IN"), voice: str = Form("FEMALE")):
    try:
        # Save uploaded audio temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
            temp_audio.write(await file.read())
            temp_filename = temp_audio.name

        # Recognize speech
        with open(temp_filename, "rb") as audio_file:
            audio = speech.RecognitionAudio(content=audio_file.read())

        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
            sample_rate_hertz=48000,
            language_code=language,
        )

        response = speech_client.recognize(config=config, audio=audio)
        transcript = response.results[0].alternatives[0].transcript if response.results else "Could not transcribe audio."

        # Get real Gemini response based on user's message
        gemini_response = get_gemini_response(transcript, language)

        # Convert Gemini response to speech
        synthesis_input = texttospeech.SynthesisInput(text=gemini_response)
        gender = texttospeech.SsmlVoiceGender.FEMALE if voice == "FEMALE" else texttospeech.SsmlVoiceGender.MALE

        tts_voice = texttospeech.VoiceSelectionParams(language_code=language, ssml_gender=gender)
        audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

        tts_response = tts_client.synthesize_speech(
            input=synthesis_input, voice=tts_voice, audio_config=audio_config
        )

        # Convert audio to base64 for JSON response
        audio_base64 = base64.b64encode(tts_response.audio_content).decode('utf-8')

        # Clean up temp file
        os.unlink(temp_filename)

        # Return JSON response with all data
        return JSONResponse({
            "transcript": transcript,
            "gemini_response": gemini_response,
            "audio_base64": audio_base64,
            "success": True
        })

    except Exception as e:
        # Clean up temp file if it exists
        if 'temp_filename' in locals():
            try:
                os.unlink(temp_filename)
            except:
                pass
        
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "Bittu Mental Health Assistant Backend"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)