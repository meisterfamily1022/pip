# Pip visual system

The approved logo source defines the core accent colors. The application uses those colors semantically rather than assigning a different pastel to every component.

| Role | Value | Use |
| --- | --- | --- |
| `brand.primary` | `#72B8C5` | Primary action surface and recognisable Pip blue; paired with dark text |
| `brand.primaryPressed` | `#5CA2B0` | Pressed primary action surface |
| `brand.primarySoft` | `#E6F4F6` | Selected controls, emphasized navigation, and calm blue surfaces |
| `brand.ink` | `#245F6B` | Accessible links, focus indicators, essential icons, and blue-readable text |
| `accent.sage` | `#91A489` | Restrained decorative and supportive accents |
| `accent.mint` | `#83BDD0` | Logo-derived aqua accent; decorative use only when contrast is insufficient |
| `accent.yellow` | `#F9BD4B` | Warm highlight and status decoration, never essential text |
| `accent.lavender` | `#9B83D2` | Restrained playful accent and pale lavender surface source |
| `background.canvas` | `#FFF9F0` | Warm cream Parent Mode canvas |
| `background.child` | `#F6FAF9` | Quiet, lightly cool Child Mode canvas |
| `background.surface` | `#FFFFFF` | Cards, inputs, dialogs, and content surfaces |
| `text.primary` | `#24343A` | Body headings, primary button labels, and essential content |
| `text.secondary` | `#53646A` | Supporting copy |
| `border.default` | `#D5E1E3` | Controls and cards |
| `status.success` | `#356B49` | Success text and icons |
| `status.warning` | `#775815` | Warning text and icons |
| `status.error` | `#A33A3A` | Destructive actions and errors |

The exact logo blue does not meet AA with white text, so primary buttons intentionally use `text.primary` on `brand.primary`. Pale accents are limited to backgrounds and decoration. Destructive actions remain red outlined controls and are never represented by friendly pastel fills.

Legacy token aliases remain temporarily for source compatibility, but resolve to this semantic palette. The remaining non-token `rgba(...)` values are documented backdrop/shadow opacity treatments rather than brand colors.
