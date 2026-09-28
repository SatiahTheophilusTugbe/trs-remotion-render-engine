# Third-party notices

## RenderComp free-remotion-templates

- Source: https://github.com/RenderComp/free-remotion-templates
- Copyright (c) 2026 Trimora Inc.
- License: MIT

Techniques (easing curves, blur, geometry, timing) were ported and re-skinned for TRS in the
prototype-only bake-off code under `src/bakeoff/` (never deployed), and the glass lower-third and the
odometer stat were then promoted into production as
`src/compositions/GlassBanner.tsx` and `src/compositions/OdometerStat.tsx`. Each ported file keeps the
upstream SPDX header:

| File | Upstream component |
| --- | --- |
| `src/bakeoff/fx/WhipPanFx.tsx` | `whip-pan/WhipPan.tsx` |
| `src/bakeoff/fx/IrisFx.tsx` | `transition-circle-wipe/TransitionCircleWipe.tsx` |
| `src/bakeoff/fx/SlideShakeFx.tsx` | `slide-wipe/SlideWipe.tsx`, `camera-shake/CameraShake.tsx` |
| `src/bakeoff/GlassLowerThird.tsx` | `lower-third-glass-card/LowerThirdGlassCard.tsx` |
| `src/compositions/GlassBanner.tsx` (production) | `lower-third-glass-card/LowerThirdGlassCard.tsx` |
| `src/bakeoff/KpiStat.tsx` | `kpi-counter/KpiCounter.tsx` |
| `src/compositions/OdometerStat.tsx` (production) | `kpi-counter/KpiCounter.tsx` |
| `src/bakeoff/ParallaxPhoto.tsx` | `parallax-pan/ParallaxPan.tsx` (idea) |

MIT License text: permission is granted, free of charge, to any person obtaining a copy of the
software and associated documentation files, to deal in the software without restriction, subject
to inclusion of the above copyright notice and this permission notice in all copies or substantial
portions of the software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
