import os
import uuid
import urllib.parse
import asyncio
from typing import Optional

import yt_dlp
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI(title="Video Downloader API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), "downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

app.mount("/downloads", StaticFiles(directory=DOWNLOAD_DIR), name="downloads")


class VideoRequest(BaseModel):
    url: str = Field(..., description="URL del video a descargar", examples=["https://youtube.com/watch?v=..."])
    quality: Optional[str] = Field("best", description="Calidad del video (best, 720, 480, 360)")


class VideoResponse(BaseModel):
    task_id: str
    status: str
    message: str


class StatusResponse(BaseModel):
    task_id: str
    status: str
    progress: Optional[str] = None
    filename: Optional[str] = None
    download_url: Optional[str] = None
    error: Optional[str] = None


tasks_store: dict[str, dict[str, Optional[str]]] = {}


def sanitize_url(raw_url: str) -> str:
    """Elimina parámetros de playlist/continuación para forzar descarga de video individual."""
    parsed = urllib.parse.urlparse(raw_url)
    # Filtramos parámetros típicos de listas
    params = urllib.parse.parse_qs(parsed.query)
    clean_params = {
        k: v for k, v in params.items() if k.lower() not in ("list", "index", "next", "prev")
    }
    cleaned_query = urllib.parse.urlencode(clean_params, doseq=True)
    cleaned = parsed._replace(query=cleaned_query)
    return cleaned.geturl()


def download_video(task_id: str, url: str, quality: str) -> None:
    # Marcar como descargando
    tasks_store[task_id]["status"] = "downloading"

    # Sanitizar la URL para evitar errores de listas de reproducción
    safe_url = sanitize_url(url)

    output_template = os.path.join(DOWNLOAD_DIR, f"{task_id}.%(ext)s")

    ydl_opts = {
        "outtmpl": output_template,
        "format": (
            f"bestvideo[height<={quality}]+bestaudio/best[height<={quality}]"
            if quality not in ("best", "audio")
            else "best"
        ),
        "writethumbnail": True,
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "ignoreerrors": True,
    }

    # Opciones específicas para YouTube para evitar listas
    if "youtube" in safe_url:
        ydl_opts["playlistend"] = 1
        ydl_opts["playlist_items"] = "0"

    if quality == "audio":
        ydl_opts["format"] = "bestaudio"
        ydl_opts["postprocessors"] = [
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
        ]

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(safe_url, download=True)
            if not info:
                raise ValueError("No se pudo extraer información del video")

            ext = "mp4"
            if quality == "audio":
                ext = "mp3"

            # Buscar el archivo descargado
            downloaded_file = None
            for f in os.listdir(DOWNLOAD_DIR):
                if f.startswith(task_id) and not f.endswith(".txt") and not f.endswith(".info.json"):
                    downloaded_file = f
                    break

            if downloaded_file:
                tasks_store[task_id]["status"] = "completed"
                tasks_store[task_id]["filename"] = downloaded_file
                tasks_store[task_id]["download_url"] = f"/downloads/{downloaded_file}"
            else:
                # Fallback: intentar construir el nombre esperado
                base = os.path.join(DOWNLOAD_DIR, task_id)
                for suffix in (".mp4", ".webm", ".mkv", ".mp3"):
                    candidate = base + suffix
                    if os.path.exists(candidate):
                        downloaded_file = os.path.basename(candidate)
                        break

                if downloaded_file:
                    tasks_store[task_id]["status"] = "completed"
                    tasks_store[task_id]["filename"] = downloaded_file
                    tasks_store[task_id]["download_url"] = f"/downloads/{downloaded_file}"
                else:
                    raise FileNotFoundError(f"No se encontró el archivo descargado para {task_id}")

    except yt_dlp.utils.DownloadError as exc:
        # Error específico de yt-dlp (video no disponible, error de red, etc.)
        tasks_store[task_id]["status"] = "failed"
        tasks_store[task_id]["error"] = str(exc)
    except Exception as exc:
        # Cualquier otra excepción
        tasks_store[task_id]["status"] = "failed"
        tasks_store[task_id]["error"] = str(exc)


@app.post("/api/download", response_model=VideoResponse)
async def start_download(request: VideoRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    tasks_store[task_id] = {
        "status": "queued",
        "url": request.url,
    }

    background_tasks.add_task(download_video, task_id, request.url, request.quality)

    return VideoResponse(
        task_id=task_id,
        status="queued",
        message="La descarga se ha iniciado en segundo plano.",
    )


@app.get("/api/status/{task_id}", response_model=StatusResponse)
async def get_status(task_id: str):
    if task_id not in tasks_store:
        raise HTTPException(status_code=404, detail="Task no encontrada.")

    task = tasks_store[task_id]

    return StatusResponse(
        task_id=task_id,
        status=task["status"],
        progress=task.get("progress"),
        filename=task.get("filename"),
        download_url=task.get("download_url"),
        error=task.get("error"),
    )


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "video-downloader-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
