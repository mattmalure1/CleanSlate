# Design System Document: The Editorial Eco-System

## 1. Overview & Creative North Star: "The Digital Conservator"
The objective of this design system is to transform the "media buyback" experience from a transactional utility into a premium, eco-conscious service. We are moving away from the cluttered, "pawn-shop" aesthetic typical of the industry and toward a **"Digital Conservator"** North Star.

This system balances the high-density information requirements of a trust-based business (FAQs, benefit lists, and social proof) with the breathing room of a high-end lifestyle brand. We achieve this through **Intentional Asymmetry**—where dense data blocks are offset by large, serene "White Space Anchors"—and **Tonal Depth**, replacing rigid lines with soft, overlapping surfaces. The result is a platform that feels authoritative, professional, and environmentally intentional.

---

## 2. Colors: Tonal Ecology
We use a palette of deep forest greens and botanical mid-tones, grounded by a "Slate" neutral system.

### Surface Hierarchy & The "No-Line" Rule
**Crucial Directive:** 1px solid borders for sectioning are strictly prohibited. Structure is defined through background shifts and "Surface Nesting."
*   **The Layering Principle:** Use the `surface-container` tiers to create depth.
    *   **Level 0 (Base):** `surface` (#f4faff) — The vast, clean canvas.
    *   **Level 1 (Sections):** `surface-container-low` (#e7f6ff) — For large content blocks (e.g., FAQ sections).
    *   **Level 2 (In-Page Navigation/Sub-sections):** `surface-container` (#e0f0fb).
    *   **Level 3 (Cards/Floating Elements):** `surface-container-lowest` (#ffffff) — Used to "lift" key data points off a darker section.

### Glass & Gradient (The Premium Polish)
To avoid a "flat" template look:
*   **Signature Gradients:** Use a subtle linear gradient from `primary` (#154212) to `primary-container` (#2d5a27) for Hero CTAs. This adds a "silk" finish.
*   **Glassmorphism:** For floating navigation or "Trust Badges," use `surface_variant` at 60% opacity with a `20px` backdrop-blur.

---

## 3. Typography: The Editorial Voice
We utilize a pairing of **Manrope** (Display/Headlines) for its modern, geometric authority and **Inter** (Body/Labels) for its clinical readability at high densities.

*   **Display (Manrope):** Large scales (`display-lg`: 3.5rem) should use `primary` (#154212) with tight letter-spacing (-0.02em). This is your "Statement" type.
*   **Headlines (Manrope):** Use `tertiary` (#293d39) to provide a sophisticated "Dark Slate" contrast that isn't as harsh as pure black.
*   **Body (Inter):** All dense information (Benefit lists, FAQs) must use `body-md` (0.875rem) with a generous line-height (1.6) to ensure the high information density from the inspiration remains digestible.
*   **Labels (Inter):** Use `label-md` in `on_surface_variant` (#42493e) for secondary data, ensuring a clear visual hierarchy.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are too heavy for an "Eco-friendly" brand. We use "Ambient Light" principles.

*   **Tonal Lift:** Instead of a shadow, place a `surface-container-lowest` card on a `surface-container-low` background. The subtle shift from #ffffff to #e7f6ff provides enough "lift" for the human eye without visual clutter.
*   **Ambient Shadows:** If a floating element (like a Quote Calculator) requires a shadow, use: `Box-shadow: 0px 24px 48px rgba(14, 29, 37, 0.06);`. Note the color is a tint of `on_surface`, not black.
*   **The Ghost Border:** If accessibility requires a container boundary, use the `outline-variant` (#c2c9bb) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: Intentional Primitives

### Buttons (The Interaction Anchors)
*   **Primary:** `primary` background with `on_primary` text. Use `xl` (0.75rem) roundedness. No borders.
*   **Secondary:** `secondary_container` background with `on_secondary_container` text. This provides a soft "Sage" alternative for secondary actions like "Learn More."
*   **Tertiary/Text:** No background. Use `primary` text weight 600.

### Cards & Information Dense Blocks
*   **The "No-Divider" Rule:** In benefit lists (inspired by EagleSaver), never use horizontal lines. Use 24px–32px of vertical padding and a background shift to `surface-container-high` on hover to indicate interactivity.
*   **The Trust Strip:** Use a full-width `tertiary` (#293d39) section with `on_tertiary` text for customer counts and "As Seen In" logos. This creates a high-contrast "anchor" in the scroll.

### Input Fields
*   **Surface:** `surface_container_lowest` (#ffffff).
*   **State:** Use `outline` (#72796e) for the inactive state at 30% opacity. On focus, transition to `primary` (#154212) at 2px thickness.

### Signature Component: The "Eco-Stat" Card
For displaying "Media Recycled" or "Trees Saved" stats:
*   Use `secondary_fixed` (#ccebc7) background.
*   Large `display-sm` Manrope numbers in `on_secondary_fixed_variant`.
*   Place these with intentional asymmetry (e.g., overlapping the edge of a section) to break the grid.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts where text blocks are offset from images to create a premium editorial feel.
*   **Do** lean into "Sage" and "Mint" tones (`secondary_container`, `tertiary_fixed`) for background sections to keep the "Eco" promise alive.
*   **Do** use large, high-quality photography of natural textures (recycled paper, forest floors) to provide organic contrast to the clean UI.

### Don’t:
*   **Don't** use 1px solid dividers or borders. This makes the site feel like a legacy "buyback" template.
*   **Don't** use pure black (#000000). Use the `on_surface` or `tertiary` tokens for a more sophisticated, "Slate" finish.
*   **Don't** crowd the "Benefit Lists." Even though we want high information density, use the spacing scale (32px+) to give each "Trust Point" room to breathe.