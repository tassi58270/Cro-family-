"""Applies French typography to messages/fr.json: narrow no-break space before
; : ! ? and no-break spaces inside « ». Run after editing French texts."""
import json, re, sys

path = sys.argv[1] if len(sys.argv) > 1 else "messages/fr.json"
data = json.load(open(path, encoding="utf-8"))

def fix(value: str) -> str:
    value = re.sub(r"[  ]+([;:!?])", " \\1", value)
    value = re.sub(r"«[   ]*", "« ", value)
    value = re.sub(r"[   ]*»", " »", value)
    return value

def walk(node):
    for key, value in node.items():
        if isinstance(value, dict):
            walk(value)
        else:
            node[key] = fix(value)

walk(data)
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")
