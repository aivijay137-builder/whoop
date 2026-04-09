```markdown
# Design System Strategy: The Clinical Sanctuary

This document defines the visual and structural language for a premium, health-focused digital experience. It is designed to bridge the gap between rigorous clinical data and the intuitive, lifestyle-centric aesthetic of high-end wearable technology.

## 1. Creative North Star: "The Clinical Sanctuary"
The "Clinical Sanctuary" approach rejects the cluttered, high-stress interface of traditional medical software. Instead, it treats health data as a quiet, premium commodity. 

To move beyond a "template" look, this system utilizes **Tonal Architecture**. We break the grid not with lines, but with shifts in light and depth. The layout should feel like a series of curated objects resting on a soft, illuminated surface. We prioritize intentional asymmetry—using large `display-lg` typography to anchor the eye, while allowing ample whitespace (`spacing-16` and `spacing-20`) to let the data "breathe."

## 2. Color & Surface Philosophy
The palette is built on "Soft Whites" and "Light Grays" to establish a sense of purity and calm.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1x solid borders for sectioning or containment. 
*   **How to define boundaries:** Use background color shifts. A `surface-container-low` section sitting on a `surface` background is the primary method of separation.
*   **The "Ghost Border" Fallback:** If accessibility requires a stroke, use the `outline-variant` token at **15% opacity**. High-contrast, opaque borders are forbidden as they create visual "noise" that disrupts the calm.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of fine paper or frosted glass.
*   **Base:** `surface` (#f8f9fa)
*   **Level 1 (Sections):** `surface-container-low` (#f1f4f6)
*   **Level 2 (Cards/Interaction):** `surface-container-lowest` (#ffffff)
*   **Level 3 (High Prominence):** `surface-bright` (#f8f9fa) with an ambient shadow.

### The "Glass & Gradient" Rule
To evoke a "wearable-tech" premium feel, use Glassmorphism for floating elements (like headers or mobile navigation bars). Apply `surface` with a 70% opacity and a `20px` backdrop-blur. 
*   **Signature Textures:** For primary CTAs or health "Score" indicators, use a subtle linear gradient from `primary` to `primary_container`. This adds a "soul" to the UI that flat hex codes cannot achieve.

## 3. Typography: Editorial Authority
We utilize a pairing of **Manrope** for structure and **Plus Jakarta Sans** for movement.

*   **Display & Headlines (Manrope):** These are your "Anchors." Use `display-lg` for daily readiness scores or primary metrics. The wide aperture of Manrope communicates clinical clarity and modern authority.
*   **Body & Titles (Plus Jakarta Sans):** This font brings the "Consumer Friendly" aspect. It is slightly more geometric and approachable, perfect for health insights and long-form data interpretation.
*   **Visual Scale:** Always maintain high contrast in scale. A `display-lg` metric should often sit near a `label-sm` unit to create a sophisticated, editorial hierarchy.

## 4. Elevation & Depth
In this system, elevation is a product of light, not darkness.

*   **Tonal Layering:** Most hierarchy should be achieved by nesting. Place a `surface-container-lowest` (pure white) card on a `surface-container-low` background. This creates a "natural lift."
*   **Ambient Shadows:** For floating modals or "active" cards, use a shadow with a blur radius of `spacing-8` or `spacing-10`. The color should be a 5% opacity tint of `on_surface` (#2b3437). This mimics natural laboratory lighting rather than digital "drop shadows."
*   **Roundedness:** All containers must use `rounded-xl` (1.5rem) or `rounded-lg` (1rem) to soften the clinical data. Selection states and chips should use `rounded-full` to mimic the organic curves of the human body and wearable hardware.

## 5. Components & Interaction

### Cards & Data Visualization
*   **Constraint:** Forbid the use of divider lines within cards. 
*   **Solution:** Separate "Heart Rate" from "Sleep" data using a `spacing-4` vertical gap or a subtle shift from `surface-container-lowest` to `surface-container`.
*   **Micro-interactions:** Cards should subtly scale (1.02x) on hover, increasing the blur of their ambient shadow.

### Buttons (The "Soft Action")
*   **Primary:** Uses a gradient of `primary` to `primary_dim`. Text is `on_primary`. Shape is `rounded-full`.
*   **Secondary:** No background. Use a "Ghost Border" (outline-variant at 20%) with `on_surface_variant` text.
*   **Tertiary:** Text-only using `tertiary` color (#386667), used for "Learn More" clinical insights.

### Inputs & Selection
*   **Fields:** Background should be `surface_container_highest`. On focus, the background shifts to `surface_container_lowest` with a `primary` ghost border.
*   **Chips:** Use `rounded-full`. Active state uses `tertiary_container` with `on_tertiary_container` text. This soft green communicates "Health" without the "Stop/Go" harshness of standard alerts.

### Status Indicators
Avoid "Alert Red" where possible. 
*   **Healthy/Optimal:** `tertiary` (#386667)
*   **Attention Required:** `secondary` (#5b5f67)
*   **Critical:** `error` (#9e422c) — used sparingly only for clinical outliers.

## 6. Do's and Don'ts

### Do:
*   **Do** use `spacing-12` and `spacing-16` to isolate key health metrics.
*   **Do** use `label-sm` in all-caps with `0.05rem` letter spacing for technical metadata.
*   **Do** use "nested" surfaces to group related data points (e.g., placing multiple white cards on a single light-gray section).

### Don't:
*   **Don't** use pure black (#000000) for text. Use `on_surface` (#2b3437) to maintain the "calm" atmosphere.
*   **Don't** use 90-degree corners. Even inputs must have at least `rounded-sm`.
*   **Don't** use standard "Material Design" shadows. If it looks like a default shadow, it is too heavy for this system.
*   **Don't** clutter the screen. If a dashboard has more than 5 primary data points, move the secondary metrics to a "Details" layer using a `surface_container` slide-over.```