/* One shared video keeps RGB/SD inputs and native Ours predictions in sync. */
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
        ['motion_time0', 'Motion', 'Displacements toward t₀ across source frames. Red, green, and blue encode the normalized X, Y, and Z components.'],
        ['depth', 'Depth', 'Dense geometry across the captured sequence, shown with the original depth color mapping.'],
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
          const label = document.createElement('span'); label.textContent = heading;
          caption.append(title, label);
          const headings = document.createElement('div'); headings.className = 'output-pair-labels';
          const inputLabel = document.createElement('span'); inputLabel.textContent = 'Input · RGB → SD → RGB';
          const resultLabel = document.createElement('span'); resultLabel.textContent = heading;
          headings.append(inputLabel, resultLabel);
          const video = document.createElement('video');
          video.muted = true; video.loop = true; video.playsInline = true;
          video.preload = 'none'; video.poster = clip.poster;
          video.width = clip.width; video.height = clip.height;
          video.setAttribute('aria-label', `${clip.title}: synchronized RGB to SD to RGB inputs and our ${kind} prediction`);
          for (const [url, type] of [[clip.video, `video/mp4; codecs="${clip.mp4Codec}"`], [clip.webm, 'video/webm; codecs="vp9"']]) {
            const source = document.createElement('source'); source.src = `${url}?v=${clip.mediaVersion}`; source.type = type; video.append(source);
          }
          const message = document.createElement('p'); message.className = 'output-error'; message.hidden = true;
          message.setAttribute('role', 'status');
          video.addEventListener('error', () => {message.hidden = false; message.textContent = 'This clip could not load. Reload the page to retry.';});
          const playback = document.createElement('div'); playback.className = 'output-playback';
          const controls = document.createElement('div'); controls.className = 'output-controls';
          const play = document.createElement('button'); play.type = 'button'; play.className = 'player-button output-play';
          const seek = document.createElement('input'); seek.type = 'range'; seek.className = 'output-seek';
          seek.min = 0; seek.max = clip.frameCount - 1; seek.step = 1; seek.value = 0;
          seek.setAttribute('aria-label', `Seek ${clip.title} input and prediction`);
          const time = document.createElement('span'); time.className = 'output-time';
          const fullscreen = document.createElement('button'); fullscreen.type = 'button'; fullscreen.className = 'player-button output-fullscreen';
          fullscreen.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
          fullscreen.setAttribute('aria-label', `Fullscreen ${clip.title} input and prediction`);
          fullscreen.hidden = !playback.requestFullscreen;
          fullscreen.addEventListener('click', async () => {
            try { if (document.fullscreenElement === playback) await document.exitFullscreen(); else await playback.requestFullscreen(); }
            catch { message.hidden = false; message.textContent = 'Fullscreen is unavailable in this browser.'; }
          });
          const updateControls = () => {
            play.textContent = video.paused ? '▶' : 'Ⅱ';
            play.setAttribute('aria-label', `${video.paused ? 'Play' : 'Pause'} ${clip.title} input and prediction`);
            const frame = Math.min(clip.frameCount - 1, Math.floor(video.currentTime * clip.fps + .0001));
            seek.value = frame; time.textContent = `t = ${(frame / (clip.frameCount - 1)).toFixed(2)}`;
            seek.setAttribute('aria-valuetext', `Frame ${frame + 1} of ${clip.frameCount}`);
          };
          play.addEventListener('click', () => {
            if (video.paused) video.play().catch(() => {message.hidden = false; message.textContent = 'This clip could not play. Try again.';});
            else video.pause();
          });
          seek.addEventListener('input', () => {video.preload = 'auto'; video.pause(); video.currentTime = (Number(seek.value) + .1) / clip.fps;});
          for (const event of ['play', 'pause', 'timeupdate', 'seeked', 'loadedmetadata']) video.addEventListener(event, updateControls);
          if (video.requestVideoFrameCallback) {
            const onFrame = () => {updateControls(); video.requestVideoFrameCallback(onFrame);};
            video.requestVideoFrameCallback(onFrame);
          }
          updateControls();
          controls.append(play, seek, time, fullscreen);
          playback.append(headings, video, controls);
          card.append(caption, playback, message); grid.append(card);
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
