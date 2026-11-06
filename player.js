/* One decoded video per scene; orbit inputs use the shared midpoint still. */
'use strict';

const ICONS = {
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  replay: '<path d="M3 10a9 9 0 1 1 2 9M3 4v6h6"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
const LABELS = {
  rgb: ['RGB', 'Blurry input'], td: ['TD', 'Temporal differences'],
  sd: ['SD', 'Spatial differences'], ours: ['Ours', '4DCVS'],
  ufo_rgb: ['UFO-4D', 'Blurry RGB'], tmcdeblur_ufo: ['STD-Deblur + UFO-4D', ''],
  bim_vfi_vggt_movies: ['BiM-VFI + VGGT-Ω + MoVieS', ''],
  igfnet_vggt_movies: ['IGFNet + VGGT-Ω + MoVieS', ''],
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Magnify the displayed tiles, including the frozen inputs, at matching coordinates.
class ComparisonMagnifier {
  constructor(layout, drawers) {
    this.active = false;
    this.frame = 0;
    this.position = {x: .5, y: .5};
    this.pointer = matchMedia('(hover: hover) and (pointer: fine)');
    this.items = drawers.map(({stage, ctx}) => {
      const lens = element('div', 'comparison-lens');
      lens.setAttribute('aria-hidden', 'true');
      const canvas = element('canvas', 'lens-canvas');
      canvas.width = canvas.height = 1;
      lens.append(canvas, element('span', 'lens-power', '4×'));
      stage.append(lens);
      stage.addEventListener('pointerenter', event => {
        if (!this.pointer.matches || event.pointerType !== 'mouse') return;
        this.active = true;
        this.measure();
        this.items.forEach(item => item.stage.classList.add('is-magnifying'));
        this.move(event, stage);
      });
      stage.addEventListener('pointermove', event => {
        if (this.active && event.pointerType === 'mouse') this.move(event, stage);
      });
      stage.addEventListener('pointerleave', () => this.hide());
      stage.addEventListener('pointercancel', () => this.hide());
      return {stage, source: ctx.canvas, lens, canvas, ctx: canvas.getContext('2d', {alpha: false})};
    });
    new ResizeObserver(() => {
      if (this.active) { this.measure(); this.draw(); }
    }).observe(layout);
    this.pointer.addEventListener('change', () => this.hide());
    window.addEventListener('blur', () => this.hide());
    window.addEventListener('keydown', event => { if (event.key === 'Escape') this.hide(); });
  }
  measure() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    for (const item of this.items) {
      const bounds = item.stage.getBoundingClientRect();
      item.width = bounds.width;
      item.height = bounds.height;
      item.size = Math.max(1, Math.min(148, bounds.width * .46, bounds.height - 8));
      item.lens.style.width = `${item.size}px`;
      const pixels = Math.max(1, Math.round(item.size * dpr));
      if (item.canvas.width !== pixels) item.canvas.width = item.canvas.height = pixels;
    }
  }
  move(event, stage) {
    const rect = stage.getBoundingClientRect();
    this.position = {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
    if (!this.frame) this.frame = requestAnimationFrame(() => this.draw());
  }
  draw() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (!this.active) return;
    for (const item of this.items) {
      const {source, lens, canvas, ctx, width, height, size} = item;
      if (!width || !height) continue;
      // Preserve the full 2:1 image coordinates; never sample an adjacent atlas tile.
      const cropWidth = size / 4 * source.width / width;
      const cropHeight = size / 4 * source.height / height;
      const x = Math.max(0, Math.min(source.width - cropWidth, this.position.x * source.width - cropWidth / 2));
      const y = Math.max(0, Math.min(source.height - cropHeight, this.position.y * source.height - cropHeight / 2));
      const left = Math.max(2, Math.min(width - size - 2, this.position.x * width - size / 2));
      const top = Math.max(2, Math.min(height - size - 2, this.position.y * height - size / 2));
      lens.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, x, y, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    }
  }
  hide() {
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.items.forEach(item => item.stage.classList.remove('is-magnifying'));
  }
}

class ScenePlayer {
  constructor(scene, index, list) {
    this.scene = scene;
    this.visible = false;
    this.wantPlaying = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.loaded = false;
    this.lastFrame = -1;
    this.drawers = [];
    const card = this.card = element('article', 'scene-card');
    card.id = `scene-${scene.id}`;
    const heading = element('header', 'scene-heading');
    const titleWrap = element('div', 'scene-title-wrap');
    titleWrap.append(element('span', 'scene-index', String(index + 1).padStart(2, '0')));
    const title = element('h3', '', scene.title);
    title.id = `title-${scene.id}`;
    titleWrap.append(title);
    this.passLabel = element('span', 'scene-tag', 'With orbit · 1/2');
    heading.append(titleWrap, this.passLabel);
    card.append(heading);
    const root = this.root = element('div', 'comparison-player');
    root.setAttribute('role', 'group');
    root.setAttribute('aria-labelledby', title.id);
    const video = this.video = element('video', 'atlas-video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.tabIndex = -1;
    video.setAttribute('aria-hidden', 'true');
    root.append(video);
    const layout = element('div', 'comparison-layout');
    for (const [groupName, keys] of [
      ['Sensor inputs and 4DCVS', ['rgb', 'td', 'sd', 'ours']],
      ['Baseline reconstructions', ['ufo_rgb', 'tmcdeblur_ufo', 'bim_vfi_vggt_movies', 'igfnet_vggt_movies']],
    ]) {
      const group = element('div', 'view-group');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', groupName);
      keys.forEach(key => {
        const sensor = ['rgb', 'td', 'sd'].includes(key);
        const tile = element('figure', `view-tile ${sensor ? 'sensor' : key === 'ours' ? 'ours' : 'baseline'}`);
        const caption = element('figcaption', 'view-name');
        caption.append(element('span', 'method-name', LABELS[key][0]));
        if (LABELS[key][1]) caption.append(element('span', 'method-subtitle', LABELS[key][1]));
        if (sensor) caption.append(element('span', 'frozen', 'Ⅱ Frozen'));
        const canvas = element('canvas');
        canvas.width = scene.tileWidth;
        canvas.height = scene.tileHeight;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `${scene.title}: ${LABELS[key].join(' ')}`);
        canvas.dataset.view = key;
        const stage = element('div', 'comparison-media');
        stage.append(canvas);
        tile.append(caption, stage);
        group.append(tile);
        const tileIndex = scene.tileOrder.indexOf(key);
        this.drawers.push({stage, ctx: canvas.getContext('2d', {alpha: false}), sensor,
          x: (tileIndex % 4) * scene.tileWidth, y: Math.floor(tileIndex / 4) * scene.tileHeight});
      });
      layout.append(group);
    }
    root.append(layout);
    this.magnifier = new ComparisonMagnifier(layout, this.drawers);
    const controls = element('div', 'player-controls');
    const transport = element('div', 'transport');
    const makeButton = (icon, label, className = '') => {
      const button = element('button', `player-button ${className}`);
      button.type = 'button';
      button.innerHTML = svg(icon);
      button.setAttribute('aria-label', `${label} ${scene.title}`);
      button.title = label;
      return button;
    };
    this.playButton = makeButton('play', 'Play', 'play-button');
    this.playButton.addEventListener('click', () => this.toggle());
    const replay = makeButton('replay', 'Replay');
    replay.addEventListener('click', () => {
      this.load();
      video.currentTime = 0;
      this.wantPlaying = true;
      this.play();
    });
    transport.append(this.playButton, replay);
    this.seek = element('input', 'player-seek');
    this.seek.type = 'range';
    this.seek.min = 0;
    this.seek.max = scene.frameCount - 1;
    this.seek.step = 1;
    this.seek.value = 0;
    this.seek.setAttribute('aria-label', `Seek ${scene.title}`);
    this.seek.addEventListener('input', () => {
      this.load();
      this.wantPlaying = false;
      video.pause();
      // Seek inside each frame's interval, avoiding timestamp-boundary rounding.
      video.currentTime = (Number(this.seek.value) + 0.1) / scene.fps;
      this.update(Number(this.seek.value));
    });
    this.phase = element('span', 'phase', 'Scene playback');
    this.frameLabel = element('span', 'frame-label', 't = 0.00');
    const fullscreen = this.fullscreenButton = makeButton('expand', 'Fullscreen', 'fullscreen-button');
    fullscreen.hidden = !root.requestFullscreen;
    fullscreen.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === root) await document.exitFullscreen();
        else await root.requestFullscreen();
      } catch { this.setStatus('Fullscreen is unavailable in this browser.'); }
    });
    controls.append(transport, this.seek, this.phase, this.frameLabel, fullscreen);
    root.append(controls);
    this.status = element('p', 'player-status');
    this.status.hidden = true;
    this.status.setAttribute('role', 'status');
    root.append(this.status);
    card.append(root);
    list.append(card);
    const poster = this.poster = new Image();
    poster.onload = () => {
      if (video.readyState < 2) { this.draw(poster); this.update(6 * (scene.sourceFrameStride || 1)); }
      else this.render();
    };
    poster.src = scene.poster;
    video.addEventListener('loadeddata', () => { this.setStatus(''); this.render(); });
    video.addEventListener('seeked', () => this.render());
    video.addEventListener('play', () => {
      this.setStatus('');
      this.updatePlayButton();
      if (!video.requestVideoFrameCallback) this.animate();
    });
    video.addEventListener('pause', () => this.updatePlayButton());
    video.addEventListener('error', () => {
      this.wantPlaying = false;
      this.setStatus('This clip could not be loaded. Check that the media files are included, then reload the page.');
      this.updatePlayButton();
    });
    if (video.requestVideoFrameCallback) {
      const onFrame = (_now, metadata) => {
        const frame = Math.min(scene.frameCount - 1, Math.round(metadata.mediaTime * scene.fps));
        this.draw(video, frame);
        this.update(frame);
        video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
    }
  }

  draw(source, frame = -1) {
    const {tileWidth: w, tileHeight: h} = this.scene;
    const orbit = frame >= this.scene.orbitStartFrame && frame < this.scene.orbitEndFrame;
    // Re-encoding a repeated image can introduce tiny changes at keyframes.
    // The poster contains exactly source frame 6 for every input, so using it
    // during the orbit also makes direct seeks and both laps truly still.
    const hold = orbit && this.poster?.complete && this.poster.naturalWidth > 0;
    for (const {ctx, x, y, sensor} of this.drawers) {
      if (hold && sensor && this.inputsHeld) continue;
      ctx.drawImage(hold && sensor ? this.poster : source, x, y, w, h, 0, 0, w, h);
    }
    this.inputsHeld = hold;
    this.magnifier.draw();
  }
  render() {
    if (this.video.readyState < 2) return;
    const frame = Math.min(this.scene.frameCount - 1, Math.floor(this.video.currentTime * this.scene.fps + 0.0001));
    this.draw(this.video, frame);
    this.update(frame);
  }
  animate() {
    if (this.video.paused) return;
    this.render();
    requestAnimationFrame(() => this.animate());
  }
  update(frame) {
    const s = this.scene;
    const orbit = frame >= s.orbitStartFrame && frame < s.orbitEndFrame;
    const stride = s.sourceFrameStride || 1;
    const plain = s.plainPassStartFrame !== undefined && frame >= s.plainPassStartFrame;
    const sourceFrame = plain ? Math.floor((frame - s.plainPassStartFrame) / stride)
      : orbit ? 6 : Math.floor((frame < s.orbitStartFrame ? frame : frame - (s.orbitEndFrame - s.orbitStartFrame)) / stride);
    this.root.classList.toggle('is-orbit', orbit);
    const pass = plain ? 'without-orbit' : 'with-orbit';
    if (this.root.dataset.pass !== pass) {
      this.root.dataset.pass = pass;
      this.passLabel.textContent = plain ? 'Without orbit · 2/2' : 'With orbit · 1/2';
    }
    const lap = Math.min(s.orbitLoops || 1, 1 + Math.floor((frame - s.orbitStartFrame) / (s.orbitLapFrames || s.nativeOrbitFrames || 25)));
    const phase = orbit ? `Novel-view orbit · ${lap}/${s.orbitLoops || 1}` : plain ? 'Uninterrupted playback' : 'Scene playback';
    const frameText = `t = ${(sourceFrame / (s.sourceFrames - 1)).toFixed(2)}`;
    if (this.phase.textContent !== phase) this.phase.textContent = phase;
    if (this.frameLabel.textContent !== frameText) this.frameLabel.textContent = frameText;
    this.seek.value = frame;
    const seekText = `${orbit ? 'Novel-view orbit, ' : ''}scene time ${(sourceFrame / 12).toFixed(2)}`;
    if (this.seek.getAttribute('aria-valuetext') !== seekText) this.seek.setAttribute('aria-valuetext', seekText);
    this.lastFrame = frame;
  }
  load() {
    if (this.loaded) return;
    this.loaded = true;
    // Explicit codec declarations let Chromium builds without proprietary H.264
    // support skip MP4 and select the matching VP9 stream.
    for (const [src, type] of [[this.scene.video, `video/mp4; codecs="${this.scene.mp4Codec || 'avc1.640028'}"`],
      [this.scene.webm, 'video/webm; codecs="vp9"']]) {
      if (!src) continue;
      const source = document.createElement('source');
      source.src = this.scene.mediaVersion ? `${src}?v=${this.scene.mediaVersion}` : src;
      source.type = type;
      this.video.append(source);
    }
    this.video.load();
  }
  async play() {
    this.load();
    try { await this.video.play(); }
    catch (error) {
      if (error.name !== 'AbortError') {
        this.wantPlaying = false;
        this.setStatus(error.name === 'NotAllowedError' ? 'Press play to start this clip.'
          : 'This clip could not be loaded. Check that the media files are included, then reload the page.');
        this.updatePlayButton();
      }
    }
  }
  toggle() {
    this.wantPlaying = this.video.paused;
    if (this.wantPlaying) this.play();
    else this.video.pause();
  }
  updatePlayButton() {
    const paused = this.video.paused;
    this.playButton.innerHTML = svg(paused ? 'play' : 'pause');
    this.playButton.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} ${this.scene.title}`);
    this.playButton.title = paused ? 'Play' : 'Pause';
  }
  setStatus(text) { this.status.textContent = text; this.status.hidden = !text; }
  setVisible(visible) {
    this.visible = visible;
    if (!visible || document.hidden) this.magnifier.hide();
    if (visible && !document.hidden && this.wantPlaying) this.play();
    else this.video.pause();
  }
}

async function init() {
  const list = document.querySelector('#scene-list');
  try {
    const response = await fetch('assets/scenes.json', {cache: 'no-store'});
    if (!response.ok) throw new Error('Scene manifest unavailable');
    const scenes = (await response.json()).filter(scene => scene.section !== 'ablation');
    list.replaceChildren();
    const players = scenes.map((scene, index) => new ScenePlayer(scene, index, list));
    const byCard = new Map(players.map(p => [p.card, p]));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) byCard.get(entry.target).setVisible(entry.isIntersecting);
    }, {threshold: 0.15});
    players.forEach(p => observer.observe(p.card));
    document.addEventListener('sectionvisibilitychange', event => {
      if (!event.detail.open) players.filter(p => event.detail.content.contains(p.card)).forEach(p => p.setVisible(false));
    });
    document.addEventListener('visibilitychange', () => players.forEach(p => p.setVisible(p.visible)));
    document.addEventListener('fullscreenchange', () => {
      for (const player of players) {
        const active = document.fullscreenElement === player.root;
        player.fullscreenButton.title = active ? 'Exit fullscreen' : 'Fullscreen';
        player.fullscreenButton.setAttribute('aria-label', `${active ? 'Exit fullscreen' : 'Fullscreen'} ${player.scene.title}`);
      }
    });
  } catch {
    list.replaceChildren(element('p', 'loading-message', 'The scene files could not be loaded. Open this page through the local preview server described in the README.'));
  }
}
init();
