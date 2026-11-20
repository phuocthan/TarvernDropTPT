from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, Preformatted, SimpleDocTemplate, Spacer, Table, TableStyle

output = Path("tmp/docs/m1-viewer-update/Tavern-Drop-M1-Delivery-Report.pdf")
fonts = Path("C:/Windows/Fonts")
for name, filename in [("Segoe", "segoeui.ttf"), ("Segoe Bold", "segoeuib.ttf"), ("Consolas", "consola.ttf")]:
    pdfmetrics.registerFont(TTFont(name, str(fonts / filename)))
pdfmetrics.registerFontFamily("Segoe", normal="Segoe", bold="Segoe Bold")

ink = "#162739"
muted = "#42576B"
accent = "#146568"
line = colors.HexColor("#D9E4EA")
paper = colors.HexColor("#F0F6F8")
dark = colors.HexColor("#20354B")
width = A4[0] - 100
repo = "https://gitlab.com/game-studio9172445/slot-client"
revision = "e5af4d1a39fbf3d8f9fcb14d988282f86e17dd72"
mr = repo + "/-/merge_requests/1"

def file_url(path):
    return f"{repo}/-/blob/{revision}/{path}"

def link(label, url):
    return f'<link href="{escape(url)}" color="{accent}"><u>{escape(label)}</u></link>'

def style(name, size, leading, color=ink, font="Segoe", **settings):
    return ParagraphStyle(name, fontName=font, fontSize=size, leading=leading,
                          textColor=colors.HexColor(color), **settings)

eyebrow = style("eyebrow", 9, 13, accent, "Segoe Bold", spaceAfter=6)
title = style("title", 30, 34, ink, "Segoe Bold", spaceAfter=8)
intro = style("intro", 11.1, 15.5, muted, spaceAfter=13)
heading = style("heading", 14, 18, ink, "Segoe Bold", spaceBefore=15, spaceAfter=5)
body = style("body", 10, 14, spaceAfter=6)
cell = style("cell", 9.6, 13.2)
label = style("label", 9.6, 13.2, ink, "Segoe Bold")
column_head = style("column_head", 9.5, 13, "#FFFFFF", "Segoe Bold")
code = style("code", 9, 13, ink, "Consolas")

def p(value, variant=body):
    return Paragraph(value, variant)

def table(rows, headers=None, key_width=128):
    data = [[p(a, label), p(b, cell)] for a, b in rows]
    if headers:
        data.insert(0, [p(h, column_head) for h in headers])
    first_data = 1 if headers else 0
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, first_data), (-1, -1), [paper, colors.white]),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, line),
    ]
    if headers:
        commands.append(("BACKGROUND", (0, 0), (-1, 0), dark))
    return Table(data, colWidths=[key_width, width - key_width], hAlign="LEFT",
                 style=TableStyle(commands))

def command_box(commands):
    return Table([[Preformatted(commands, code)]], colWidths=[width], hAlign="LEFT",
                 style=TableStyle([
                     ("BACKGROUND", (0, 0), (-1, -1), paper),
                     ("LEFTPADDING", (0, 0), (-1, -1), 10),
                     ("TOPPADDING", (0, 0), (-1, -1), 7),
                     ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                 ]))

def footer(canvas, doc):
    canvas.setTitle("Tavern Drop | Milestone 1 Delivery Report")
    canvas.setAuthor("Than")
    canvas.setSubject("First runnable client, verification, and Team A API review")
    canvas.setStrokeColor(line)
    canvas.line(50, 43, A4[0] - 50, 43)
    canvas.setFont("Segoe", 8.5)
    canvas.setFillColor(colors.HexColor(muted))
    canvas.drawString(50, 28, "Tavern Drop  /  Milestone 1")
    canvas.drawRightString(A4[0] - 50, 28, f"{doc.page} / 2")

story = [
    p("TAVERN DROP CLIENT   /   19 NOVEMBER 2026", eyebrow),
    p("Milestone 1 Delivery Report", title),
    p("The first runnable TypeScript/PixiJS client is ready for review in GitLab. "
      "This submission covers the reusable core, recorded demo playback, the asset "
      "integration foundation, and the API proposal for Team A.", intro),
    table([
        ("Review", link("GitLab Draft MR !1", mr) + " · feat/than-m1-client-core → main"),
        ("Reviewed revision", link(revision, repo + "/-/commit/" + revision)),
        ("Approved starting point", link("880a75e406d3a28c03dfa39b3ead93d1a4b4a13b",
                                         repo + "/-/commit/880a75e406d3a28c03dfa39b3ead93d1a4b4a13b")),
    ], key_width=140),
    p("What was delivered", heading),
    table([
        ("Reusable client core", "One fw-pixi controller and reel renderer power both grid sizes. "
         "Playback, layout, timing, resource lifecycle and amount formatting are shared. "
         "Tavern Drop configuration and Spine bindings live in the game module."),
        ("Recorded playback", "The 5×5 demo uses the seed’s synthetic TST fixture and the 3×3 demo uses a "
         "recorded KRW loss. Both use placeholder symbols and support replay, skip and reload "
         "from the browser’s local presentation checkpoint."),
        ("Asset integration", "The game module includes a 71-file candidate asset inventory with provenance and "
         "hashes, Spine bindings and a compatibility probe. Reviewers can preview individual Spine clips, "
         "full-size images and sound cues online. " +
         link("Open Asset Viewer", "https://slotdemo.up.railway.app/?game=viewer") + "  ·  " +
         link("Viewer guide", file_url("games/slot-001/client/than/IMPLEMENTATION.md#preview-assets-online"))),
        ("Build profiles", "The mock build runs recorded examples. The production build exports fw-pixi.js "
         "and an integration entry for the future adapter. Reproducible checks record the lockfile "
         "and artifact hashes. " + link("Build verification", file_url("docs/than/BUILD_VERIFICATION.json"))),
    ], headers=("Area", "Delivered work")),
    p("Review individual assets online", heading),
    p("In Spine Player, select a skeleton and animation. In Images, open a thumbnail at full size. "
      "In Sound Sprite, choose a cue and click Play. When leaving feedback, include the clip, image or cue name."),
    p("Verification completed", heading),
    p("All 42 seed tests, 6 core unit tests and 2 Chromium playback/reload tests passed. "
      "A clean dependency install, both build profiles and verification of all 69 seed files passed. "
      "The 22 original v2 examples were preserved."),
    p("A separate run with the local asset pack exercised 8 Spine skeletons and 141 clips, loaded the font "
      "and checked 66 OGG cue ranges and non-silent decoded audio. " +
      link("M1 test evidence", file_url("docs/than/M1_EVIDENCE.md"))),
    PageBreak(),
    p("TAVERN DROP CLIENT   /   REVIEW GUIDE", eyebrow),
    p("Run and review", title),
    p("Check out the Draft MR branch. Use Node.js 22.18 or later and run the following from the repository root.", body),
    command_box("cd apps/player-web/than\nnode tools/verify-delivery.mjs\nnpm ci\nnpm test\nnpm run dev"),
    Spacer(1, 6),
    p(link("Open 5×5 demo", "http://127.0.0.1:4361/mock.html") + "  ·  " +
      link("Open 3×3 demo", "http://127.0.0.1:4361/mock.html?game=3x3") + "  ·  " +
      link("Setup and browser test guide", file_url("docs/than/START_HERE.md"))),
    p("API proposal for Team A", heading),
    p("The draft separates released results from completed presentation checkpoints, "
      "and running Total Win from confirmed wallet balance. Amounts in the KRW examples "
      "use whole won. The proposal covers one settlement per paid round and server-side "
      "closure after 30 days of inactivity. " +
      link("Detailed API draft", file_url("contracts/player-draft-v2/than/krw-review/API.md")) + "  ·  " +
      link("Four mock request/response sequences",
           file_url("contracts/player-draft-v2/than/krw-review/m1-api-review-sequences.json"))),
    table([
        ("Normal win and loss", "Records a win and a loss, and shows the stored result after interruption."),
        ("Lost paid response", "Recovers the original round after reconnect without a second debit."),
        ("Free spin and chest recovery", "Recovers the released spin and resumes the first unconfirmed chest. "
         "Shows idempotent checkpoints across two tabs and reveals each chest in order."),
        ("30-day expiry", "Covers server closure, uncertain payment, confirmed final summary and retry of summary dismissal."),
    ], key_width=142),
    p("Open items for milestone review", heading),
    p("<b>Assets and devices.</b> The hosted viewer supports per-asset review. Confirm which pack and files are "
      "permitted, then review a recording of integrated 5×5 playback with sound and check target devices. "
      "Required runtime asset blockers must be resolved for M1 acceptance."),
    p("<b>API mapping.</b> Agree the versioned v2 adapter with Team A, including wager identity, released-step "
      "and presentation checkpoints, and wallet confirmation. The current normal-spin example closes on the "
      "server without a presentation signal. Align it with the agreed payment after presentation before live integration."),
    p("<b>Acceptance.</b> The Draft MR is the review submission. Full game delivery and live API integration "
      "follow the agreed milestone scope. " + link("M1 acceptance criteria", file_url("docs/M1_ACCEPTANCE.md"))),
]

doc = SimpleDocTemplate(str(output), pagesize=A4, leftMargin=44, rightMargin=44,
                        topMargin=43, bottomMargin=56)
doc.build(story, onFirstPage=footer, onLaterPages=footer)

