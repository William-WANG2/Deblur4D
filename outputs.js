/* Each card uses one video timeline, including responsive multi-panel studies. */
(() => {
  'use strict';
  async function initOutputs() {
    const root = document.querySelector('#output-galleries');
    if (!root) return;
    try {
      const responses = await Promise.all(['outputs', 'studies'].map(name => fetch(`assets/${name}.json`, {cache: 'no-store'})));
      if (responses.some(response => !response.ok)) throw Error('Output manifest unavailable');
      const clips = (await Promise.all(responses.map(response => response.json()))).flat();
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');
      const states = [];
      root.replaceChildren();
      const ablationRoot = document.querySelector('#ablation-galleries');
      ablationRoot.replaceChildren();
      for (const [kind, heading, description, destination] of [
        ['sensor', '01 · CVS sensor measurements', 'Complementary signals improve reconstruction.', ablationRoot],
        ['training', '02 · Learning from unlabeled captures', 'Unlabeled training improves relative depth.', ablationRoot],
        ['motion_time0', 'Motion', '3D motion toward the first frame.', root],
        ['tracks', 'Point tracks', 'Point trajectories on rendered frames.', root],
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
          const label = document.createElement('span'); label.textContent = kind === 'sensor' ? 'Sensor ablation' : kind === 'training' ? 'Training ablation' : heading;
          caption.append(title, label);
          const headings = document.createElement('div'); headings.className = 'output-pair-labels';
          const inputLabel = document.createElement('span'); inputLabel.textContent = 'Input · RGB → SD → RGB';
          const resultLabel = document.createElement('span'); resultLabel.textContent = heading;
          headings.append(inputLabel, resultLabel);
          const video = document.createElement('video');
          video.muted = true; video.loop = true; video.playsInline = true;
          video.preload = 'none'; video.poster = `${clip.poster}?v=${clip.mediaVersion}`;
          video.width = clip.width; video.height = clip.height;
          video.setAttribute('aria-label', `${clip.title}: ${clip.panels ? clip.panels.join(', ') : 'synchronized RGB to SD to RGB inputs and motion prediction'}`);
          let drawPanels = () => {};
          let panelLayout;
          if (clip.panels) {
            card.classList.add('study-card');
            card.dataset.studyKind = kind;
            video.classList.add('study-atlas');
            video.tabIndex = -1; video.setAttribute('aria-hidden', 'true');
            headings.hidden = true;
            panelLayout = document.createElement('div'); panelLayout.className = `study-panels study-panels-${clip.panels.length}`;
            if (clip.panels.length === 6) {
              panelLayout.tabIndex = 0;
              panelLayout.setAttribute('role', 'group');
              panelLayout.setAttribute('aria-label', 'Sensor ablation panels; scroll horizontally on narrow screens');
            }
            const canvases = clip.panels.map((name, index) => {
              const panel = document.createElement('div'); panel.className = 'study-panel';
              const title = document.createElement('div'); title.className = 'study-panel-label'; title.textContent = name;
              const canvas = document.createElement('canvas'); canvas.width = clip.tileWidth; canvas.height = clip.tileHeight;
              canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${clip.title}: ${name}`);
              panel.append(title, canvas); panelLayout.append(panel);
              return {ctx: canvas.getContext('2d', {alpha: false}), index};
            });
            const draw = source => canvases.forEach(({ctx, index}) => ctx.drawImage(source,
              index * clip.tileWidth, 0, clip.tileWidth, clip.tileHeight, 0, 0, clip.tileWidth, clip.tileHeight));
            drawPanels = () => {if (video.readyState >= 2) draw(video);};
            const poster = new Image();
            poster.onload = () => {if (video.readyState < 2) draw(poster);}; poster.src = `${clip.poster}?v=${clip.mediaVersion}`;
          }
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
            const frame = video.readyState < 2 ? 6 : Math.min(clip.frameCount - 1, Math.floor(video.currentTime * clip.fps + .0001));
            seek.value = frame; time.textContent = `t = ${(frame / (clip.frameCount - 1)).toFixed(2)}`;
            seek.setAttribute('aria-valuetext', `Frame ${frame + 1} of ${clip.frameCount}`);
          };
          play.addEventListener('click', () => {
            if (video.paused) video.play().catch(() => {message.hidden = false; message.textContent = 'This clip could not play. Try again.';});
            else video.pause();
          });
          seek.addEventListener('input', () => {video.preload = 'auto'; video.pause(); video.currentTime = (Number(seek.value) + .1) / clip.fps;});
          for (const event of ['play', 'pause', 'timeupdate', 'seeked', 'loadeddata']) video.addEventListener(event, () => {updateControls(); drawPanels();});
          if (video.requestVideoFrameCallback) {
            const onFrame = () => {updateControls(); drawPanels(); video.requestVideoFrameCallback(onFrame);};
            video.requestVideoFrameCallback(onFrame);
          }
          updateControls();
          controls.append(play, seek, time, fullscreen);
          playback.append(headings, video);
          if (panelLayout) playback.append(panelLayout);
          playback.append(controls);
          card.append(caption, playback, message); grid.append(card);
          const state = {video, card, visible: false, wanted: !reduced.matches}; states.push(state);
          video.addEventListener('play', () => {state.wanted = true;});
          // Programmatic offscreen pauses do not erase the viewer's play intent.
          video.addEventListener('pause', () => {if (state.visible && !document.hidden) state.wanted = false;});
        }
        destination.append(group);
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
      document.addEventListener('sectionvisibilitychange', event => {
        if (!event.detail.open) states.filter(state => event.detail.content.contains(state.card)).forEach(state => {state.visible = false; resume(state);});
      });
      document.addEventListener('visibilitychange', () => states.forEach(resume));
      reduced.addEventListener('change', event => {if (event.matches) states.forEach(state => {state.wanted = false; state.video.pause();});});
    } catch {
      root.textContent = 'The motion clips could not be loaded. Reload the page to retry.';
      document.querySelector('#ablation-galleries').textContent = 'The ablation clips could not be loaded. Reload the page to retry.';
    }
  }
  initOutputs();
})();
