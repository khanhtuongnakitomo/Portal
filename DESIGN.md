# UTS-TNE Portal — Design System & Style Reference

> **Treasury Ledger on Graph Paper × UTS Academic Precision.**  
> Built as a quiet, authoritative operating sheet where room allocation, student reservations, and key custody workflows are mapped with razor-sharp rules, high-density monospace ledger data, and exact dark controls.

**Theme:** Light (High-Contrast White Paper & Technical Graph Grid)  
**System Fonts:** Manrope (Display), Inter (Interface / Sans), IBM Plex Mono (Monospace / Ledger)  
**Primary Accent:** UTS Academic Blue (`#0F62FE`)

---

## 1. Design Philosophy

The **UTS-TNE Portal** design system fuses the financial discipline of **Modern Treasury** with the academic authority of **UTS (University of Technology Sydney)**:

1. **Graph Paper Canvas**: A quiet white financial canvas structured by a faint 24px / 96px grid (`#E0E0E0`), thin rules, and technical connector structures, with dark ink carrying visual hierarchy.
2. **Sharp & Disciplined Geometry**: Crisp 1px borders, small disciplined corner radii (`rounded-sm: 2px`, `rounded-md: 4px`), and zero bubbly pills. Controls and cards look like precision ledger entries.
3. **Two-Row Ledger Hierarchy**: Dense data elements (such as the approval queue and calendar blocks) follow a disciplined two-row structure: operational room/timestamp coordinates on the top row, student credentials (`SE184022`) and identity on the bottom row.
4. **Cinematic Restraint (React Bits Motion)**: Text entrance and scroll reveal animations (`BlurText`, `SplitText`, `Reveal`, `ShinyText`) elevate the application into an institutional command center without hindering workflow velocity or violating accessibility standards.

---

## 2. Tokens — Colors

### 2.1. Complete Palette

| Name | Hex Value | Token | Role & Usage |
| :--- | :--- | :--- | :--- |
| **Paper** | `#ffffff` | `--color-paper` | Base canvas, modal surfaces, floating popovers, sheets, and light card backgrounds. |
| **Ink** | `#000000` | `--color-ink` | Primary display headlines, high-emphasis text, active/hover card borders, and filled dark buttons. |
| **Graphite** | `#2b2b2b` | `--color-graphite` | Secondary body text, explanatory descriptions, and student full names. Darkened for legibility. |
| **Steel** | `#4a4a4a` | `--color-steel` | Technical metadata, secondary timestamps, duration tags, and inactive labels. |
| **Rule Gray** | `#e0e0e0` | `--color-rule` | Hairline dividers, 1px card borders, and the 24px graph paper grid lines. |
| **Edge Gray** | `#cbcbcb` | `--color-edge` | Structural boundaries, container dividers, and scrollbar tracks. |
| **Ice / Technical Gray-Blue** | `#f4f5f7` | `--color-ice` | Sleek ledger mini-cards, disabled input fields, and alternating row contrast panels. |
| **Reserved Gray** | `#e3e7ed` | `--color-reserved` | Non-interactive reservations belonging to other students on the master calendar. |
| **UTS Academic Blue** | `#0f62fe` | `--color-accent`<br>`--color-meta` | Primary brand accent: 3px left card accent stripe, student code text, primary action buttons, current-time indicator. |
| **UTS Blue Hover** | `#0043ce` | — | Hover state for accent buttons and clickable primary controls. |
| **Soft Blue Tint** | `#dce8ff` | `--color-tint` | Selection highlight fills, active booking indicators, and soft badge backgrounds. |
| **Ink Blue** | `#002d9c` | `--color-ink-blue` | High-contrast readable text placed over soft blue tint backgrounds. |
| **Slate Navy** | `#2e3a4b` | `--color-slate` | Room maintenance blocks, restricted schedules, and hatch backgrounds. |
| **Plum / Overdue** | `#543b4e` | `--color-plum` | Key custody overdue alert banner, overdue tags, and emergency security flags. |

---

## 3. Tokens — Typography

The portal relies on three Google Font families loaded with exact weights and OpenType configurations:

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@100..900&family=Manrope:wght@200..800&display=swap');
```

### 3.1. Font Roles

- **Manrope (`--font-display`)**:
  - **Weights:** 400, 450, 600, 700
  - **Role:** Hero display titles and primary page headers. Paired with `BlurText` and `ShinyText` for an authoritative, quiet entrance.
- **Inter (`--font-sans`)**:
  - **Weights:** 330, 360, 400, 500, 600, 700
  - **OpenType features:** `"cv10" 1, "ss07" 1, "ss08" 1` (tabular numerals, slashed zero, geometric alternates).
  - **Role:** Global UI text, form inputs, button copy, calendar vertical time markers, and navigation.
- **IBM Plex Mono (`--font-mono`)**:
  - **Weights:** 500, 600, 700
  - **Default in App:** `font-weight: 600`
  - **Role:** Room numbers (`RM 601`), Student IDs (`SE184022`), timestamps (`08:00 → 12:00`), queue counters (`[ PENDING QUEUE • 4 ]`), and digital ticket barcodes.

### 3.2. Type Scale

| Role | Family | Weight | Size | Line Height | CSS Token / Class |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Display** | Manrope | 450 | 71px | 1.10 | `--text-hero` (`text-hero`) |
| **Major Heading** | Manrope | 450 | 47px | 1.25 | `--text-major` (`text-major`) |
| **Section Heading** | Manrope / Inter | 600 | 32px | 1.25 | `--text-section` (`text-section`) |
| **Feature Heading** | Inter | 600 | 21px | 1.30 | `--text-feature` (`text-feature`) |
| **Body Large** | Inter | 400 / 500 | 16px | 1.50 | `text-[16px]` |
| **Body Regular** | Inter | 400 / 500 | 14px | 1.50 | `text-[14px]` |
| **Control Label** | Inter | 600 | 14px | 1.50 | `font-semibold text-[14px]` |
| **Technical Monospace**| IBM Plex Mono | 600 | 12px | 1.20 | `font-mono text-[12px]` |
| **Micro Monospace** | IBM Plex Mono | 600 | 11px | 1.20 | `font-mono text-[11px]` |

---

## 4. Tokens — Spacing, Shapes & Radii

- **Base Grid Unit:** 4px
- **Page Frame:** Max-width 1440px (wide desk ledger view), centered with 24px horizontal padding.
- **Section Spacing:** 32px to 48px gap between major operational panels.

### Border Radii
| Component | Value | Class | Rationale |
| :--- | :--- | :--- | :--- |
| **Buttons & Micro-tags** | 2px | `rounded-sm` / `rounded-[2px]` | Crisp, precise, mechanical edge. |
| **Queue Cards & Inputs** | 4px | `rounded-[4px]` / `rounded-md` | Professional handheld ledger shape. |
| **Panels, Sheets, Popovers**| 8px | `rounded-lg` / `rounded-[8px]` | Contained card boundary without bubbly distortion. |
| **Pills / Status Chips** | 2px – 4px | `rounded-[2px]` | Strictly non-pill, technical tag aesthetic. |

### Shadows & Elevation
- **Hairline Inset Rule:** `rgb(0 0 0) 0px 0px 0px 1px inset` (`--shadow-subtle`)
- **Grid Rule:** `rgb(224 224 224) 0px 0px 0px 1px inset` (`--shadow-rule`)
- **Nav Shadow:** `rgb(0 0 0 / 0.04) 0px 20px 25px -5px, rgb(0 0 0 / 0.04) 0px 8px 10px -6px`

---

## 5. Components & Layout Specifications

### 5.1. Master & Student Calendar (Operating Schedule: 08:00 – 17:00)
- **Strict Office Hours Scale:** The vertical hour axis exclusively renders **08:00 to 17:00** (8:00 AM – 5:00 PM). All hours prior to 08:00 and after 17:00 are strictly excluded from the grid and mock data.
- **Drag-to-Select Constraints:** Selection gestures cannot initiate before 08:00 or extend past 17:00. Time intervals snap to 15-minute / 30-minute increments.
- **Day Column Containment:** Day columns enforce `overflow: hidden`. Event block positions (`top` and `height`) are mathematical clamps within the 9-hour column span (540 total minutes), completely eliminating header bleeding bugs.
- **Current Time Bar:** A razor-thin horizontal line with a 4px blue circular node at the left axis, strictly calculated against the 08:00–17:00 span.

### 5.2. Sleek Ledger Mini-Cards & Interactive Carousel (Pending Queue)
Located directly beneath the "Room schedule" heading in `ManagerView`:
- **Badge Label:** `[ • PENDING QUEUE • {count} ]` rendered in IBM Plex Mono 600 with an animated UTS Blue pulse dot.
- **Carousel Navigation Controls:** Compact pair of `28px × 28px` Previous/Next arrow buttons (`rounded-[2px]`, `border-[#E0E0E0]`, hover to UTS Blue `#0F62FE`). Automatically disabled at boundary scroll points or when the queue is clear.
- **Grab-to-Scroll Interaction:** Freeform horizontal mouse dragging (`cursor: grab` to `cursor: grabbing`) with a natural `1.3x` physics multiplier and text selection suppression (`select-none`). Real drag gestures gracefully suppress accidental card clicks, while standard clicks preserve instantaneous booking navigation (`onSelectItem`).
- **Hidden Scrollbars:** Zero visible browser scrollbars via `@utility no-scrollbar` (`scrollbar-width: none; ::-webkit-scrollbar: none;`).
- **Card Geometry:** 1px solid border (`#E0E0E0`) with a prominent 3px solid UTS Blue (`#0F62FE`) accent border along the left edge.
- **Surface Fill:** Clean Technical Gray-Blue (`#F4F5F7`), switching to White (`#FFFFFF`) on hover with a Rich Black (`#000000`) border.
- **Two-Row Hierarchy:**
  - *Top Row:* Room Code (`RM 601` in Inter 600 `#000000`, 13px) and Monospace Timestamp (`06 NOV • 15:00` in Technical Gray `#424242`, 12px).
  - *Bottom Row:* Student ID in bold UTS Blue (`SE184022` in IBM Plex Mono 600, 12px) + Bullet (`•`) + Student Full Name (`Anh Vo` in Inter 400 `#424242`, 12px).
- **Padding:** `py-2 px-3.5` (8px top/bottom, 14px left/right), with `gap-3` between cards.
- **Interaction:** Clicking any card jumps to the respective week and auto-anchors the approval popover directly over that block.

### 5.3. Interactive Anchored Ledger Popover (Student Calendar)
Anchored directly adjacent to the student's booking block on the calendar:
- **Card Styling:** Absolute White (`#FFFFFF`) surface, 8px radius, 1px solid `#E0E0E0` border, subtle elevation.
- **Monospace Header:** Room code in IBM Plex Mono (`ROOM 601 • SEMINAR HALL`) paired with a bold status badge (`PENDING APPROVAL` or `APPROVED`).
- **Timestamp Display:** High-contrast monospace time string with duration (`FRI 06 NOV • 10:30 → 14:30 (4h)`).
- **Credentials:** Student Name and Student ID in IBM Plex Mono (`Linh Nguyen • SE123456`).
- **Direct Actions:**
  - `[ Cancel reservation ]`: Outlined dark/red action allowing instant cancellation without leaving the calendar view.
  - `[ Close ]`: Neutral action to dismiss the popover.
  - *Safety Lock:* If the key has already been issued (`KEY_CHECKED_OUT`) or the session is `COMPLETED`, the cancel button is disabled and displays: `"Key already collected — cannot cancel"`.

### 5.4. Buttons & Form Controls
- **Dark Button (Primary Action):** Black fill (`#000000`), white text (`#FFFFFF`), 1px black border, 2px radius, hover to `#262626`.
- **Accent Button (UTS Blue):** `#0F62FE` fill, white text, 2px radius, hover to `#0043CE`.
- **Outline Button (Secondary):** White fill, 1px `#E0E0E0` border with inset shadow, hover to `#F4F5F7`.
- **Plum Button (Alert / Key Custody):** `#543B4E` border and text, hover to filled Plum with white text.
- **Inputs & Textareas:** 0px radius, 1px border in `#CBCBCB`, focusing to `#000000` with an inset focus ring. Monospace formatting for codes and identifiers.

---

## 6. Motion Layer (React Bits Restrained Animations)

All animations strictly adhere to a **cinematic yet restrained** design principle: motion exists to clarify hierarchy, not to distract.

### 6.1. BlurText — Hero Heading Entrance
- **Effect:** Words start blurred (`filter: blur(8px)`), subtly offset downward (`translateY(10px)`), and tinted UTS Blue (`#0F62FE`).
- **Transition:** Gradually drift into position, de-blurring and settling into Rich Black (`#000000`).
- **Timing:** Duration `600ms`, stagger `65ms` per word, easing `cubic-bezier(0.22, 0.8, 0.24, 1)`.
- **Handoff:** When `shine={true}`, seamlessly hands off to `ShinyText` once the final word lands.

### 6.2. ShinyText — Restrained Metallic Sheen
- **Effect:** A 105° linear gradient with a UTS Blue sheen sweeping slowly across primary headings:  
  `linear-gradient(105deg, #000000 0%, #000000 38%, #0f62fe 50%, #000000 62%, #000000 100%)`
- **Cycle:** 9-second cycle with generous quiet pauses. Never continuous or aggressive.

### 6.3. SplitText — Section Heading Entrance
- **Effect:** Headings rise word-by-word (`translateY(0.45em)` to 0) with opacity transitions triggered upon viewport entry via `IntersectionObserver`.
- **Timing:** 45ms stagger between individual words.

### 6.4. Reveal & Reveal-Stagger — Content & Card Ingress
- **Effect:** Fades in while ascending 20px with light de-blur (`blur(3px)` to 0).
- **Execution:** Runs exactly once per element via a shared `IntersectionObserver`.
- **Stagger:** Direct child cards reveal with an 80ms progressive delay.

### 6.5. ScrollRevealText — Progressive Reading
- **Effect:** Words brighten from 28% opacity to 100% and sharpen progressively as the user scrolls, driven by the CSS variable `--p` (0 to 1).

### 6.6. AuroraBackdrop & CursorField
- **AuroraBackdrop:** Very slow 48s–75s drifting UTS Blue and steel radial blobs behind the graph paper grid (`pointer-events: none`).
- **CursorField:** Fine fluid trail using requestAnimationFrame (rAF) and DOM refs. Automatically deactivated on touch devices and coarse pointers.

### 6.7. Accessibility (`prefers-reduced-motion`)
When `prefers-reduced-motion: reduce` is detected:
- All transforms, blurs, and delays are zeroed out.
- Elements render immediately with full opacity and crisp, static text.

---

## 7. Do's and Don'ts

### Do
- **Do** maintain a strict 08:00 – 17:00 scale on all student and master calendar views.
- **Do** format all identifiers (Student ID, Room Code, Passcode, Timestamps) in `IBM Plex Mono` weight 600.
- **Do** use a 3px solid UTS Blue (`#0F62FE`) left border accent on ledger mini-cards.
- **Do** use `#F4F5F7` as the default neutral card background to provide soft contrast against the `#FFFFFF` graph paper.
- **Do** enforce `overflow-hidden` on calendar day columns to prevent coordinate bleed.
- **Do** pair `BlurText` entrance animations with a quiet transition into `ShinyText`.

### Don't
- **Don't** use bubbly border radii (e.g., `rounded-full` or `rounded-2xl`) on cards or action buttons.
- **Don't** use generic colorful gradients on dashboard tiles. Color is reserved for state meaning (UTS Blue, Plum Overdue, Slate Inactive).
- **Don't** allow calendar bookings or drag selection outside the 08:00 – 17:00 window.
- **Don't** render cheap dashed borders around interactive queue items. Use crisp 1px solid `#E0E0E0` borders.
- **Don't** animate every single text element or paragraph simultaneously; preserve visual hierarchy.

---

## 8. Tailwind CSS v4 Theme Specification

The complete configuration implemented in `src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@100..900&family=Manrope:wght@200..800&display=swap');
@import 'tailwindcss';

@theme {
  /* Surfaces & Canvas */
  --color-paper: #ffffff;
  --color-ink: #000000;
  --color-graphite: #2b2b2b;
  --color-steel: #4a4a4a;
  --color-rule: #e0e0e0;
  --color-edge: #cbcbcb;
  --color-ice: #f4f5f7;
  --color-reserved: #e3e7ed;

  /* UTS Brand */
  --color-accent: #0f62fe;
  --color-meta: #0f62fe;
  --color-tint: #dce8ff;
  --color-ink-blue: #002d9c;

  /* Operational Accents */
  --color-slate: #2e3a4b;
  --color-plum: #543b4e;
  --color-forest: #000000;

  /* Fonts */
  --font-display: 'Manrope', ui-sans-serif, system-ui, sans-serif;
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Type Scale */
  --text-hero: 71px;
  --text-hero--line-height: 1.1;
  --text-major: 47px;
  --text-major--line-height: 1.25;
  --text-section: 32px;
  --text-section--line-height: 1.25;
  --text-feature: 21px;
  --text-feature--line-height: 1.3;

  /* Radii */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;

  /* Inset Shadows */
  --shadow-subtle: rgb(0, 0, 0) 0px 0px 0px 1px inset;
  --shadow-rule: rgb(224, 224, 224) 0px 0px 0px 1px inset;
  --shadow-nav: rgb(0 0 0 / 0.04) 0px 20px 25px -5px, rgb(0 0 0 / 0.04) 0px 8px 10px -6px;
}
```
