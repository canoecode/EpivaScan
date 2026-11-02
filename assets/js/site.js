/* EpivaScan — shared site behaviour: header, footer, image slots, reveals.
   Loaded in <head> on every page (classic script, so it also works from file://). */
(function () {
  'use strict';

  /* Fill these in as the real things come online. Empty values render as "Soon". */
  const CONFIG = window.EPIVASCAN = {
    huggingFaceUrl: '',  // public model card on Hugging Face
    modelSpace: '',      // Hugging Face Space that runs the model, as 'user/epivascan' (see ml/space). Empty: built-in sample results
    phoneAppUrl: '',     // store / download link for the phone app
    contactEmail: ''
  };

  const NAV = [
    ['index.html', 'Home'],
    ['how-it-works.html', 'How it works'],
    ['validation.html', 'Validation'],
    ['impact.html', 'Impact'],
    ['about.html', 'About']
  ];
  const here = location.pathname.split('/').pop() || 'index.html';
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer: fine)');

  document.documentElement.classList.add('js');

  function mark(tile, ink, accent, corner) {
    return `<svg class="brand__mark" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="${tile}"/>
      <g fill="none" stroke="${corner}" stroke-width="2" stroke-linecap="round">
        <path d="M8 13.5V11a3 3 0 0 1 3-3h2.5"/><path d="M26.5 8H29a3 3 0 0 1 3 3v2.5"/>
        <path d="M32 26.5V29a3 3 0 0 1-3 3h-2.5"/><path d="M13.5 32H11a3 3 0 0 1-3-3v-2.5"/>
      </g>
      <g fill="${ink}">
        <rect x="13" y="12.8" width="2.9" height="14.4" rx="1.45"/>
        <rect x="13" y="12.8" width="14" height="2.9" rx="1.45"/>
        <rect x="13" y="24.3" width="14" height="2.9" rx="1.45"/>
      </g>
      <rect x="13" y="18.55" width="10" height="2.9" rx="1.45" fill="${accent}"/>
    </svg>`;
  }

  const brand = (svg) =>
    `<a class="brand" href="index.html" aria-label="EpivaScan home">${svg}<span class="brand__name">EpivaScan</span></a>`;

  class SiteHeader extends HTMLElement {
    connectedCallback() {
      const links = NAV.map(([href, label]) =>
        `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${label}</a>`).join('');

      this.innerHTML = `
        <header class="wrap site-header__inner">
          ${brand(mark('#0A1722', '#FFFFFF', '#CB9069', 'rgba(255,255,255,.5)'))}
          <nav class="site-nav" id="site-nav" aria-label="Main">
            ${links}
            <a class="site-nav__cta" href="scan.html">Try the demo</a>
          </nav>
          <a class="btn btn--sm site-header__cta" href="scan.html">Try the demo</a>
          <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">
            <span class="nav-toggle__bars" aria-hidden="true"></span>Menu
          </button>
        </header>`;

      const toggle = this.querySelector('.nav-toggle');
      const setOpen = (open) => {
        this.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
      };
      this.querySelectorAll('.site-nav > a').forEach((a, i) => a.style.setProperty('--i', i));
      toggle.addEventListener('click', () => setOpen(!this.classList.contains('is-open')));

      /* A shadow once the page moves under the header */
      const onScroll = () => this.classList.toggle('is-scrolled', window.scrollY > 4);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
      });
      document.addEventListener('click', (e) => { if (!this.contains(e.target)) setOpen(false); });
    }
  }

  class SiteFooter extends HTMLElement {
    connectedCallback() {
      const links = NAV.slice(1).map(([href, label]) => `<a href="${href}">${label}</a>`).join('');
      this.innerHTML = `
        <footer class="site-footer">
          <div class="wrap">
            <div class="site-footer__top">
              ${brand(mark('#FFFFFF', '#0A1722', '#A56C47', 'rgba(10,23,34,.4)'))}
              <nav class="site-footer__links" aria-label="Footer">
                ${links}
                <a href="scan.html">Web demo</a>
                <a href="about.html#faq">FAQ</a>
                <a href="about.html#contact">Contact</a>
              </nav>
            </div>
            <p class="site-footer__disclaimer"><strong>EpivaScan is not a medical device and does not give a diagnosis.</strong>
              It is a screening aid in development and is no substitute for an examination by a qualified health professional.
              If a skin problem is painful, bleeding, spreading or changing quickly, seek medical care.</p>
            <div class="site-footer__legal">
              <span>&copy; ${new Date().getFullYear()} EpivaScan &middot; In development</span>
              <span>Built to widen access to skin care.</span>
            </div>
          </div>
        </footer>`;
    }
  }

  customElements.define('site-header', SiteHeader);
  customElements.define('site-footer', SiteFooter);

  /* Image slots: <figure class="slot" data-slot="assets/img/impact/01" data-label="Field photo 01">
     Drop a file at that path (.jpg, .jpeg, .png or .webp) and it replaces the placeholder. */
  const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
  const SLOT_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l4.5-4 3.5 3 3-2.5 5 4"/></svg>';

  function initSlot(el) {
    const base = el.dataset.slot;
    const label = el.dataset.label || 'Image';

    const empty = document.createElement('div');
    empty.className = 'slot__empty';
    empty.innerHTML = `${SLOT_ICON}<span class="slot__label"></span><span class="slot__path"></span>`;
    empty.querySelector('.slot__label').textContent = label;
    empty.querySelector('.slot__path').textContent = `${base}.jpg`;
    el.append(empty);
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `Placeholder: ${label}`);

    let attempt = 0;
    const img = new Image();
    img.alt = el.dataset.alt || label;
    img.decoding = 'async';
    if (el.dataset.focus) img.style.objectPosition = el.dataset.focus;  // e.g. data-focus="50% 70%" to keep a subject in the crop
    img.onload = () => {
      el.removeAttribute('role');
      el.removeAttribute('aria-label');
      el.prepend(img);
      if (el.dataset.caption) {
        const cap = document.createElement('figcaption');
        cap.textContent = el.dataset.caption;
        el.append(cap);
      }
      el.classList.add('is-filled');
    };
    img.onerror = () => {
      attempt += 1;
      if (attempt < EXTENSIONS.length) img.src = `${base}.${EXTENSIONS[attempt]}`;
    };
    img.src = `${base}.${EXTENSIONS[0]}`;
  }

  /* Links that depend on CONFIG: <a data-link="huggingFaceUrl">…</a> */
  function initLink(a) {
    const key = a.dataset.link;
    const value = CONFIG[key];
    if (!value) {
      a.removeAttribute('href');
      a.setAttribute('aria-disabled', 'true');
      if (!a.hasAttribute('data-fill')) a.insertAdjacentHTML('beforeend', ' <span class="soon">Soon</span>');
      return;
    }
    if (key === 'contactEmail') {
      a.href = `mailto:${value}`;
      if (a.hasAttribute('data-fill')) a.textContent = value;
    } else {
      a.href = value;
      a.target = '_blank';
      a.rel = 'noopener';
    }
  }

  /* Photo viewer: <a href="full.jpg" data-gallery="name"><img alt="…"></a>. Links sharing a name
     page through together in file-name order; without JS each link still opens the full photo. */
  const ARROW = (d) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  let viewer;

  function openViewer(links, start, opener = links[start]) {
    if (!viewer) {
      viewer = document.createElement('dialog');
      viewer.className = 'lightbox';
      viewer.setAttribute('aria-label', 'Photo viewer');
      viewer.innerHTML = `
        <div class="lightbox__bar"><span class="lightbox__count"></span><button type="button" data-go="close">Close</button></div>
        <div class="lightbox__stage">
          <button type="button" data-go="-1" aria-label="Previous photo">${ARROW('M15 5l-7 7 7 7')}</button>
          <img alt="">
          <button type="button" data-go="1" aria-label="Next photo">${ARROW('M9 5l7 7-7 7')}</button>
        </div>
        <p class="lightbox__caption"></p>
        <div class="lightbox__nav">
          <button type="button" data-go="-1" aria-label="Previous photo">${ARROW('M15 5l-7 7 7 7')}</button>
          <button type="button" data-go="1" aria-label="Next photo">${ARROW('M9 5l7 7-7 7')}</button>
        </div>`;
      document.body.append(viewer);
      viewer.addEventListener('click', (e) => {
        const go = e.target.closest('[data-go]')?.dataset.go;
        if (go === 'close' || e.target === viewer) viewer.close();
        else if (go) viewer.step(Number(go));
      });
      viewer.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') viewer.step(-1);
        if (e.key === 'ArrowRight') viewer.step(1);
      });
      viewer.addEventListener('close', () => viewer.opener?.focus());
    }

    let i = start;
    const img = viewer.querySelector('img');
    const show = () => {
      const alt = links[i].querySelector('img')?.alt || '';
      img.src = links[i].href;
      img.alt = alt;
      viewer.querySelector('.lightbox__caption').textContent = alt;
      viewer.querySelector('.lightbox__count').textContent = `${i + 1} / ${links.length}`;
    };
    viewer.step = (d) => { i = (i + d + links.length) % links.length; show(); };
    viewer.opener = opener;
    show();
    viewer.showModal();
  }

  /* A link with data-gallery-all="name" (the "+12 photos" tile) opens the whole set from the first photo.
     Photos that are only reachable through the viewer can sit in a hidden element. */
  function initGalleries() {
    document.addEventListener('click', (e) => {
      const all = e.target.closest('a[data-gallery-all]');
      const link = all || e.target.closest('a[data-gallery]');
      if (!link || e.metaKey || e.ctrlKey || e.shiftKey || typeof HTMLDialogElement !== 'function') return;
      e.preventDefault();
      const links = [...document.querySelectorAll(`a[data-gallery="${link.dataset.galleryAll || link.dataset.gallery}"]`)]
        .sort((a, b) => a.href.localeCompare(b.href));
      openViewer(links, all ? 0 : links.indexOf(link), link);
    });
  }

  /* .reveal and .wipe animate as one piece; the children of a .stagger follow one another. */
  function initReveals() {
    document.querySelectorAll('.stagger').forEach((group) =>
      [...group.children].forEach((child, i) => child.style.setProperty('--i', i)));
    const items = document.querySelectorAll('.reveal, .wipe, .stagger');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'));
      return;
    }
    /* A .wipe starts fully clipped, which the observer counts as never visible, so its parent is watched instead. */
    const waiting = new Map();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        waiting.get(entry.target).forEach((el) => el.classList.add('is-in'));
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    items.forEach((el) => {
      /* Anything already in view shows straight away instead of waiting on the observer. */
      if (el.getBoundingClientRect().top < window.innerHeight) return el.classList.add('is-in');
      const watched = el.matches('.wipe') ? el.parentElement : el;
      if (!waiting.has(watched)) waiting.set(watched, []);
      waiting.get(watched).push(el);
      io.observe(watched);
    });
  }

  /* Figures count up from zero the first time they come into view: "120+" runs 0+ … 120+.
     Screen readers get the final figure only. */
  function initCounts() {
    const figures = [...document.querySelectorAll('.facts strong')].filter((el) => /^\d+\D*$/.test(el.textContent.trim()));
    if (calm.matches || !figures.length || !('IntersectionObserver' in window)) return;
    const run = (el) => {
      const text = el.textContent.trim();
      const [, digits, suffix] = text.match(/^(\d+)(\D*)$/);
      const target = Number(digits);
      const shown = document.createElement('span');
      const said = document.createElement('span');
      shown.setAttribute('aria-hidden', 'true');
      shown.className = 'count';
      shown.style.minWidth = `${text.length}ch`;
      said.className = 'visually-hidden';
      said.textContent = text;
      el.replaceChildren(shown, said);
      const start = performance.now();
      const length = 900 + Math.min(target, 150) * 3;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / length);
        shown.textContent = Math.round(target * (1 - Math.pow(1 - p, 4))) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.querySelectorAll('strong').forEach((el) => figures.includes(el) && run(el));
      io.unobserve(entry.target);
    }), { threshold: 0.5 });
    new Set(figures.map((el) => el.closest('.facts'))).forEach((list) => io.observe(list));
  }

  /* Graph-paper sections (.grid-bg): a brighter patch of grid follows the pointer, like a loupe.
     In the home hero the phones also lean a little toward it. Mouse and trackpad only. */
  function initLoupes() {
    if (!finePointer.matches) return;
    document.querySelectorAll('.grid-bg').forEach((el) => {
      const tilt = !calm.matches && el.querySelector('.hero__phones');
      let frame = 0;
      let x = 0;
      let y = 0;
      el.addEventListener('pointermove', (e) => {
        const box = el.getBoundingClientRect();
        x = e.clientX - box.left;
        y = e.clientY - box.top;
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          el.style.setProperty('--mx', `${x}px`);
          el.style.setProperty('--my', `${y}px`);
          if (tilt) {
            el.style.setProperty('--tx', (x / box.width - .5).toFixed(3));
            el.style.setProperty('--ty', (y / box.height - .5).toFixed(3));
          }
        });
      });
      el.addEventListener('pointerenter', () => el.classList.add('is-pointing'));
      el.addEventListener('pointerleave', () => {
        el.classList.remove('is-pointing');
        el.style.setProperty('--tx', 0);
        el.style.setProperty('--ty', 0);
      });
    });
  }

  /* The home hero's scan: runs once when the phones arrive, and again on hover once it has finished. */
  function initScanStage() {
    const stage = document.querySelector('[data-scan-stage]');
    if (!stage) return;
    const readout = stage.querySelector('.readout');
    let running = false;
    const run = (first) => {
      if (running) return;
      running = true;
      stage.style.setProperty('--scan-wait', first ? '.75s' : '0s');
      stage.classList.remove('is-scanning');
      void stage.offsetWidth;  // restart the keyframes
      stage.classList.add('is-scanning', 'has-scanned');
      if (calm.matches) running = false;
    };
    readout.addEventListener('animationend', () => { running = false; });
    run(true);
    if (finePointer.matches) stage.addEventListener('pointerenter', () => run(false));
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-slot]').forEach(initSlot);
    document.querySelectorAll('[data-link]').forEach(initLink);
    initGalleries();
    initReveals();
    initCounts();
    initLoupes();
    initScanStage();
  });
})();
