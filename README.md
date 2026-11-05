# Deblur4D project website

Static research website for Deblur4D: Feed-Forward 4D Reconstruction from Blurry RGB and Complementary Vision.

The page separates six synchronized eight-view comparisons, two ablation studies, and motion predictions. Comparison order: tossing a basketball, moving flowers, kicking, moving ball, moving cushion, and waving fabric.

The sensor ablation shows Swinging Minion in one six-panel row: RGB, TD, SD, RGB-only reconstruction, exposure TD/SD, and the addition of inter-frame SD. The training ablation compares labeled-only and additional unlabeled training on spinning-disc and pinwheel depth, alongside RGB → SD → RGB inputs. Depth retains the original relative color mapping within each prediction. Swinging Minion includes a head-following circular marker and magnified right-side inset in every panel.

Motion includes fabric/cushion displacement fields and disc/pinwheel image-space point tracks. Features are tracked directly on the displayed rendered frames with forward/backward consistency filtering, with short trails and stable point colors. These are image-space visualization tracks, not native 3D trajectories. Their left panels show RGB → SD → RGB inputs.

All temporal clips retain 13 frames at 12 FPS. Comparison playback alternates a pass with two camera orbits in 2.083 seconds and an uninterrupted pass. Players include synchronized seeking, fullscreen, reduced-motion support, and H.264/VP9 media. Comparison, Ablation, Motion, and Method are collapsed by default and open through section buttons or navigation links. The interactive method walkthrough explains the three reconstruction stages.

GitHub Pages serves the root of the main branch; .nojekyll preserves the static assets. This repository contains only public website assets, excluding original datasets, checkpoints, research manuscripts, render caches, and private provenance.

Page design inspired by [CoGenRec](https://cogenrec.github.io/).
