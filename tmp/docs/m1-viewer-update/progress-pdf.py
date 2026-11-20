from pathlib import Path
qa=Path("tmp/docs/m1-viewer-update")
script=(qa/"pdf.py").read_text(encoding="utf-8-sig")
old="e5af4d1a39fbf3d8f9fcb14d988282f86e17dd72"
new="482c94a78c88233b0809fce7918bb64820c1e03a"
script=script.replace(old,new)
marker='    p("What was delivered", heading),'
assert script.count(marker)==1
script=script.replace(marker, '''    p("Playable full-game progress build", heading),
    p("Open the hosted 5×5 preview to try base spins and the Tavern and Drop bonuses. "
      "Follow the free spins and Total Win, including chest reveals in Drop rounds that unlock them. "
      "The hosted preview uses a mock API and demo credits. " +
      link("Play Tavern Drop", "https://slotdemo.up.railway.app/")),
''' + marker)
script=script.replace("spaceBefore=15, spaceAfter=5", "spaceBefore=10, spaceAfter=4").replace("topMargin=43, bottomMargin=56", "topMargin=39, bottomMargin=50").replace("spaceAfter=13", "spaceAfter=10").replace("spaceAfter=6)", "spaceAfter=5)")
exec(compile(script,"report", "exec"))


