## Patterns

A token exists when Dials computes or guarantees something: a colour worked out from the dials, or a contrast it holds. Anything you can build from existing tokens is a pattern, written in your own file, not a token. These are the documented ones.

### Gradients are patterns

Dials has no gradient tokens. Build a gradient from the group tokens, blended `in oklab` so it crosses straight over rather than swinging round the colour wheel. Declare it once as a custom property in your own file, with a comment, like any other new shade.

```css
:root {
  /* a wash for section backgrounds: body text sits on it */
  --wash: linear-gradient(in oklab 135deg, var(--brand-soft), var(--info-soft));
  /* a band: decoration only, no text on it */
  --band: linear-gradient(in oklab 90deg, var(--brand-solid), var(--brand-soft));
}
.feature { background: var(--wash); color: var(--text); }
.hero-strip { background: var(--band); }
```

- **A wash** runs between two soft tints (`--brand-soft` to `--info-soft`, say). Every soft tint keeps 4.5:1 with `--text` and `--text-strong`, and a blend of two in OKLab sits between them, so body text and headings can sit anywhere on it (the contrast check tests `--text` on every tint and on a wash's midpoint). A group's `--*-on-soft` is only promised on its own tint, so don't use it across a wash.
- **A band or fade** runs from a solid to a soft tint (`--brand-solid` to `--brand-soft`) or from one solid to another. It's decoration only: no single text colour passes across it, because each end wants the opposite one. Put text on a solid panel (`--solid` with `--on-solid`) or a surface on top of it instead.
- Browsers without gradient interpolation (2022 and older) drop a declaration that uses `in oklab`. If you support them, write the same gradient without it first: `background: linear-gradient(135deg, var(--brand-soft), var(--info-soft)); background: var(--wash);`.

### A subtle border in a group's colour

Each group's line is strong on purpose: it holds 3:1, for borders that must be seen, icons and large text. For a border that only hints at the group, such as around a tinted message box, blend the line into the decorative border. It's a pattern, declared once, not a token:

```css
.message {
  /* a quiet border in the group's colour: decoration, no contrast promised */
  --message-border: color-mix(in oklab, var(--line) 40%, var(--border));
  background: var(--soft); color: var(--on-soft);
  border: var(--border-width-s) solid var(--message-border);
}
```

```html
<div class="message is-warning">Check your levels.</div>
```

- Declare it on the component, not at `:root`. A custom property works out its `var()` where it's declared, so one declared at `:root` would always use the brand group's line, whatever group class the box has.
- Choose the percentage to taste: 0% is the plain `--border` and 100% is the full line. A border drawn this way is decoration, so don't rely on it alone to mark a control or a state.

### Type

Dials works out one thing about type besides the scale: leading. `--leading` is the line height for the size of the element it's on, from one dial, `--leading-body` (1.5 by default): every larger size keeps body text's gap between lines, so bigger text gets proportionally tighter lines, and smaller text keeps the body ratio. `--space-paragraph` is one body line.

With `dials-base.css`, every element already gets `--leading` for its own size, so a component sets only its font size:

```css
.card-title { font-size: var(--size-3); font-family: var(--font-heading); }
```

Without `dials-base.css`, set `line-height: var(--leading)` on every element that sets its own font size. It's a length, so an element that inherits it gets its parent's value, not its own: never set it on a wrapper or on `body` for children to inherit. To change the rhythm of a section, set the dial on it: `<section data-dials style="--leading-body: 1.3">`.

Weights and letter spacing are the typeface's. `dials-base.css` sets headings, labels, buttons and table headers at 600 and leaves `strong` to the browser; where you want something else, set it on the component, as the patterns below do. A weight is a unitless number, and letter spacing is in em.

**An eyebrow or label in capitals** needs a little letter spacing, about 0.05em to 0.12em:

```css
.eyebrow {
  /* a small label in capitals above a heading */
  font-size: var(--size--1); font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--on-soft);
}
```

The same goes for small caps (`font-variant-caps: all-small-caps`).

**Display type**, such as a hero title or a big numeral, uses the top steps, `--size-6` to `--size-8`. Many faces look loose at those sizes: tighten them a little on the component, about −0.01em to −0.03em, tuned to the face. Faces with optical sizes usually need none.

```css
.hero-title { font-size: var(--size-7); letter-spacing: -0.02em; }
```

**A lede**, the larger opening paragraph, is a step up the scale: `.lede { font-size: var(--size-1); color: var(--text-muted); }`.

**Line length.** The measure depends on the layout, so set it on the component that holds running text: `max-inline-size: 65ch` (in `ch`, so it follows the face and size). `dials-base.css` leaves line length to the container.

**A third face**, for ledes, pull quotes or buttons, is the `--font-accent` dial. Its default is the body face, and `dials.css` doesn't declare it, so read it with the body face as the fallback:

```css
.pull-quote { font-family: var(--font-accent, var(--font-body)); font-size: var(--size-3); }
```

**Finer typesetting.** The class `.is-typeset`, on `<html>` or any section, turns on kerning at every size, tabular figures in tables and `text-wrap: pretty` on paragraphs, list items and quotes (in browsers that have it). It's opt-in. For figures that must line up outside a table, set `font-variant-numeric: tabular-nums` on the component.
