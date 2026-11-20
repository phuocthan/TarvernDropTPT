from pathlib import Path
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE

name="Tavern-Drop-M1-Asset-Review-Checklist.docx"
doc=Document(Path("output/documents") / name)
old="e5af4d1a39fbf3d8f9fcb14d988282f86e17dd72"
new="482c94a78c88233b0809fce7918bb64820c1e03a"
for relationship in doc.part.rels.values():
    if relationship.reltype==RELATIONSHIP_TYPE.HYPERLINK and old in relationship.target_ref:
        relationship._target=relationship.target_ref.replace(old,new)

row=next(p for p in doc.paragraphs if p.text.startswith("Open Asset Viewer"))
row.add_run("  ·  ")
rel=row.part.relate_to("https://slotdemo.up.railway.app/", RELATIONSHIP_TYPE.HYPERLINK, is_external=True)
link=OxmlElement("w:hyperlink")
link.set(qn("r:id"),rel)
run=OxmlElement("w:r")
props=OxmlElement("w:rPr")
for tag,value in (("color","146568"),("u","single")):
    item=OxmlElement("w:"+tag)
    item.set(qn("w:val"),value)
    props.append(item)
run.append(props)
label=OxmlElement("w:t")
label.text="Play Tavern Drop"
run.append(label)
link.append(run)
row._p.append(link)
p=next(p for p in doc.paragraphs if p.text.startswith("How to review"))
p.add_run(" Open the playable progress build to see assets in the 5×5 game with demo credits.")
doc.save(Path("tmp/docs/m1-viewer-update") / name)

