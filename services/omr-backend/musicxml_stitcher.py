from __future__ import annotations

import copy
import xml.etree.ElementTree as ET


def stitch_musicxml_pages(page_xmls: list[str], title: str = "Converted PDF") -> str:
    """Combine multiple single-page score-partwise MusicXML documents into one score.

    Renumbers measures sequentially across pages while keeping the first page's
    part-list and initial attributes intact.
    """
    valid_roots: list[ET.Element] = []
    for raw in page_xmls:
        text = raw.strip()
        if not text:
            continue
        root = ET.fromstring(text)
        if root.tag == "score-partwise":
            valid_roots.append(root)

    if not valid_roots:
        raise ValueError("No valid score-partwise MusicXML pages to stitch.")

    base = copy.deepcopy(valid_roots[0])

    # Ensure <work><work-title> is set cleanly
    work_el = base.find("work")
    if work_el is None:
        work_el = ET.Element("work")
        base.insert(0, work_el)
    title_el = work_el.find("work-title")
    if title_el is None:
        title_el = ET.SubElement(work_el, "work-title")
    title_el.text = title

    base_parts = base.findall("part")
    if not base_parts:
        raise ValueError("First MusicXML page has no <part> elements.")

    # Append measures from subsequent pages into corresponding parts
    for page_root in valid_roots[1:]:
        page_parts = page_root.findall("part")
        for idx, base_part in enumerate(base_parts):
            if idx >= len(page_parts):
                continue
            for measure in page_parts[idx].findall("measure"):
                base_part.append(copy.deepcopy(measure))

    # Renumber measures sequentially (1..N) in every part
    for part in base_parts:
        for m_idx, measure in enumerate(part.findall("measure"), start=1):
            measure.set("number", str(m_idx))

    xml_bytes = ET.tostring(base, encoding="utf-8", xml_declaration=True)
    return xml_bytes.decode("utf-8")
