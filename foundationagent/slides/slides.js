(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const deck = document.getElementById('deck');
  const progress = document.getElementById('progress');
  const currentNumber = document.getElementById('current-number');
  const totalNumber = document.getElementById('total-number');
  const overview = document.getElementById('overview');
  const overviewGrid = document.getElementById('overview-grid');
  const notes = document.getElementById('notes');
  const notesContent = document.getElementById('notes-content');
  const help = document.getElementById('help-dialog');
  let current = 0;
  let touchStartX = 0;
  let touchStartY = 0;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const pad = value => String(value).padStart(2, '0');

  function indexFromHash() {
    const match = window.location.hash.match(/(?:slide-)?(\d+)/);
    return match ? clamp(Number(match[1]) - 1, 0, slides.length - 1) : 0;
  }

  function updateNotes() {
    const source = slides[current].querySelector('.speaker-note');
    notesContent.textContent = source ? source.textContent.trim() : '本页没有演讲者备注。';
  }

  function showSlide(index, updateHash = true) {
    current = clamp(index, 0, slides.length - 1);
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.classList.toggle('is-active', active);
      slide.classList.toggle('is-before', i < current);
      slide.classList.toggle('is-after', i > current);
      slide.setAttribute('aria-hidden', String(!active));
      slide.inert = !active;
    });
    currentNumber.textContent = pad(current + 1);
    progress.style.width = `${((current + 1) / slides.length) * 100}%`;
    document.title = `${pad(current + 1)} · ${slides[current].dataset.title} — Foundation Agents`;
    updateNotes();
    if (updateHash) history.replaceState(null, '', `#${current + 1}`);
  }

  function toggleOverview(force) {
    const open = typeof force === 'boolean' ? force : overview.hidden;
    overview.hidden = !open;
    document.body.classList.toggle('overlay-open', open);
    if (open) overview.querySelector(`[data-slide-index="${current}"]`)?.focus();
  }

  function toggleNotes(force) {
    const open = typeof force === 'boolean' ? force : notes.hidden;
    notes.hidden = !open;
    notes.classList.toggle('is-open', open);
    if (open) updateNotes();
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) {
      // Fullscreen can be blocked by an embedding host; the deck remains usable.
    }
  }

  function buildOverview() {
    overviewGrid.innerHTML = '';
    slides.forEach((slide, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.slideIndex = String(index);
      button.innerHTML = `<span>${pad(index + 1)}</span><strong>${slide.dataset.title}</strong>`;
      button.addEventListener('click', () => {
        showSlide(index);
        toggleOverview(false);
      });
      overviewGrid.appendChild(button);
    });
  }

  function act(action) {
    if (action === 'next') showSlide(current + 1);
    if (action === 'prev') showSlide(current - 1);
    if (action === 'overview') toggleOverview();
    if (action === 'overview-close') toggleOverview(false);
    if (action === 'fullscreen') toggleFullscreen();
    if (action === 'notes') toggleNotes();
    if (action === 'notes-close') toggleNotes(false);
    if (action === 'help') help.showModal();
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (target) act(target.dataset.action);
  });

  document.addEventListener('keydown', event => {
    if (help.open) return;
    if (!overview.hidden && event.key === 'Escape') return toggleOverview(false);
    if (!notes.hidden && event.key === 'Escape') return toggleNotes(false);
    if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault();
      showSlide(current + 1);
    } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      showSlide(current - 1);
    } else if (event.key === 'Home') showSlide(0);
    else if (event.key === 'End') showSlide(slides.length - 1);
    else if (event.key.toLowerCase() === 'o') toggleOverview();
    else if (event.key.toLowerCase() === 'f') toggleFullscreen();
    else if (event.key.toLowerCase() === 'n') toggleNotes();
    else if (event.key === '?') help.showModal();
  });

  deck.addEventListener('touchstart', event => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
  }, { passive: true });

  deck.addEventListener('touchend', event => {
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      showSlide(current + (deltaX < 0 ? 1 : -1));
    }
  }, { passive: true });

  window.addEventListener('hashchange', () => showSlide(indexFromHash(), false));
  totalNumber.textContent = pad(slides.length);
  buildOverview();
  showSlide(indexFromHash(), false);
})();
