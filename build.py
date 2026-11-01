#!/usr/bin/env python3
"""Build Dials from its sources. Python 3 standard library only.

Sources (hand-edited):  src/colour.css, src/scale.css, src/base.css, src/fallback.css,
                        presets/{colour,type,space}/*.css, themes.json,
                        the rules section of AGENTS.md
                        src/patterns.md (appended to docs/tokens.md)
Generated source:       src/fallback-flat.css (by tools/fallback.mjs, which needs a browser;
                        --check fails when its recorded hash of src/colour.css is out of date)
Outputs:                dials.css, dials-colour.css, dials-scale.css, dials-base.css,
                        themes/*.css, docs/tokens.md, docs/tokens.json,
                        site/presets.js, site/dials*.css, site/dials-base-demo.css, site/favicon.svg

    python3 build.py           write every output
    python3 build.py --check   exit 1 if any output is stale (writes nothing)
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = "https://github.com/joops/dials"
GROUPS = ["brand", "secondary", "neutral", "success", "warning", "danger", "info"]
KINDS = ["colour", "type", "space"]


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def fail(msg):
    sys.stderr.write("build.py: " + msg + "\n")
    sys.exit(2)


VERSION = json.loads(read("package.json"))["version"]
BANNER = f"/*! Dials v{VERSION} | MIT | {REPO} */\n"


# ---------------------------------------------------------------- CSS parsing

def strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def blocks(css):
    """Top-level rules as (selector, body) pairs. Dials sources have no nesting."""
    out = []
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", strip_comments(css)):
        out.append((" ".join(m.group(1).split()), m.group(2)))
    return out


def decls(body):
    """Custom property declarations in a rule body, in order: [(name, value)]."""
    return [(m.group(1), " ".join(m.group(2).split()))
            for m in re.finditer(r"(--[\w-]+)\s*:\s*([^;]+);", body)]


def first_block(css, selector):
    for sel, body in blocks(css):
        if sel == selector:
            return dict(decls(body))
    fail(f"no '{selector}' block found")


def preset(kind, slug):
    text = read(f"presets/{kind}/{slug}.css")
    m = re.match(r"/\*\s*Dials \w+ preset:\s*(.+?)\n\s*(.*?)\s*\*/", text, re.S)
    if not m:
        fail(f"presets/{kind}/{slug}.css: missing '/* Dials {kind} preset: Name' header")
    name, note = m.group(1).strip(), " ".join(m.group(2).split())
    bl = blocks(text)
    if len(bl) != 1 or bl[0][0] != ":root, :host":
        fail(f"presets/{kind}/{slug}.css: expected one ':root, :host' block")
    return {"name": name, "note": note, "dials": dict(decls(bl[0][1]))}


def load_presets():
    """Every preset, in themes.json's presetOrder (which must list each one)."""
    out, order = {}, json.loads(read("themes.json")).get("presetOrder", {})
    for kind in KINDS:
        files = sorted(f.stem for f in (ROOT / "presets" / kind).glob("*.css"))
        listed = order.get(kind, files)
        if sorted(listed) != files:
            fail(f"themes.json presetOrder.{kind} must list exactly the files in presets/{kind}/: {files}")
        out[kind] = {slug: preset(kind, slug) for slug in listed}
    return out


# ---------------------------------------------------------------- preset rules

COLOUR_REQUIRED = ["--brand", "--secondary", "--success", "--warning", "--danger", "--info", "--grey",
                   "--balance", "--fill-lightness", "--dark-lift", "--tint-strength", "--tint-vividness",
                   "--text-contrast", "--white-text-until",
                   "--paper-lightness", "--paper-dark-lightness", "--ink-lightness", "--ink-dark-lightness"]
COLOUR_OPTIONAL = ["--paper-light", "--paper-dark", "--ink-light", "--ink-dark"]
TYPE_REQUIRED = ["--screen-min", "--screen-max", "--size-min", "--size-max", "--ratio-min", "--ratio-max",
                 "--font-heading", "--font-body", "--font-mono"]
# Unset by default (src/scale.css documents them in comments), so a preset may leave any of them out
TYPE_OPTIONAL = ["--leading-body", "--leading-display", "--tracking-small", "--tracking-display", "--tracking-caps",
                 "--weight-body", "--weight-heading", "--line-length", "--font-accent"]
SPACE_REQUIRED = ["--space-min", "--space-max", "--space-density", "--radius-base"]
REQUIRED = {"colour": (COLOUR_REQUIRED, COLOUR_OPTIONAL), "type": (TYPE_REQUIRED, TYPE_OPTIONAL), "space": (SPACE_REQUIRED, [])}


def validate_presets(presets):
    for kind, items in presets.items():
        req, opt = REQUIRED[kind]
        for slug, p in items.items():
            keys = list(p["dials"])
            missing = [k for k in req if k not in keys]
            extra = [k for k in keys if k not in req + opt]
            if missing or extra:
                fail(f"presets/{kind}/{slug}.css: missing {missing} unexpected {extra}")


def validate_defaults(presets, colour_src, scale_src):
    """dials.css's defaults must be the Hi-Fi house theme: one source, checked here."""
    dc = first_block(colour_src, ":root, :host")
    ds = first_block(scale_src, ":root, :host")
    house = THEMES["hi-fi"]
    for kind, src in (("colour", dc), ("type", ds), ("space", ds)):
        p = presets[kind][house[kind]]["dials"]
        for k, v in p.items():
            if k in COLOUR_OPTIONAL:
                fail(f"the house colour preset must not set {k}: the default derives it from --grey")
            if k in TYPE_OPTIONAL:
                fail(f"the house type preset must not set {k}: dials.css leaves it unset, so v0.2's type stays")
            if src.get(k) != v:
                fail(f"src default {k}: {src.get(k)!r} differs from house preset {house[kind]} ({v!r})")


# ---------------------------------------------------------------- Google Fonts

def gf_table():
    """The playground's list of Google Fonts: {lower name: (name, category, weights)}."""
    m = re.search(r"var GF = (\[.*?\]);\n", read("site/index.html"), re.S)
    if not m:
        fail("could not find the GF font list in site/index.html")
    return {f[0].lower(): f for f in json.loads(m.group(1))}


def face(stack):
    """The web font a stack asks for: its first family, if quoted (else a system stack)."""
    m = re.match(r'\s*"([^"]+)"', stack or "")
    return m.group(1) if m else None


def gf_param(name, table, wanted=(400, 700)):
    f = table.get(name.lower())
    if not f:
        fail(f"font '{name}' is not in the playground's Google Fonts list")
    w = f[2]
    near = lambda t: min(w, key=lambda x: (abs(x - t), x))
    chosen = sorted(set(near(t) for t in wanted)) if len(w) > 1 else []
    return "family=" + f[0].replace(" ", "+") + (":wght@" + ";".join(map(str, chosen)) if len(chosen) > 1 else "")


def face_weights(type_dials):
    """The weights each face is asked for: 400 and 700, plus any weight a preset's type dials set."""
    out = {k: {400, 700} for k in ("--font-heading", "--font-body", "--font-mono", "--font-accent")}
    if "--weight-heading" in type_dials:
        out["--font-heading"].add(int(type_dials["--weight-heading"]))
    if "--weight-body" in type_dials:
        wb = int(type_dials["--weight-body"])
        out["--font-body"] |= {wb, min(900, wb + 200)}   # --weight-strong
    return out


def fonts_link(type_dials, table):
    names, weights = [], face_weights(type_dials)
    for k in ("--font-heading", "--font-body", "--font-mono", "--font-accent"):
        n = face(type_dials.get(k))
        if n and n not in [x[0] for x in names]:
            names.append((n, set(weights[k])))
        elif n:
            dict(names)[n].update(weights[k])
    if not names:
        return None
    return ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
            + "&".join(gf_param(n, table, sorted(w)) for n, w in names) + '&display=swap">')


# ---------------------------------------------------------------- outputs

def header_comment(src, title):
    """Swap the source file's first comment line for the dist file's own title."""
    return re.sub(r"^(/\* =+\n   )Dials: [^\n]*\n", r"\g<1>" + title + "\n", src, count=1)


def dist_files(colour_src, scale_src, base_src, fallback_src, flat_src, house_link):
    colour = header_comment(colour_src, "Dials: colour (dials-colour.css)")
    scale = header_comment(scale_src, "Dials: type and space (dials-scale.css)")
    base = header_comment(base_src, "Dials: base (dials-base.css, optional)")
    intro = ("/* Dials: an AI-first CSS framework. This file is dials-colour.css, then\n"
             "   dials-scale.css, then the fallback for older browsers; dials-base.css is optional.\n"
             "   Default theme: Hi-Fi. Load its faces with:\n   " + house_link + "\n*/\n")
    return {
        "dials-colour.css": BANNER + colour,
        "dials-scale.css": BANNER + scale,
        "dials-base.css": BANNER + base,
        "dials.css": BANNER + intro + colour + scale + fallback_src.strip() + "\n" + flat_src.strip() + "\n",
    }


NO_FALLBACK = [("relative colour", r"\bfrom\s"), ("light-dark()", r"light-dark\("), ("calc()", r"calc\("),
               ("gradient interpolation", r"gradient\(\s*in\s")]


def validate_fallback(fallback_src, flat_src, colour_src, scale_src):
    """The fallback blocks use only what older browsers have, never set a dial, and cover every colour token."""
    rows = documented(colour_src, "dials-colour.css") + documented(scale_src, "dials-scale.css")
    dials = {r["name"] for r in rows if r["kind"] == "dial"} | {"--paper-light", "--paper-dark", "--ink-light", "--ink-dark"} | set(DEPRECATED_DIALS)
    colour_tokens = [r["name"] for r in documented(colour_src, "dials-colour.css") if r["kind"] == "token"]
    for name, src in (("src/fallback.css", fallback_src), ("src/fallback-flat.css", flat_src)):
        body = re.sub(r"@supports[^{]*\{", "", strip_comments(src))
        for what, pat in NO_FALLBACK:
            if re.search(pat, body):
                fail(f"{name} uses {what}, which the browsers it's for don't have")
        declared = {n for _, b in blocks(body) for n, _ in decls(b)}
        if declared & dials:
            fail(f"{name} sets dials {sorted(declared & dials)}: the fallback must leave them to the site")
        want = colour_tokens if name == "src/fallback.css" else [t for t in colour_tokens if t not in ("--solid", "--on-solid", "--soft", "--on-soft", "--line")]
        missing = [t for t in want if t not in declared]
        if missing and not (name == "src/fallback-flat.css" and flat_stale(flat_src, colour_src)):
            fail(f"{name} doesn't declare {missing}")


def flat_stale(flat_src, colour_src):
    m = re.search(r"\(src/colour\.css ([0-9a-f]{16})\)", flat_src)
    return not m or m.group(1) != hashlib.sha256(colour_src.encode("utf-8")).hexdigest()[:16]


def theme_file(key, t, presets, table):
    parts = [(k, presets[k][t[k]]) for k in KINDS]
    link = fonts_link(presets["type"][t["type"]]["dials"], table)
    names = ", ".join(f"{p['name']} {k}" for k, p in parts)
    out = [BANNER.rstrip("\n"),
           f"/* Dials theme: {t['name']}" + (" (the house theme, and dials.css's default)" if key == "hi-fi" else ""),
           f"   Presets: {names} (presets/colour/{t['colour']}.css, presets/type/{t['type']}.css,",
           f"   presets/space/{t['space']}.css). Load after dials.css. This file doesn't set",
           "   color-scheme: the theme works in light and dark, and follows the page's setting.",
           f"   Faces: {link}" if link else "   Faces: system fonts only.",
           "*/",
           ":root, :host {"]
    for k, p in parts:
        out.append(f"  /* {k}: {p['name']} */")
        out += [f"  {n}: {v};" for n, v in p["dials"].items()]
    out.append("}")
    return "\n".join(out) + "\n"


def scoped_base(base_src, scope=".base-demo"):
    """dials-base.css with every rule confined to `scope`, for the playground's demo boxes."""
    out = [f"/* Generated by build.py from src/base.css: the same rules confined to {scope}, so the\n"
           "   playground can show plain HTML without restyling its own page. Don't edit. */"]
    for sel, body in blocks(base_src):
        sels = []
        for s in [x.strip() for x in re.split(r",(?![^()]*\))", sel)]:
            if s == ":where(html)":
                continue
            sels.append(scope if s == ":where(body)" else f"{scope} {s}")
        if sels:
            out.append(", ".join(sels) + " { " + " ".join(body.split()) + " }")
    return "\n".join(out) + "\n"


def agents_rules():
    m = re.search(r"<!-- rules:start -->\n(.*?)<!-- rules:end -->", read("AGENTS.md"), re.S)
    if not m:
        fail("AGENTS.md needs a <!-- rules:start --> ... <!-- rules:end --> section")
    return m.group(1).strip() + "\n"


def presets_js(presets, table, dial_names):
    data = {"version": VERSION, "colour": {}, "type": {}, "space": {}, "themes": {}, "rules": agents_rules(), "dialNames": dial_names}
    for kind in KINDS:
        for slug, p in presets[kind].items():
            data[kind][slug] = {"name": p["name"], "note": p["note"], "dials": p["dials"]}
    for slug, p in presets["type"].items():
        data["type"][slug]["fonts"] = fonts_link(p["dials"], table)
    for key, t in THEMES.items():
        data["themes"][key] = dict(t)
    return ("/* Generated by build.py from presets/, themes.json and AGENTS.md. Don't edit. */\n"
            "window.DIALS = " + json.dumps(data, indent=1, ensure_ascii=False) + ";\n")


# ---------------------------------------------------------------- token reference

GROUP_ROLES = {
    "solid": "a solid fill",
    "on-solid": "text on the solid fill: white or black, whichever contrasts more",
    "soft": "a tinted background",
    "on-soft": "text on the soft tint, and coloured text on the page: 4.5:1 on its soft tint and every surface",
    "line": "borders, icons and large text (24px, or 18.66px bold, and up): 3:1 on its soft tint and every surface",
}
# Old names that still work, with what replaces them. Not declared anywhere: a site may set them.
DEPRECATED_DIALS = {"--accent": "--secondary"}


def documented(src, file):
    """Every declaration with its section and trailing comment, from one source file."""
    rows, section, block = [], "", None
    for line in src.splitlines():
        s = line.strip()
        if re.match(r"^[^/*\s].*\{\s*$", s):
            block = "dial" if s.startswith(":root, :host {") else "token"
        h = re.match(r"/\* -{4} (.+?)(?: -{4} \*/|:?$)", s)
        if h:
            section = h.group(1).rstrip(":. ")
            continue
        u = re.match(r"/\*\s*(--[\w-]+)\s*:\s*(.+?);\s*(.*?)\s*\*/$", s)
        if u and block == "dial":   # an unset dial, documented in a comment with the value used when unset
            rows.append({"name": u.group(1), "kind": "dial", "file": file, "section": section, "unset": True,
                         "default": f"(unset: {u.group(2).strip()})", "description": u.group(3).strip()})
            continue
        m = re.match(r"(--[\w-]+)\s*:\s*(.+?);\s*(?:/\*\s*(.*?)\s*(?:\*/)?)?$", s)
        if m and block and not m.group(1).startswith("--dl-"):
            rows.append({"name": m.group(1), "kind": block, "file": file, "section": section,
                         "default": " ".join(m.group(2).split()), "description": (m.group(3) or "").strip()})
    return rows


def token_reference(colour_src, scale_src):
    rows = documented(colour_src, "dials-colour.css") + documented(scale_src, "dials-scale.css")
    for r in rows:
        g = re.match(r"--(" + "|".join(GROUPS) + r")-(solid|on-solid|soft|on-soft|line)$", r["name"])
        if g:
            r["section"] = "Groups"
            r["description"] = f"{g.group(1)}: {GROUP_ROLES[g.group(2)]}"
            if g.group(1) == "neutral":
                r["description"] = {"solid": "neutral: ink as a fill", "on-solid": "neutral: paper, as text on the ink fill",
                                    "soft": "neutral: a quiet grey background (--surface-lowered)", "on-soft": "neutral: body text (--text)",
                                    "line": "neutral: the default border (--border)"}[g.group(2)]
        if r["name"] in ("--solid", "--on-solid", "--soft", "--on-soft", "--line"):
            r["description"] = f"the current group's {r['name'][2:]}: brand unless an .is-{{group}} class says otherwise"
        if r["name"].startswith("--space-") and r["kind"] == "token":
            r["description"] = r["description"] or "fluid space between its two ends"
        if r["name"].startswith("--size-") and r["kind"] == "token":
            r["description"] = r["description"] or ("body text" if r["name"] == "--size-0" else "a step of the type scale")
    overrides = [{"name": n, "kind": "override", "file": "dials-colour.css", "section": "Paper and ink",
                  "default": "(unset: derived from --grey)", "description": d} for n, d in [
        ("--paper-light", "exact page background in light"), ("--paper-dark", "exact page background in dark"),
        ("--ink-light", "exact strongest text in light"), ("--ink-dark", "exact strongest text in dark")]]
    classes = [{"name": f".is-{g}", "description": f"points --solid, --on-solid, --soft, --on-soft and --line at the {g} group"} for g in GROUPS]
    classes += [{"name": ".is-accent", "description": "deprecated: the old name for .is-secondary, which it still points at"}]
    classes += [{"name": ".is-typeset", "description": "dials-base.css only, opt-in: kerning always on, tabular figures in tables, and text-wrap: pretty on paragraphs, list items and quotes, inside it"},
                {"name": ".is-light", "description": "a light band: color-scheme light, with its own background and text"},
                {"name": ".is-dark", "description": "a dark band: color-scheme dark, with its own background and text"},
                {"name": "[data-dials]", "description": "a scope: dials set on it re-derive every token inside it"}]
    deprecated = [{"name": n, "kind": "deprecated", "file": "dials-colour.css", "section": "Renamed colour dials",
                   "default": "(unset)", "description": f"deprecated: the old name for {new}. While set, it wins over {new}; rename it"}
                  for n, new in DEPRECATED_DIALS.items()]
    data = {"version": VERSION, "dials": [r for r in rows if r["kind"] == "dial"], "overrides": overrides, "deprecated": deprecated,
            "tokens": [r for r in rows if r["kind"] == "token"], "classes": classes}

    def cell(x):
        return x.replace("|", "\\|")

    md = [f"# Dials v{VERSION}: token reference", "",
          "Generated by `build.py` from `src/colour.css`, `src/scale.css` and `src/patterns.md`; don't edit. Machine-readable copy: [`tokens.json`](tokens.json).", "",
          f"This is the reference for Dials v{VERSION}. Names can change between versions: for another one, read this file at its tag, `{REPO}/blob/vX.Y.Z/docs/tokens.md` (the version is in the first line of `dials.css`).", "",
          "**Dials** are the inputs: set them at `:root`, in your own file loaded after `dials.css`, or on a `[data-dials]` element to re-theme part of a page. "
          "**Tokens** are worked out from the dials: use them, never set them. Internal plumbing is prefixed `--dl-` and isn't listed: don't use it.", ""]
    for title, items, intro in [("Dials", data["dials"], None), ("Optional exact colours", overrides, "Unset by default. Set any of them to use an exact colour instead of the one derived from `--grey`."),
                                ("Deprecated dials", deprecated, "Old names that still work in this release. Rename them: they'll be removed in a later one."), ("Tokens", data["tokens"], None)]:
        md += [f"## {title}", ""]
        if intro:
            md += [intro, ""]
        section = None
        for r in items:
            if r["section"] != section:
                section = r["section"]
                md += [f"### {section}", "", "| Name | Default | What it is |", "|---|---|---|"]
            shown = r["default"] if r["kind"] != "token" or len(r["default"]) <= 48 else "derived: see tokens.json"
            md.append(f"| `{r['name']}` | `{cell(shown)}` | {cell(r['description'])} |")
            if r is items[-1] or items[items.index(r) + 1]["section"] != section:
                md.append("")
    md += ["## Classes", "", "| Class | What it does |", "|---|---|"]
    md += [f"| `{c['name']}` | {c['description']} |" for c in classes]
    md += ["", read("src/patterns.md").strip()]
    return "\n".join(md) + "\n", json.dumps(data, indent=2, ensure_ascii=False) + "\n"


# ---------------------------------------------------------------- main

THEMES = json.loads(read("themes.json"))["themes"]


def build():
    colour_src, scale_src, base_src = read("src/colour.css"), read("src/scale.css"), read("src/base.css")
    fallback_src, flat_src = read("src/fallback.css"), read("src/fallback-flat.css")
    presets = load_presets()
    validate_presets(presets)
    for key, t in THEMES.items():
        for k in KINDS:
            if t[k] not in presets[k]:
                fail(f"themes.json: {key} names a missing {k} preset '{t[k]}'")
    validate_defaults(presets, colour_src, scale_src)
    validate_fallback(fallback_src, flat_src, colour_src, scale_src)
    table = gf_table()
    house_link = fonts_link(presets["type"][THEMES["hi-fi"]["type"]]["dials"], table)

    out = dist_files(colour_src, scale_src, base_src, fallback_src, flat_src, house_link)
    for name in list(out):
        out["site/" + name] = out[name]
    for key, t in THEMES.items():
        out[f"themes/{key}.css"] = theme_file(key, t, presets, table)
    out["site/dials-base-demo.css"] = scoped_base(base_src)
    out["site/favicon.svg"] = (ROOT / "brand/mark/favicon.svg").read_text()
    rows = documented(colour_src, "dials-colour.css") + documented(scale_src, "dials-scale.css")
    out["site/presets.js"] = presets_js(presets, table, [r["name"] for r in rows if r["kind"] in ("dial", "override")])
    out["docs/tokens.md"], out["docs/tokens.json"] = token_reference(colour_src, scale_src)
    return out, flat_stale(flat_src, colour_src)


def main():
    check = "--check" in sys.argv[1:]
    out, flat_is_stale = build()
    stale = [p for p, text in out.items()
             if not (ROOT / p).exists() or (ROOT / p).read_text(encoding="utf-8") != text]
    orphans = [str(f.relative_to(ROOT)) for f in (ROOT / "themes").glob("*.css") if f"themes/{f.name}" not in out]
    if check:
        if stale or orphans or flat_is_stale:
            for p in stale:
                print(f"stale: {p}")
            for p in orphans:
                print(f"not generated (remove it, or add it to themes.json): {p}")
            if flat_is_stale:
                print("stale: src/fallback-flat.css (src/colour.css changed). Run: python3 build.py && node tools/fallback.mjs && python3 build.py")
            print("Run: python3 build.py")
            sys.exit(1)
        print(f"build.py --check: {len(out)} generated files are up to date (v{VERSION})")
        return
    for p in stale:
        f = ROOT / p
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(out[p], encoding="utf-8")
        print(f"wrote {p}")
    for p in orphans:
        print(f"warning: {p} isn't in themes.json")
    print(f"{len(stale)} of {len(out)} files changed (v{VERSION})")
    if flat_is_stale:
        print("warning: src/fallback-flat.css is stale (src/colour.css changed). Now run: node tools/fallback.mjs && python3 build.py")


if __name__ == "__main__":
    main()
