# Deblur4D project website

Static research website for Deblur4D: Feed-Forward 4D Reconstruction from Blurry RGB and Complementary Vision.

The site includes nine synchronized eight-view comparisons, four synchronized input/ours motion/depth videos, and an interactive three-stage method walkthrough. Temporal clips retain their original 12 FPS cadence. Comparison playback alternates a pass with two camera orbits in 2.083 seconds and an uninterrupted pass.

## Hosting

GitHub Pages serves the root of the `main` branch. `.nojekyll` preserves the static assets without a Jekyll build. All required MP4/WebM files are included in this repository.

The repository contains the public website only. Original datasets, checkpoints, render caches, research manuscripts, and local source records are excluded.

Page design inspired by [CoGenRec](https://cogenrec.github.io/).

Motion/depth pairs show the start RGB, intermediate SD, and end RGB alongside the prediction, sharing 13 frames at 12 FPS and one set of playback controls.
