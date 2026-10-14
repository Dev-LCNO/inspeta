#!/usr/bin/env python3
"""Gera tokens.css (custom properties + tema do Tailwind v4) a partir de tokens.json.
Fonte da verdade = tokens.json. Rode depois de qualquer mudança (inclusive o rebrand):

    python3 build_tokens.py && python3 contrast.py tokens.json
"""
import json
import pathlib

here = pathlib.Path(__file__).parent
t = json.loads((here / "tokens.json").read_text(encoding="utf-8"))

def colors(mode):
    return {k: v for k, v in t["color"][mode].items() if not k.startswith("_")}

def var_block(mode):
    return "\n".join(f"  --c-{k}: {v};" for k, v in colors(mode).items())

light, dark = var_block("light"), var_block("dark")

lines = []
lines.append("/* GERADO por build_tokens.py a partir de tokens.json — não edite à mão. */\n")
lines.append(":root {\n  color-scheme: light;\n" + light)
lines.append(f'  --font-sans: {t["font"]["sans"]};')
lines.append(f'  --font-mono: {t["font"]["mono"]};')
for k, v in t["type"].items():
    lines.append(f"  --text-{k}: {v['size']/16:.4g}rem;")
    lines.append(f"  --text-{k}--line-height: {v['line']/16:.4g}rem;")
    lines.append(f"  --text-{k}--font-weight: {v['weight']};")
for v in t["space"]:  # --space-N = N × 4px (escala do Tailwind)
    lines.append(f"  --space-{v // 4}: {v}px;")
for k, v in t["radius"].items():
    lines.append(f"  --radius-{k}: {v}px;")
for k, v in t["border-width"].items():
    lines.append(f"  --bw-{k}: {v}px;")
for k, v in t["shadow"].items():
    lines.append(f"  --shadow-{k}: {v};")
for k, v in t["motion"].items():
    if not k.startswith("_"):
        lines.append(f"  --motion-{k}: {v};")
for k, v in t["touch"].items():
    if not k.startswith("_"):
        lines.append(f"  --touch-{k}: {v}px;")
for k, v in t["layout"].items():
    if isinstance(v, (int, float)):
        lines.append(f"  --layout-{k}: {v}px;")
for k, v in t["z"].items():
    lines.append(f"  --z-{k}: {v};")
lines.append("}\n")

dark_block = "  color-scheme: dark;\n" + dark
lines.append("/* modo escuro: segue o sistema, a menos que o usuário force claro */")
lines.append("@media (prefers-color-scheme: dark) {\n  :root:not([data-theme=\"light\"]) {\n"
             + "\n".join("  " + l for l in dark_block.splitlines()) + "\n  }\n}")
lines.append(":root[data-theme=\"dark\"] {\n" + dark_block + "\n}\n")

lines.append("@media (prefers-reduced-motion: reduce) {\n  :root { --motion-fast: 0ms; --motion-base: 0ms; }\n}\n")

# Tailwind v4: expõe os tokens como utilitários (bg-surface, text-muted, rounded-md…)
theme = ["/* Tailwind v4 — importe este arquivo depois de @import \"tailwindcss\"; */", "@theme inline {"]
for k in colors("light"):
    theme.append(f"  --color-{k}: var(--c-{k});")
theme.append("  --font-sans: var(--font-sans);")
theme.append("  --font-mono: var(--font-mono);")
for k in t["type"]:
    theme.append(f"  --text-{k}: var(--text-{k});")
    theme.append(f"  --text-{k}--line-height: var(--text-{k}--line-height);")
for k in t["radius"]:
    theme.append(f"  --radius-{k}: var(--radius-{k});")
for k in t["shadow"]:
    theme.append(f"  --shadow-{k}: var(--shadow-{k});")
theme.append("  --spacing: 4px;")
theme.append("}")

(here / "tokens.css").write_text("\n".join(lines) + "\n", encoding="utf-8")
(here / "tailwind-theme.css").write_text("\n".join(theme) + "\n", encoding="utf-8")
print("tokens.css e tailwind-theme.css gerados:", len(colors("light")), "cores x 2 modos")
