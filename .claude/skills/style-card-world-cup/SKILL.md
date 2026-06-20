# PENALTY WORLD CUP 2026 — Style Guide

---

name: style-card-world-cup
description: Style guide for the Penalty World Cup 2026 project. Pixel-arcade design system fused with the 2026 tri-nation identity (USA · Mexico · Canada). Apply to every UI component, screen, card, button, or visual element generated or modified. Never invent new hues outside the defined palette.

---


> Pixel-arcade design system (inspired by ARCO) fused with the 2026 tri-nation
> identity: **USA · Mexico · Canada**. Visual reference: `./examples/Style Guide.html`.
> **Never invent new hues — stay inside this palette.**

---

## 01 · Surface & UI

| Token | Hex | Role |
|---|---|---|
| `--bg-deep` | `#0A1120` | App background |
| `--bg-night` | `#0D1830` | Night stadium |
| `--panel` | `#142544` | Panels / cards |
| `--panel-2` | `#1B315A` | Raised / active |
| `--panel-line` | `#2C4A82` | Borders / lines |
| `--ink` | `#070B14` | Hard outline |
| `--shadow` | `#04070E` | Drop shadow |

## 02 · Pitch & Brand

| Token | Hex | Role |
|---|---|---|
| `--pitch` | `#2F8F43` | Field green |
| `--pitch-dark` | `#1F6E30` | Field shade |
| `--pitch-line` | `#7FD089` | Field markings |
| `--gold` | `#F5B73D` | **Primary accent + selection** |
| `--gold-deep` | `#C8801F` | Gold bevel |
| `--cream` | `#F6ECCF` | Primary text |
| `--cream-dim` | `#CDBF9A` | Muted text |

## 03 · Tri-Nation Accents · USA · MEX · CAN

| Token | Hex | Role |
|---|---|---|
| `--usa` | `#2F6FE0` | USA blue |
| `--red` | `#E23B3B` | Penalty / alert |
| `--green` | `#18A04A` | Advance / win |
| `--navy` | `#14306E` | Deep accent |
| `--maroon` | `#7A1F33` | Qatar / deep red |

## 04 · Confederation Coding

| Confederation | Hex | Color |
|---|---|---|
| UEFA | `#2F6FE0` | Blue |
| CONMEBOL | `#F5C531` | Yellow |
| CAF | `#18A04A` | Green |
| AFC | `#E23B3B` | Red |
| CONCACAF | `#E8702A` | Orange |
| OFC | `#84BDEC` | Light blue |

## 05 · Flag Palette

| Name | Hex | Name | Hex |
|---|---|---|---|
| red | `#E23B3B` | dgreen | `#0F7A39` |
| dred | `#B62B2B` | blue | `#2F6FE0` |
| orange | `#E8702A` | navy | `#14306E` |
| yellow | `#F5C531` | lblue | `#84BDEC` |
| gold | `#E0A020` | sky | `#6FA8DC` |
| green | `#18A04A` | white | `#F6ECCF` |
| black | `#17171F` | maroon | `#7A1F33` |
| brown | `#7A4A22` | | |

---

## 06 · Typography

- **`Press Start 2P`** — titles, menus, UI labels. **Min 8px.**
- **`VT323`** — tables, numbers, body. **Min 16px.**

```html
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet">
```

| Use | Font | Size |
|---|---|---|
| Display titles (`WORLD CUP`) | Press Start 2P | 30–50px |
| UI labels (`START TOURNAMENT`) | Press Start 2P | 8–11px |
| Tables / numbers / body | VT323 | 16–22px |

---

## 07 · Components

**Buttons** — flat fill + stepped border, uppercase, letter-spacing 1.
- Primary `--gold`, advance/confirm `--green`, ghost `--panel-2`.

**Menu item** — `►` arrow selector + glow on the active row (gold).

**Tabs** — active = gold fill with inset ink border; inactive = panel fill with panel-line inset.

**Badges** — `PENS 4-3` on `--red`, `YOU` on `--gold` (both ink text, Press Start 2P ~8px).

**Flag chips** — stylized pixel flags: flat stripe fills + `★` / `●` motifs, `2px ink` outline. Never use emoji.

### Pixel border recipe
```css
.pbox{
  background: var(--panel);
  box-shadow:
    0 0 0 4px var(--ink),
    0 0 0 8px var(--panel-line),
    8px 8px 0 8px var(--shadow);
}
```

---

## 08 · Rules

**DO**
- Gold = accent / selection · green = advance / win · red = penalties / alert.
- Hard 4–8px stepped borders (ink + panel-line), **no rounded corners**.
- Keep a CRT scanline overlay on every screen; `image-rendering: pixelated`.
- Color-code teams by confederation dots.

**DON'T**
- No gradient backgrounds (flat fills + hard steps only).
- No emoji — use `★` / `●` pixel motifs and glyphs.
- Don't drop below 8px (Press Start 2P) or 16px (VT323).
- Don't invent new hues — stay inside these tokens.

---

## Paste-ready token block

```css
:root{
  /* surface & UI */
  --bg-deep:#0a1120; --bg-night:#0d1830; --panel:#142544;
  --panel-2:#1b315a; --panel-line:#2c4a82; --ink:#070b14; --shadow:#04070e;
  /* pitch */
  --pitch:#2f8f43; --pitch-dark:#1f6e30; --pitch-line:#7fd089;
  /* brand / arcade */
  --gold:#f5b73d; --gold-deep:#c8801f; --cream:#f6eccf; --cream-dim:#cdbf9a;
  /* tri-nation */
  --usa:#2f6fe0; --red:#e23b3b; --green:#18a04a; --navy:#14306e; --maroon:#7a1f33;
}
```
