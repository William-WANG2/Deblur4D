/* Results stay collapsed until the viewer opens a section. */
(() => {
  'use strict';
  const buttons = [...document.querySelectorAll('.section-toggle')];
  function setOpen(button, open) {
    const content = document.getElementById(button.getAttribute('aria-controls'));
    button.setAttribute('aria-expanded', String(open));
    button.replaceChildren(document.createTextNode(`${open ? 'Hide' : 'Show'} ${button.dataset.label} `));
    const symbol = document.createElement('span'); symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = open ? '−' : '+'; button.append(symbol);
    content.hidden = !open;
    document.dispatchEvent(new CustomEvent('sectionvisibilitychange', {detail: {content, open}}));
  }
  buttons.forEach(button => button.addEventListener('click', () => setOpen(button, button.getAttribute('aria-expanded') !== 'true')));
  function revealHash() {
    const target = document.getElementById(location.hash.slice(1));
    const section = target?.closest('section');
    const button = section?.querySelector('.section-toggle');
    if (button) setOpen(button, true);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(link.hash.slice(1));
    const button = target?.closest('section')?.querySelector('.section-toggle');
    if (button) setOpen(button, true);
  });
  window.addEventListener('hashchange', revealHash);
  revealHash();
})();
