"""Generate the Dials brand SVGs with the lettering as outlines.
Usage: brand_gen.py <fonts dir> <out dir>"""
import math, sys, os, io
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONTS, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT + '/mark', exist_ok=True); os.makedirs(OUT + '/logo', exist_ok=True)

def load(path, wght=None):
    tt = TTFont(path)
    if wght is not None:
        tt = instancer.instantiateVariableFont(tt, {'wght': wght})
    buf = io.BytesIO(); tt.save(buf); data = buf.getvalue()
    return tt, hb.Font(hb.Face(data))

AW_TT, AW = load(f'{FONTS}/Audiowide-Regular.ttf')

def text_path(tt, hbfont, text, size, x, baseline, tracking_em=0.0):
    """Shape text with HarfBuzz and return (svg path d, advance width, top, bottom)."""
    upem = tt['head'].unitsPerEm; scale = size / upem
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(hbfont, buf, {'kern': True, 'liga': True})
    gs = tt.getGlyphSet(); order = tt.getGlyphOrder()
    pen = SVGPathPen(gs); cx = x
    top, bottom = baseline, baseline
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        ox = cx + pos.x_offset * scale; oy = baseline - pos.y_offset * scale
        tp = TransformPen(pen, (scale, 0, 0, -scale, ox, oy))
        gs[name].draw(tp)
        # glyph bounds for vertical placement
        g = tt['glyf'][name] if 'glyf' in tt else None
        if g is not None and hasattr(g, 'yMax') and g.numberOfContours:
            top = min(top, oy - g.yMax * scale); bottom = max(bottom, oy - g.yMin * scale)
        cx += pos.x_advance * scale + tracking_em * size
    return pen.getCommands(), cx - x - tracking_em * size, top, bottom

# ---- the mark (Full rim, rounded) ----
def pt(r, a, c=32): return (c + r * math.cos(math.radians(a)), c + r * math.sin(math.radians(a)))
def arc(r, a0, a1):
    x0, y0 = pt(r, a0); x1, y1 = pt(r, a1); large = 1 if (a1 - a0) % 360 > 180 else 0
    return f'M{x0:.2f} {y0:.2f} A{r} {r} 0 {large} 1 {x1:.2f} {y1:.2f}'
START, SWEEP, FRAC = 135, 270, 0.68
PA = START + SWEEP * FRAC
PX, PY = pt(12, PA)

def mark(c, uid, dx=0, track=True):
    """c: dict with knob, track, level (colours or var() strings), opacity for track."""
    level = arc(25.75, START + 4, PA).replace('M', 'M', 1)
    return (f'<g transform="translate({dx} 0)">'
            f'<mask id="ptr-{uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/>'
            f'<line x1="32" y1="32" x2="{PX:.2f}" y2="{PY:.2f}" stroke="#000" stroke-width="4.5" stroke-linecap="round"/></mask>'
            + (f'<circle cx="32" cy="32" r="28.5" fill="{c["track"]}"' + (f' fill-opacity="{c["track_op"]}"' if c.get('track_op') else '') + '/>' if track else '') +
            f'<circle cx="32" cy="32" r="23" fill="{c["knob"]}" mask="url(#ptr-{uid})"/>'
            f'<path d="{level}" fill="none" stroke="{c["level"]}" stroke-width="5.5" stroke-linecap="round"/></g>')

def svg(w, h, body, label='Dials', bg=None):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" role="img" aria-label="{label}">{rect}{body}</svg>\n'

# ---- the full logo: mark, "dials" in Audiowide, raised CSS tag ----
FS = 51                       # wordmark size: the mark is 1.26x the type size, as on the page
GAP = 13
word_d, word_w, word_top, word_bot = text_path(AW_TT, AW, 'dials', FS, 64 + GAP, 0, 0.01)
word_h = word_bot - word_top
BASE = 32 + word_h / 2 + 1.0  # centre the word's ink on the mark
word_d, word_w, word_top, word_bot = text_path(AW_TT, AW, 'dials', FS, 64 + GAP, BASE, 0.01)
TFS = FS * 0.27               # tag type size
tag_text_d, tag_text_w, ttop, tbot = text_path(AW_TT, AW, 'CSS', TFS, 0, 0, 0.06)
PADX, PADY = 0.36 * TFS, 0.26 * TFS
TAG_W = tag_text_w + 2 * PADX; TAG_H = (tbot - ttop) + 2 * PADY
TAG_X = 64 + GAP + word_w + 0.3 * TFS + 2; TAG_Y = word_top
tag_text_d, _, _, _ = text_path(AW_TT, AW, 'CSS', TFS, TAG_X + PADX, TAG_Y + PADY - ttop, 0.06)
W = TAG_X + TAG_W + 2; H = 64
R = 0.3 * TFS

def logo(c, uid, outline_tag=False):
    tag = (f'<rect x="{TAG_X:.2f}" y="{TAG_Y:.2f}" width="{TAG_W:.2f}" height="{TAG_H:.2f}" rx="{R:.2f}" '
           + (f'fill="none" stroke="{c["text"]}" stroke-width="{0.09*TFS:.2f}"/>' if outline_tag else f'fill="{c["tag"]}"/>')
           + f'<path d="{tag_text_d}" fill="{c["text"] if outline_tag else c["tag_text"]}"/>')
    return mark(c, uid, track=c.get('track') is not None) + f'<path d="{word_d}" fill="{c["text"]}"/>' + tag

INK, LIGHT, AMBER, ALU, BLACK = '#18191b', '#ece9e1', '#f39c12', '#e6e5e1', '#121314'
C = {
  'light':   dict(knob=INK, track='#d4d1ca', level=AMBER, text=INK, tag=AMBER, tag_text=INK),
  'dark':    dict(knob=LIGHT, track='#34332f', level=AMBER, text=LIGHT, tag=AMBER, tag_text=INK),
  'on-amber':dict(knob=INK, track=INK, track_op='0.18', level='#fff4dc', text=INK, tag=INK, tag_text=AMBER),
  'mono-black': dict(knob='#000', track=None, level='#000', text='#000', tag='#000', tag_text='#000'),
  'mono-white': dict(knob='#fff', track=None, level='#fff', text='#fff', tag='#fff', tag_text='#fff'),
  'themeable': dict(knob='var(--logo-knob, #18191b)', track='var(--logo-track, #d4d1ca)', level='var(--logo-level, #f39c12)',
                    text='var(--logo-text, #18191b)', tag='var(--logo-level, #f39c12)', tag_text='var(--logo-tag-text, #18191b)'),
}
files = {}
for k, c in C.items():
    files[f'mark/dials-mark-{k}.svg'] = svg(64, 64, mark(c, 'm' + k.replace('-', ''), track=c.get('track') is not None))
    files[f'logo/dials-logo-{k}.svg'] = svg(W, H, logo(c, 'l' + k.replace('-', ''), outline_tag=k.startswith('mono')))
# on-colour backgrounds baked in, for social images and previews
files['logo/dials-logo-on-amber-bg.svg'] = svg(W + 48, H + 48, f'<g transform="translate(24 24)">{logo(C["on-amber"], "lab")}</g>', bg=AMBER)
files['logo/dials-logo-dark-bg.svg'] = svg(W + 48, H + 48, f'<g transform="translate(24 24)">{logo(C["dark"], "ldb")}</g>', bg=BLACK)
files['logo/dials-logo-light-bg.svg'] = svg(W + 48, H + 48, f'<g transform="translate(24 24)">{logo(C["light"], "llb")}</g>', bg=ALU)
# favicon: follows the visitor's light or dark setting
fav = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><style>.k{fill:#18191b}.t{fill:#d4d1ca}.l{stroke:#f39c12}'
       '@media (prefers-color-scheme: dark){.k{fill:#ece9e1}.t{fill:#34332f}}</style>'
       + mark(dict(knob='X', track='Y', level='Z'), 'fav').replace('fill="X"', 'class="k"').replace('fill="Y"', 'class="t"').replace('stroke="Z"', 'class="l"')
       + '</svg>\n')
files['mark/favicon.svg'] = fav
for p, d in files.items():
    open(os.path.join(OUT, p), 'w').write(d)
print(f'{len(files)} files; logo viewBox {W:.1f} x {H}; word {word_w:.1f} wide; tag {TAG_W:.1f} x {TAG_H:.1f}')
