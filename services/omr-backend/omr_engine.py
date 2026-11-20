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
                page_w, _page_h = page.get_size()
                # Normalize render width to ~1650px (200 DPI A4) so huge MuseScore viewBoxes (e.g. 9921pt)
                # never blow up memory or crash OpenCV/homr.
                scale = 1650.0 / max(1.0, float(page_w))
                scale = max(0.05, min(4.0, scale))
                bitmap = page.render(scale=scale)
                pil_image = bitmap.to_pil()
                pil_image.save(img_path)
            finally:
                pdf.close()

            proc = subprocess.run(
                ["homr", str(img_path)],
                cwd=tmp_dir,
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
            if proc.returncode != 0:
                combined = "\n".join(
                    line
                    for line in (proc.stderr + "\n" + proc.stdout).replace("\r", "\n").splitlines()
                    if line.strip() and not line.strip().startswith("Downloaded ")
                )
                tail = combined[-1000:] if combined else proc.stderr.strip()[-1000:]
                raise RuntimeError(f"homr failed on page {page_index + 1}: {tail}")

            xml_candidates = list(Path(tmp_dir).glob("*.musicxml")) + list(Path(tmp_dir).glob("*.xml"))
            if not xml_candidates:
                raise RuntimeError(f"homr did not output MusicXML for page {page_index + 1}")
            return xml_candidates[0].read_text(encoding="utf-8")


def default_engine() -> OmrEngine:
    return HomrEngine()
