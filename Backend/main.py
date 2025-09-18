import os
from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from google.cloud import speech, texttospeech
import tempfile
import uvicorn

# Point to your service account key
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(
    os.path.dirname(__file__), "google-creds.json"
)

app = FastAPI()

# Allow frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # frontend dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Google clients
speech_client = speech.SpeechClient()
tts_client = texttospeech.TextToSpeechClient()


@app.post("/process-audio/")
async def process_audio(file: UploadFile, language: str = Form("en-IN"), voice: str = Form("FEMALE")):
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
    transcript = response.results[0].alternatives[0].transcript if response.results else "Could not transcribe."

    # Dummy Gemini response (replace later with real LLM)
    gemini_response = f"You said: {transcript}"

    # Convert Gemini response to speech
    synthesis_input = texttospeech.SynthesisInput(text=gemini_response)
    gender = texttospeech.SsmlVoiceGender.FEMALE if voice == "FEMALE" else texttospeech.SsmlVoiceGender.MALE

    tts_voice = texttospeech.VoiceSelectionParams(language_code=language, ssml_gender=gender)
    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

    tts_response = tts_client.synthesize_speech(
        input=synthesis_input, voice=tts_voice, audio_config=audio_config
    )

    # Save TTS output
    output_path = os.path.join(tempfile.gettempdir(), "output.mp3")
    with open(output_path, "wb") as out:
        out.write(tts_response.audio_content)

    return FileResponse(output_path, media_type="audio/mpeg")


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
