# Visual and usability audit

Completed before the 2026-07-29 redesign.

- Typography and spacing: screens mixed page-level type rules and padding; headings and supporting copy now share a restrained serif/sans hierarchy and one responsive page shell.
- Cards and imagery: wide, inconsistent cards and large upload rectangles made the interface feel unfinished. Cards are now controlled, softly bordered surfaces; toy imagery uses square tiles with compact illustrated fallbacks.
- Navigation and actions: parent navigation previously had equal-weight pastel actions and hidden route headers. The redesign introduces clear page headers, back navigation, primary/secondary/quiet/destructive actions, and lower visual demand.
- Density and responsive behavior: shared pages center at 960px on desktop, use safe full-width mobile padding, and let child play choices flow from one column on narrow phones to multiple balanced columns on larger viewports.
- Child versus parent: Parent Mode is calmer and more informational; Child Mode keeps one decision per card and uses simple geometric garden/toy illustrations instead of emoji-led navigation.
- Accessibility: all primary controls keep role/labels and at least 44px targets, selected states remain visible, explanatory text has darker evergreen contrast, and loading/error views remain announced.

Review cycle one found a stale local preview on the previous server; a fresh Expo web preview was used for review. Desktop Parent Home and both desktop and 390px Child Play Type were inspected. The phone layout correctly collapses play types to a relaxed single-column flow; desktop uses balanced compact cards without oversized empty media.
