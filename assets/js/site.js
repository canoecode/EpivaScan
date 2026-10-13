/* EpivaScan — shared site behaviour: header, footer, image slots, reveals.
   Loaded in <head> on every page (classic script, so it also works from file://). */
(function () {
  'use strict';

  /* Fill these in as the real things come online. Empty values render as "Soon". */
  const CONFIG = window.EPIVASCAN = {
    huggingFaceUrl: '',  // public model card on Hugging Face
    modelSpace: 'CanoeBoat/epivascan',  // Hugging Face Space that runs the model (see ml/space)
    phoneAppUrl: '',     // store / download link for the phone app
    contactEmail: ''
  };

  const NAV = [
    ['index.html', 'Home'],
    ['how-it-works.html', 'How it works'],
    ['model.html', 'The model'],
    ['impact.html', 'Impact'],
    ['about.html', 'About']
  ];
  const here = location.pathname.split('/').pop() || 'index.html';

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
    `<a class="brand" href="index.html" aria-label="EpivaScan home">${svg}<span class="brand__name">Epiva<em>Scan</em></span></a>`;

  class SiteHeader extends HTMLElement {
    connectedCallback() {
      const links = NAV.map(([href, label]) =>
        `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${label}</a>`).join('');

      this.innerHTML = `
        <header class="wrap site-header__inner">
          ${brand(mark('#0A3F3A', '#F6F2EA', '#E8895E', 'rgba(246,242,234,.5)'))}
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
      toggle.addEventListener('click', () => setOpen(!this.classList.contains('is-open')));
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
      });
      document.addEventListener('click', (e) => { if (!this.contains(e.target)) setOpen(false); });
    }
  }

  class SiteFooter extends HTMLElement {
    connectedCallback() {
      const links = NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join('');
      this.innerHTML = `
        <footer class="site-footer">
          <div class="wrap">
            <div class="site-footer__grid">
              <div>
                ${brand(mark('#F6F2EA', '#0A3F3A', '#C25E38', 'rgba(10,63,58,.4)'))}
                <p class="site-footer__blurb">A first look at a skin concern, from a single photo. Currently in development.</p>
              </div>
              <nav aria-label="Footer">
                <h2 class="site-footer__h">Explore</h2>
                <div class="site-footer__links">${links}</div>
              </nav>
              <div>
                <h2 class="site-footer__h">Get started</h2>
                <div class="site-footer__links">
                  <a href="scan.html">Web demo</a>
                  <a href="about.html#faq">FAQ</a>
                  <a href="about.html#contact">Contact</a>
                </div>
              </div>
            </div>
            <p class="site-footer__disclaimer"><strong>EpivaScan is not a medical device and does not give a diagnosis.</strong>
              It is a screening aid in development and is no substitute for an examination by a qualified health professional.
              If a skin problem is painful, bleeding, spreading or changing quickly, seek medical care.</p>
            <div class="site-footer__legal">
              <span>&copy; ${new Date().getFullYear()} EpivaScan</span>
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

  function initReveals() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    items.forEach((el) => {
      /* Anything already in view shows straight away instead of waiting on the observer. */
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
      else io.observe(el);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-slot]').forEach(initSlot);
    document.querySelectorAll('[data-link]').forEach(initLink);
    initReveals();
  });
})();
