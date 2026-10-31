# Dials brand

## Logo

The full-rim knob with its level rim, lowercase **dials** in Audiowide, and a solid **CSS** tag raised after the word. The lettering in every SVG is converted to outlines, so the files need no fonts. The knob's pointer is cut out, so it shows whatever is behind it.

| Folder | Files |
|---|---|
| `mark/` | The knob alone: light, dark, on amber, one colour (black, white), themeable, and `favicon.svg`, which follows the visitor's light or dark setting |
| `logo/` | The full logo: light, dark, on amber, one colour (black, white, with an outlined tag), themeable, and versions with a background baked in for social images |

The themeable files take their colours from `--logo-knob`, `--logo-track`, `--logo-level`, `--logo-text` and `--logo-tag-text`, so a page can draw the logo in its own theme.

Use the one-colour versions for print, embossing and anywhere only one colour is available. The solid amber tag is the main lockup: amber at both ends balances it.

## Colours

| Name | Hex | Use |
|---|---|---|
| Amber | `#f39c12` | The brand: the knob's level and the tag |
| Ink | `#18191b` | Text and the knob in light |
| Aluminium | `#e6e5e1` | The light faceplate |
| Black | `#121314` | The dark faceplate |
| Light ink | `#ece9e1` | Text and the knob in dark |

## Type

- **Audiowide:** the brand's only typeface, for the wordmark and the CSS tag.
- **Michroma and Barlow:** headings and body text in the Hi-Fi house theme.

All three are on Google Fonts under the SIL Open Font Licence.

## Rebuilding the files

`source/brand_gen.py` builds every SVG. It needs Python with `fonttools` and `uharfbuzz`, and the Audiowide font file from Google Fonts:

```sh
pip install fonttools uharfbuzz
python source/brand_gen.py path/to/fonts .
```
