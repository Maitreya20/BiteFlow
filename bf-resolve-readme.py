from pathlib import Path
import re

root = Path.cwd()
readme = root / "README.md"
if not readme.exists():
    raise SystemExit("README.md not found")

text = readme.read_text(encoding="utf-8")

pattern = re.compile(
    r"<<<<<<< [^\n]*\n(.*?)\n=======\n(.*?)\n>>>>>>>[^\n]*\n",
    re.S,
)

count = 0

def merge_block(match: re.Match) -> str:
    global count
    count += 1
    ours = match.group(1).splitlines()
    theirs = match.group(2).splitlines()
    # Prefer ours when it is non-empty and feels more complete.
    chosen = ours if ours and len("".join(ours)) >= len("".join(theirs)) else theirs
    return "".join(chosen)

resolved = pattern.sub(merge_block, text)
readme.write_text(resolved, encoding="utf-8")
print(f"Resolved {count} conflict block(s) in README.md")
