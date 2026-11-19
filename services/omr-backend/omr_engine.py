from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Protocol

import pypdfium2 as pdfium


class OmrEngine(Protocol):
    name: str

    def is_available(self) -> bool: ...
    def count_pdf_pages(self, pdf_path: str) -> int: ...
    def convert_page(self, pdf_path: str, page_index: int) -> str: ...


class HomrEngine:
    """PDF -> PNG (pypdfium2) -> MusicXML (homr CLI) OMR engine."""

    name = "homr"

    def is_available(self) -> bool:
        return shutil.which("homr") is not None

    def count_pdf_pages(self, pdf_path: str) -> int:
        pdf = pdfium.PdfDocument(pdf_path)
        try:
            return len(pdf)
        finally:
            pdf.close()

    def convert_page(self, pdf_path: str, page_index: int) -> str:
        if not self.is_available():
            raise RuntimeError(
                "OMR engine 'homr' chưa được cài đặt trong môi trường hiện tại. "
                "Hãy chạy `pip install homr` hoặc dùng Docker image đi kèm."
            )

        with tempfile.TemporaryDirectory(prefix="omr_page_") as tmp_dir:
            img_path = Path(tmp_dir) / f"page_{page_index + 1}.png"
            pdf = pdfium.PdfDocument(pdf_path)
            try:
                page = pdf[page_index]
                bitmap = page.render(scale=200 / 72)
                pil_image = bitmap.to_pil()
                pil_image.save(img_path)
            finally:
                pdf.close()

            proc = subprocess.run(
                ["homr", str(img_path)],
                cwd=tmp_dir,
                capture_output=True,
                text=True,
                timeout=180,
                check=False,
            )
            if proc.returncode != 0:
                raise RuntimeError(f"homr failed on page {page_index + 1}: {proc.stderr.strip()}")

            xml_candidates = list(Path(tmp_dir).glob("*.musicxml")) + list(Path(tmp_dir).glob("*.xml"))
            if not xml_candidates:
                raise RuntimeError(f"homr did not output MusicXML for page {page_index + 1}")
            return xml_candidates[0].read_text(encoding="utf-8")


def default_engine() -> OmrEngine:
    return HomrEngine()
