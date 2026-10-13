/* EpivaScan — web demo flow (scan.html).
   Photos are analysed by the EpivaScan Space (ml/space/app.py), reached with @gradio/client.
   CONFIG.modelSpace in site.js says which Space. With none set, a copy of the site opened
   on this machine looks for the Space running beside it; anywhere else the page answers
   with built-in sample values, labelled as such, and nothing is uploaded. */
(function () {
  'use strict';

  const CONFIG = window.EPIVASCAN || {};
  const root = document.querySelector('[data-scan]');
  if (!root) return;

  const MAX_BYTES = 15 * 1024 * 1024;
  const SHOWN = 5;  // matches listed before "Show all"

  /* Pinned, so a new release of the client can't change this page unannounced. */
  const CLIENT_URL = 'https://cdn.jsdelivr.net/npm/@gradio/client@2.7.1/dist/index.min.js';
  const LOCAL_PORT = 7860;

  /* What the page answers with when no Space is configured. The same made-up numbers as
     MOCK_SCORES in ml/space/app.py; keep the two in step. */
  const BUILTIN = [
    ['Eczema (dermatitis)', 0.52], ['Contact dermatitis', 0.17], ['Psoriasis', 0.09],
    ['Tinea (ringworm)', 0.06], ['Other / unclear', 0.05], ['Hives (urticaria)', 0.03],
    ['Insect bite', 0.02], ['Folliculitis', 0.02], ['Drug rash', 0.01], ['Pityriasis rosea', 0.01],
    ['Acne', 0.01], ['Impetigo', 0.005], ['Shingles (herpes zoster)', 0.003],
    ['Cold sore (herpes simplex)', 0.002]
  ].map(([label, score]) => ({ label, score }));

  /* Stand-in values used only by "Preview the results layout". */
  const SAMPLE = [
    { label: 'Eczema (dermatitis)', score: 0.64 },
    { label: 'Psoriasis', score: 0.19 },
    { label: 'Tinea (ringworm)', score: 0.11 },
    { label: 'Other / unclear', score: 0.06 }
  ];

  const STATUS = {
    empty: 'Waiting for photo',
    ready: 'Ready to analyse',
    analysing: 'Analysing',
    offline: 'Model offline',
    result: 'Complete',
    error: 'Error'
  };

  /* What the page says about the model, by how it is connected. */
  const MODES = {
    builtin: {
      tone: 'clay',
      title: 'Test mode.',
      text: 'The AI model is still being trained, so this page answers every photo with the same sample values. They are not an analysis of your photo.',
      privacy: 'In this demo your photo stays in your browser. Nothing is uploaded.'
    },
    connecting: {
      tone: 'teal',
      title: 'Connecting.',
      text: 'Reaching the EpivaScan model…',
      privacy: 'Your photo is sent to the EpivaScan model for analysis.'
    },
    mock: {
      tone: 'clay',
      title: 'Test mode.',
      text: 'The AI model is still being trained, so this page answers every photo with the same sample values. They are not an analysis of your photo.',
      privacy: 'Your photo is sent to the EpivaScan test service, which does not analyse it.'
    },
    live: {
      tone: 'teal',
      title: 'Not a diagnosis.',
      text: 'Results show which conditions a photo resembles. Only a clinician who can examine the skin can confirm what is going on.',
      privacy: 'Your photo is sent to the EpivaScan model for analysis.'
    },
    unreachable: {
      tone: 'clay',
      title: 'Model unreachable.',
      text: 'The EpivaScan model didn’t respond, so this page can’t analyse photos right now. You can still walk through the flow.',
      privacy: 'Your photo stays in your browser until the model can be reached.',
      offline: ['The model didn’t respond.', 'Your photo was not analysed and nothing left your device. Check your connection and try again.']
    }
  };

  /* Which of the three readings on how-it-works.html#results a result falls under.
     The cut-offs are placeholders until the trained model's calibration is known. */
  const CLEAR_SCORE = 0.5;  // the top match needs at least this much
  const CLEAR_LEAD = 0.2;   // and to be this far ahead of the runner-up
  const CATCH_ALL = ['Other / unclear', 'Photo unclear'];
  const READINGS = {
    clear: ['One clear leader', 'The photo strongly resembles one condition. Ask a clinician about it specifically; it still needs confirming in person.'],
    close: ['Several close together', 'The model isn’t sure. Try a clearer photo. If the spread stays even, treat the result as inconclusive.'],
    none: ['Nothing fits', 'This may be outside what the model knows. A low match never means nothing is wrong.']
  };

  const picker = root.querySelector('[data-stage]');
  const results = root.querySelector('.results');
  const dropzone = root.querySelector('.dropzone');
  const preview = root.querySelector('.preview');
  const previewImg = preview.querySelector('img');
  const previewName = root.querySelector('.preview__name');
  const analyseBtn = root.querySelector('.scan__actions [data-action="analyse"]');
  const role = (name) => results.querySelector(`[data-role="${name}"]`);
  const statusChip = role('status');
  const bars = role('bars');
  const allToggle = results.querySelector('[data-action="toggle-all"]');
  const notice = document.getElementById('model-notice');

  const stacked = window.matchMedia('(max-width: 900px)');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');

  let file = null;
  let objectUrl = null;
  let busy = false;
  let gradio = null;      // the @gradio/client module, fetched on first use
  let connection = null;

  /* The Space started on this machine with `python ml/space/app.py`, for a copy of the site
     opened here or, over the local network, from a phone. */
  function localSpace() {
    const host = location.hostname;
    const isLocal = host === 'localhost' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    return location.protocol === 'http:' && isLocal ? `http://${host}:${LOCAL_PORT}` : '';
  }
  const SPACE = CONFIG.modelSpace || localSpace();

  function setMode(name) {
    const mode = MODES[name];
    notice.classList.toggle('callout--teal', mode.tone === 'teal');
    notice.querySelector('[data-role="notice-title"]').textContent = mode.title;
    notice.querySelector('[data-role="notice-text"]').textContent = mode.text;
    document.getElementById('privacy-note').textContent = mode.privacy;
    if (mode.offline) {
      role('offline-title').textContent = mode.offline[0];
      role('offline-text').textContent = mode.offline[1];
    }
    role('retry').hidden = name !== 'unreachable';
  }

  function connect() {
    if (!connection) {
      connection = import(CLIENT_URL).then((module) => {
        gradio = module;
        return module.Client.connect(SPACE);
      });
      connection.catch(() => { connection = null; });
    }
    return connection;
  }

  /* Send the photo to the Space. Resolves to its answer,
     { mock, model, predictions: [{ label, score }, …] }, or to null when the Space can't be
     reached, in which case nothing has been uploaded. With no Space configured it answers
     with the built-in sample values and the photo never leaves the browser. */
  async function analyse(image) {
    if (!SPACE) return { mock: true, model: 'built-in', predictions: BUILTIN };
    let client;
    try {
      client = await connect();
    } catch (err) {
      console.error('EpivaScan: could not reach the model.', err);
      setMode('unreachable');
      return null;
    }
    try {
      const result = await client.predict('/predict', { photo: gradio.handle_file(image) });
      return result.data[0];
    } catch (err) {
      console.error('EpivaScan: the model returned an error.', err);
      connection = null;  // a restarted Space needs a fresh connection
      client.close?.();
      throw new Error('The model couldn’t analyse that photo. Please try again.');
    }
  }

  function isAnswer(output) {
    return Boolean(output) && Array.isArray(output.predictions) && output.predictions.length > 0 &&
      output.predictions.every((item) => item && typeof item.label === 'string' && Number.isFinite(item.score));
  }

  function setState(state, label) {
    results.dataset.state = state;
    statusChip.textContent = label || STATUS[state];
  }

  /* On a phone the results sit below the photo, so bring whichever panel changed into view. */
  function reveal(panel) {
    if (stacked.matches) panel.scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: 'start' });
  }

  function fail(message) {
    role('error').textContent = message;
    setState('error');
    reveal(results);
  }

  function setFile(next) {
    if (!next || busy) return;
    if (!next.type.startsWith('image/')) return fail('That file isn’t an image. Choose a photo (JPG, PNG or similar).');
    if (next.size > MAX_BYTES) return fail('That photo is larger than 15 MB. Try a smaller one.');

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    file = next;
    objectUrl = URL.createObjectURL(next);
    previewImg.src = objectUrl;
    previewName.textContent = next.name;
    picker.dataset.stage = 'preview';
    setState('ready');
    analyseBtn.focus();
  }

  function clearFile() {
    if (busy) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    file = null;
    objectUrl = null;
    previewImg.removeAttribute('src');
    root.querySelectorAll('input[type="file"]').forEach((input) => { input.value = ''; });
    picker.dataset.stage = 'pick';
    setState('empty');
    reveal(picker);
  }

  const percent = (score) => (score > 0 && score < 0.005 ? '<1%' : `${Math.round(score * 100)}%`);

  function reading(ranked) {
    const [top, next] = ranked;
    if (CATCH_ALL.includes(top.label)) return READINGS.none;
    const lead = top.score - (next ? next.score : 0);
    return top.score >= CLEAR_SCORE && lead >= CLEAR_LEAD ? READINGS.clear : READINGS.close;
  }

  function showAll(all) {
    [...bars.children].forEach((row, i) => { row.hidden = !all && i >= SHOWN; });
    allToggle.setAttribute('aria-expanded', String(all));
    allToggle.textContent = all ? 'Show fewer' : `Show all ${bars.children.length} conditions`;
  }

  function render(list, isSample) {
    const ranked = [...list].sort((a, b) => b.score - a.score);
    const [top] = ranked;
    const read = reading(ranked);

    role('top-name').textContent = read === READINGS.none ? 'No clear match' : top.label;
    role('top-pct').textContent = percent(top.score);
    role('top-pct').hidden = read === READINGS.none;
    role('read-chip').textContent = read[0];
    role('read-text').textContent = read[1];

    bars.replaceChildren(...ranked.map((item) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="bars__name"></span><span class="bars__val"></span><span class="bars__track"><i></i></span>';
      li.querySelector('.bars__name').textContent = item.label;
      li.querySelector('.bars__val').textContent = percent(item.score);
      li.querySelector('i').style.setProperty('--v', `${(item.score * 100).toFixed(1)}%`);
      return li;
    }));
    allToggle.hidden = ranked.length <= SHOWN;
    showAll(false);

    role('sample-flag').hidden = !isSample;
    setState('result', isSample ? 'Sample data' : STATUS.result);
  }

  async function run() {
    if (!file || busy) return;
    busy = true;
    analyseBtn.disabled = true;
    preview.classList.add('is-analysing');
    setState('analysing');
    try {
      const [output] = await Promise.all([analyse(file), new Promise((done) => setTimeout(done, 1300))]);
      if (!output) {
        setState('offline');
      } else if (!isAnswer(output)) {
        throw new Error('The model sent back a result this page can’t read.');
      } else {
        setMode(!output.mock ? 'live' : output.model === 'built-in' ? 'builtin' : 'mock');
        render(output.predictions, Boolean(output.mock));
      }
      reveal(results);
    } catch (err) {
      fail(err.message || 'Something went wrong. Please try again.');
    } finally {
      busy = false;
      preview.classList.remove('is-analysing');
      analyseBtn.disabled = false;
    }
  }

  root.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener('change', () => setFile(input.files[0]));
  });

  ['dragenter', 'dragover'].forEach((type) => dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.add('is-over');
  }));
  ['dragleave', 'drop'].forEach((type) => dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-over');
  }));
  dropzone.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));

  /* A screenshot on the clipboard can be pasted straight in. */
  document.addEventListener('paste', (e) => {
    const pasted = [...(e.clipboardData ? e.clipboardData.files : [])].find((item) => item.type.startsWith('image/'));
    if (pasted) setFile(pasted);
  });

  root.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'remove') clearFile();
    if (action === 'analyse') run();
    if (action === 'sample') render(SAMPLE, true);
    if (action === 'toggle-all') showAll(allToggle.getAttribute('aria-expanded') !== 'true');
  });

  /* Ask the Space which mode it is in before anyone uploads a photo. This also wakes a
     Space that has gone to sleep. */
  setMode(SPACE ? 'connecting' : 'builtin');
  if (SPACE) {
    connect()
      .then((client) => client.predict('/info'))
      .then((result) => setMode(result.data[0].mock ? 'mock' : 'live'))
      .catch(() => setMode('unreachable'));
  }
})();
