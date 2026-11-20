from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE

folder = Path("tmp/docs/m1-viewer-update")
name = "Tavern-Drop-M1-Asset-Review-Checklist.docx"
doc = Document(Path("output/documents") / name)
old = "62b9f2a0fc43533d7237429671311c8deb1f223c"
new = "e5af4d1a39fbf3d8f9fcb14d988282f86e17dd72"
for relationship in doc.part.rels.values():
    if relationship.reltype == RELATIONSHIP_TYPE.HYPERLINK and old in relationship.target_ref:
        relationship._target = relationship.target_ref.replace(old, new)

intro = next(p for p in doc.paragraphs if p.text.startswith("Please confirm"))
intro.text = ("Use the online viewer to review individual Tavern Drop assets, then confirm the "
              "runtime pack and permissions for M1. You can review the viewer in your browser without local setup.")

link_row = next(p for p in doc.paragraphs if "Draft MR !1" in p.text)
rel = link_row.part.relate_to("https://slotdemo.up.railway.app/?game=viewer",
                              RELATIONSHIP_TYPE.HYPERLINK, is_external=True)
link = OxmlElement("w:hyperlink")
link.set(qn("r:id"), rel)
run = OxmlElement("w:r")
props = OxmlElement("w:rPr")
for tag, value in (("color","146568"), ("u","single"), ("b","true")):
    item = OxmlElement("w:" + tag)
    item.set(qn("w:val"), value)
    props.append(item)
run.append(props)
text = OxmlElement("w:t")
text.text = "Open Asset Viewer"
run.append(text)
link.append(run)
separator = link_row.add_run("  ·  ")
link_row._p.remove(separator._r)
offset = 1 if link_row._p.pPr is not None else 0
link_row._p.insert(offset, link)
link_row._p.insert(offset + 1, separator._r)

section = next(p for p in doc.paragraphs if p.text == "What has been checked")
instructions = section.insert_paragraph_before()
instructions.add_run("How to review. ").bold = True
instructions.add_run("In Spine Player, select a skeleton and animation. In Images, open a thumbnail at full size. "
                     "In Sound Sprite, select a cue and click Play. Include the clip, image or cue name in your feedback.")

p = next(p for p in doc.paragraphs if p.text.startswith("Inventory than-runtime-assets-v1"))
p.text = ("The inventory lists 71 candidate files with source and SHA-256. The asset pack is held outside "
          "the GitLab checkout, which runs the recorded demos with placeholder symbols.")
doc.save(folder / name)

