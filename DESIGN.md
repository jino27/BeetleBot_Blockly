---
name: Blockly
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1c1c'
  surface-container: '#1f2020'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#343535'
  on-surface: '#e4e2e2'
  on-surface-variant: '#e1bfb2'
  inverse-surface: '#e4e2e2'
  inverse-on-surface: '#303030'
  outline: '#a88a7e'
  outline-variant: '#594137'
  surface-tint: '#ffb596'
  primary: '#ffb596'
  on-primary: '#581e00'
  primary-container: '#ff6f20'
  on-primary-container: '#5c2000'
  inverse-primary: '#a33f00'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#86cfff'
  on-tertiary: '#00344c'
  tertiary-container: '#00a5e7'
  on-tertiary-container: '#003750'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbcd'
  primary-fixed-dim: '#ffb596'
  on-primary-fixed: '#360f00'
  on-primary-fixed-variant: '#7c2e00'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#c8e6ff'
  tertiary-fixed-dim: '#86cfff'
  on-tertiary-fixed: '#001e2e'
  on-tertiary-fixed-variant: '#004c6d'
  background: '#131314'
  on-background: '#e4e2e2'
  surface-variant: '#343535'
typography:
  headline-lg:
    fontFamily: Poppins
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Poppins
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Poppins
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Poppins
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.5px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin: 24px
---

# Ignite Dark Design System

## Brand & Style
Ignite Dark is a high-energy, modern design system built for tech-forward interfaces. It utilizes a striking dark aesthetic paired with a vibrant, high-fidelity orange to command attention and convey a sense of urgency and innovation.

The style is **Modern / Corporate** with a focus on high-contrast accessibility. It avoids the starkness of pure black, opting instead for deep neutral greys to provide a more sophisticated backdrop for the primary brand color. The move from sharp to rounded corners softens the technical edge, making the interface feel approachable yet professional.

## Colors
The color palette is optimized for a dark mode environment, prioritizing visual comfort and clear hierarchy.

*   **Primary (#FF6F20):** A vivid, saturated orange used for key actions, brand moments, and critical highlights.
*   **Secondary (#F2F2F2):** A near-white neutral used for high-contrast text, icons, and subtle borders.
*   **Neutral (#4D4D4D):** A deep grey that serves as the foundation for surface containers and secondary elements.

The system relies on high contrast between the primary orange and the dark neutral backgrounds to guide the user's eye.

## Typography
The system uses **Poppins** for all typographic layers, transitioning to a geometric sans-serif to enhance the friendly yet technical personality of the brand.

*   **Headlines:** Set with heavier weights (600-700) to create strong visual anchors. Large headlines scale to 32px.
*   **Body:** Standardized at 16px (Regular 400) for optimal readability against dark backgrounds.
*   **Labels:** Used for metadata, utilizing medium weights and 0.5px letter spacing for clarity.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a base unit of 8px. This ensures a consistent rhythm across all components and page layouts.

The design scales using a 12-column grid for desktop and a 4-column grid for mobile. Gutters are fixed at 16px to maintain clear separation, while outer margins are set at 24px.

## Elevation & Depth
Depth is conveyed through **Tonal Layers**. Surfaces that are "closer" to the user are rendered in lighter shades of grey relative to the background. Subtle, low-opacity ambient shadows are reserved for primary action buttons or floating elements to maintain a clean aesthetic.

## Shapes
The shape language follows a **Rounded** aesthetic (Level 2).

*   **Standard Elements:** Buttons and input fields use a 0.5rem (8px) corner radius.
*   **Large Elements:** Cards and containers utilize a 1rem (16px) radius.
*   **Pills:** Used for chips and tags to provide visual variety.

## Components
*   **Buttons:** Primary buttons are solid #FF6F20 with #F2F2F2 text, featuring 8px rounded corners.
*   **Cards:** Elevated neutral backgrounds with 16px corner radius and subtle tonal separation.
*   **Input Fields:** Dark surfaces with #4D4D4D borders, transitioning to primary orange on focus.
*   **Selection Controls:** Checkboxes and radio buttons utilize the primary orange for active states to ensure high visibility.
