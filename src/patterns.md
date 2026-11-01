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

Dials works out leading, tracking and the strong weight for you, from a few type dials, all unset by default. `--leading` and `--tracking` work out a value for the size of the element they're on: the leading slides from `--leading-body` at body size to `--leading-display` at the h1 step (`--size-5`), so bigger text gets proportionally tighter lines, and the tracking slides from `--tracking-small` at `--size--2` through 0 at body size to `--tracking-display` at `--size-5`. The display sizes above h1 keep the display values, so `--leading-display` and `--tracking-display` are what your main heading gets. Both are lengths, so an element that inherits them gets its parent's value, not its own: **set them on every element that sets its own font size**, and never on a wrapper or on `body`.

```css
.card-title {
  font: var(--weight-heading, 600) var(--size-3) / var(--leading) var(--font-heading);
  letter-spacing: var(--tracking);
}
```

- The weight dials are unset by default, so read them with Dials' value as the fallback: `var(--weight-heading, 600)`, `var(--weight-body, 400)`. `--weight-strong` (the body weight plus 200) needs no fallback.
- `dials-base.css` applies all of this to plain headings, captions and small print once you set a leading or tracking dial. Until then it keeps v0.2's type: body 1.6, headings 1.15, no letter spacing.

**An eyebrow or label in capitals** takes the tracking for its size plus `--tracking-caps`, which together are `--tracking-caps-total`:

```css
.eyebrow {
  /* a small label in capitals above a heading */
  font-size: var(--size--1); line-height: var(--leading); font-weight: var(--weight-strong);
  text-transform: uppercase; letter-spacing: var(--tracking-caps-total);
  color: var(--on-soft);
}
```

The same goes for small caps (`font-variant-caps: all-small-caps`).

**A lede**, the larger opening paragraph, is a step up the scale with its own leading:

```css
.lede { font-size: var(--size-1); line-height: var(--leading); letter-spacing: var(--tracking); color: var(--text-muted); }
```

**Display type**, such as a hero title or a big numeral, uses the top steps, `--size-6` to `--size-8`. They keep `--leading-display` and `--tracking-display`, the values set for h1.

**Line length.** `--line-length` caps running text in `dials-base.css` (paragraphs, list items, quotes, captions). A component that holds running text reads it with no cap as the fallback: `max-inline-size: var(--line-length, none)`.

**A third face**, for ledes, pull quotes or buttons, is the `--font-accent` dial. It's unset by default, so read it with the body face as the fallback:

```css
.pull-quote { font-family: var(--font-accent, var(--font-body)); font-size: var(--size-3); line-height: var(--leading); letter-spacing: var(--tracking); }
```

**Finer typesetting.** The class `.is-typeset`, on `<html>` or any section, turns on kerning at every size, tabular figures in tables and `text-wrap: pretty` on paragraphs, list items and quotes (in browsers that have it). It's opt-in, so upgrading changes nothing. For figures that must line up outside a table, set `font-variant-numeric: tabular-nums` on the component.
