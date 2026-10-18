/* Native Ours diagnostic clips, preserving their original colors and cadence. */
(() => {
  'use strict';
  async function initOutputs() {
    const root = document.querySelector('#output-galleries');
    if (!root) return;
    try {
      const response = await fetch('assets/outputs.json', {cache: 'no-store'});
      if (!response.ok) throw Error('Output manifest unavailable');
      const clips = await response.json();
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');
      const states = [];
      root.replaceChildren();
      for (const [kind, heading, description] of [
        ['motion_time0', 'Scene motion', 'Displacements toward t₀ across source frames. Red, green, and blue encode the normalized X, Y, and Z components.'],
        ['depth', 'Scene depth', 'Dense geometry across the captured sequence, shown with the original depth color mapping.'],
      ]) {
        const group = document.createElement('div');
        group.className = `output-group ${kind}`;
        const h = document.createElement('h3'); h.textContent = heading;
        const p = document.createElement('p'); p.className = 'output-description'; p.textContent = description;
        const grid = document.createElement('div'); grid.className = 'output-grid';
        group.append(h, p, grid);
        for (const clip of clips.filter(c => c.kind === kind)) {
          const card = document.createElement('figure'); card.className = 'output-card'; card.dataset.outputId = clip.id;
          const caption = document.createElement('figcaption');
          const title = document.createElement('h4'); title.textContent = clip.title;
          const label = document.createElement('span'); label.textContent = kind === 'motion_time0' ? 'Ours · motion_time0' : 'Ours · depth';
          caption.append(title, label);
          const video = document.createElement('video');
          video.controls = true; video.muted = true; video.loop = true; video.playsInline = true;
          video.preload = 'none'; video.poster = clip.poster;
          video.width = clip.width; video.height = clip.height;
          video.setAttribute('aria-label', `${clip.title}: our ${kind} prediction`);
          for (const [url, type] of [[clip.video, `video/mp4; codecs="${clip.mp4Codec}"`], [clip.webm, 'video/webm; codecs="vp9"']]) {
            const source = document.createElement('source'); source.src = `${url}?v=${clip.mediaVersion}`; source.type = type; video.append(source);
          }
          const message = document.createElement('p'); message.className = 'output-error'; message.hidden = true;
          message.setAttribute('role', 'status');
          video.addEventListener('error', () => {message.hidden = false; message.textContent = 'This clip could not load. Reload the page to retry.';});
          card.append(caption, video, message); grid.append(card);
          const state = {video, card, visible: false, wanted: !reduced.matches}; states.push(state);
          video.addEventListener('play', () => {state.wanted = true;});
          // Programmatic offscreen pauses do not erase the viewer's play intent.
          video.addEventListener('pause', () => {if (state.visible && !document.hidden) state.wanted = false;});
        }
        root.append(group);
      }
      const resume = state => {
        if (state.visible && !document.hidden && state.wanted) state.video.play().catch(() => {});
        else state.video.pause();
      };
      const byCard = new Map(states.map(s => [s.card, s]));
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {const state = byCard.get(entry.target); state.visible = entry.isIntersecting; resume(state);}
      }, {threshold: .15});
      states.forEach(state => observer.observe(state.card));
      document.addEventListener('visibilitychange', () => states.forEach(resume));
      reduced.addEventListener('change', event => {if (event.matches) states.forEach(state => {state.wanted = false; state.video.pause();});});
    } catch {
      root.textContent = 'The motion and depth clips could not be loaded. Reload the page to retry.';
    }
  }
  initOutputs();
})();
