import xml.etree.ElementTree as ET
from musicxml_stitcher import stitch_musicxml_pages

PAGE_1 = """<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
    <measure number="2">
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>"""

PAGE_2 = """<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
    <measure number="2">
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>"""


def test_stitch_musicxml_pages_renumbers_measures_sequentially():
    stitched = stitch_musicxml_pages([PAGE_1, PAGE_2], title="Multi Page Piece")
    root = ET.fromstring(stitched)
    assert root.tag == "score-partwise"
    work_title = root.find("./work/work-title")
    assert work_title is not None and work_title.text == "Multi Page Piece"
    measures = root.findall("./part/measure")
    assert len(measures) == 4
    assert [m.attrib["number"] for m in measures] == ["1", "2", "3", "4"]
