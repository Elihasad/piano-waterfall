import time
from fastapi.testclient import TestClient
from app import create_app

SAMPLE_PAGE_XML = """<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>"""


class FakeOmrEngine:
    name = "fake-homr"

    def is_available(self) -> bool:
        return True

    def count_pdf_pages(self, pdf_path: str) -> int:
        return 2

    def convert_page(self, pdf_path: str, page_index: int) -> str:
        return SAMPLE_PAGE_XML


def test_health_and_async_pdf_job_lifecycle():
    app = create_app(engine=FakeOmrEngine())
    client = TestClient(app)

    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert health.json()["engine"] == "fake-homr"

    # Reject non-PDF
    bad = client.post("/api/jobs", files={"file": ("song.txt", b"hello", "text/plain")})
    assert bad.status_code == 400

    # Accept PDF and process asynchronously
    res = client.post(
        "/api/jobs",
        files={"file": ("weight.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")},
    )
    assert res.status_code == 200
    payload = res.json()
    job_id = payload["jobId"]
    assert payload["totalPages"] == 2

    # Poll until done
    status_data = None
    for _ in range(30):
        poll = client.get(f"/api/jobs/{job_id}")
        assert poll.status_code == 200
        status_data = poll.json()
        if status_data["status"] in ("done", "error"):
            break
        time.sleep(0.05)

    assert status_data is not None
    assert status_data["status"] == "done"
    assert "<score-partwise" in status_data["musicxml"]

    # Cancel/delete endpoint cleans up
    del_res = client.delete(f"/api/jobs/{job_id}")
    assert del_res.status_code == 200
