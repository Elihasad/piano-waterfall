from __future__ import annotations

import os
import tempfile
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from musicxml_stitcher import stitch_musicxml_pages
from omr_engine import OmrEngine, default_engine


@dataclass
class JobState:
    job_id: str
    title: str
    pdf_path: str
    total_pages: int
    current_page: int = 0
    status: str = "queued"  # queued | processing | done | error | cancelled
    musicxml: Optional[str] = None
    error: Optional[str] = None
    cancelled: bool = False


def create_app(engine: Optional[OmrEngine] = None) -> FastAPI:
    omr = engine or default_engine()
    app = FastAPI(title="Piano Waterfall OMR Backend", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    jobs: dict[str, JobState] = {}
    lock = threading.Lock()
    executor = ThreadPoolExecutor(max_workers=2)

    def run_job(job_id: str) -> None:
        with lock:
            job = jobs.get(job_id)
            if not job or job.cancelled:
                return
            job.status = "processing"

        page_xmls: list[str] = []
        try:
            for idx in range(job.total_pages):
                with lock:
                    if job.cancelled:
                        job.status = "cancelled"
                        return
                    job.current_page = idx + 1

                xml = omr.convert_page(job.pdf_path, idx)
                page_xmls.append(xml)

            stitched = stitch_musicxml_pages(page_xmls, title=job.title)
            with lock:
                if job.cancelled:
                    job.status = "cancelled"
                    return
                job.musicxml = stitched
                job.status = "done"
        except Exception as exc:  # noqa: BLE001
            with lock:
                if job.cancelled:
                    job.status = "cancelled"
                else:
                    job.error = str(exc)
                    job.status = "error"
        finally:
            try:
                if os.path.exists(job.pdf_path):
                    os.remove(job.pdf_path)
            except OSError:
                pass

    @app.get("/api/health")
    def health():
        return {
            "status": "ok",
            "engine": omr.name,
            "available": omr.is_available(),
        }

    @app.post("/api/jobs")
    async def create_job(file: UploadFile = File(...)):
        filename = file.filename or "score.pdf"
        if not filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported.")

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded PDF is empty.")

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", prefix="omr_upload_")
        tmp.write(content)
        tmp.close()

        try:
            total_pages = omr.count_pdf_pages(tmp.name)
        except Exception as exc:  # noqa: BLE001
            os.remove(tmp.name)
            raise HTTPException(status_code=400, detail=f"Invalid PDF file: {exc}") from exc

        if total_pages <= 0:
            os.remove(tmp.name)
            raise HTTPException(status_code=400, detail="PDF has 0 pages.")

        job_id = uuid.uuid4().hex[:12]
        title = Path(filename).stem
        job = JobState(
            job_id=job_id,
            title=title,
            pdf_path=tmp.name,
            total_pages=total_pages,
        )
        with lock:
            jobs[job_id] = job

        executor.submit(run_job, job_id)
        return {"jobId": job_id, "totalPages": total_pages}

    @app.get("/api/jobs/{job_id}")
    def get_job(job_id: str):
        with lock:
            job = jobs.get(job_id)
            if not job:
                raise HTTPException(status_code=404, detail="Job not found.")
            return {
                "jobId": job.job_id,
                "status": job.status,
                "currentPage": job.current_page,
                "totalPages": job.total_pages,
                "musicxml": job.musicxml if job.status == "done" else None,
                "error": job.error,
            }

    @app.delete("/api/jobs/{job_id}")
    def cancel_job(job_id: str):
        with lock:
            job = jobs.get(job_id)
            if not job:
                raise HTTPException(status_code=404, detail="Job not found.")
            job.cancelled = True
            if job.status in ("queued", "processing"):
                job.status = "cancelled"
        return {"status": "cancelled"}

    return app


app = create_app()
