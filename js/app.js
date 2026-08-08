/* ============================================================
   HAFIZ — app.js
   Router SPA, state management, lifecycle
   ============================================================ */

const App = (() => {
  const content = document.getElementById('app-content');
  const pageTitle = document.getElementById('page-title');
  const backBtn = document.getElementById('btn-back');
  const darkBtn = document.getElementById('btn-dark-mode');
  const fabMic = document.getElementById('fab-mic');

  let state = {
    profile: null,
    settings: null,
    records: [],       // hafalan records
    currentPage: 1,
    activeSession: null // { type, controller, speech, pageNumber }
  };

  // ---------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------
  async function init() {
    applyStoredTheme();
    state.profile = Storage.lsGet('profile', null);
    state.settings = Storage.lsGet('settings', defaultSettings());
    ErrorMarker.configure({ audio: state.settings.audioFeedback, haptic: state.settings.hapticFeedback });

    window.addEventListener('hashchange', handleRoute);
    darkBtn.addEventListener('click', toggleTheme);
    backBtn.addEventListener('click', () => history.back());

    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => setActiveNav(el.dataset.page));
    });

    if (!state.profile) {
      renderOnboarding();
    } else {
      state.profile = Gamification.updateStreak(state.profile);
      Storage.lsSet('profile', state.profile);
      handleRoute();
    }

    registerServiceWorker();
  }

  function defaultSettings() {
    return {
      targetSabak: 1, targetSabqi: 2, targetManzil: 3,
      tikrarTarget: 20, revealMode: 'word-by-word',
      sensitivity: 75, audioFeedback: true, hapticFeedback: true,
      darkMode: 'auto'
    };
  }

  function applyStoredTheme() {
    const settings = Storage.lsGet('settings', defaultSettings());
    const mode = settings.darkMode || 'auto';
    let dark = mode === 'dark';
    if (mode === 'auto') dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    state.settings.darkMode = next;
    Storage.lsSet('settings', state.settings);
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // ---------------------------------------------------------
  // Router
  // ---------------------------------------------------------
  const routes = [
    { pattern: /^#\/$/, handler: renderDashboard, title: 'Hafiz', nav: 'home' },
    { pattern: /^#\/mushaf$/, handler: renderMushafBrowse, title: 'Mushaf', nav: 'mushaf' },
    { pattern: /^#\/mushaf\/(\d+)$/, handler: (m) => renderMushafPage(parseInt(m[1], 10)), title: 'Mushaf', nav: 'mushaf' },
    { pattern: /^#\/setoran$/, handler: renderSetoranHub, title: 'Setoran', nav: 'setoran' },
    { pattern: /^#\/setoran\/(\d+)$/, handler: (m) => renderSetoranSession(parseInt(m[1], 10), 'sabak'), title: 'Setoran', nav: 'setoran' },
    { pattern: /^#\/tikrar\/(\d+)$/, handler: (m) => renderTikrar(parseInt(m[1], 10)), title: 'Tikrar', nav: 'setoran' },
    { pattern: /^#\/murojaah$/, handler: () => renderSetoranSession(null, 'manzil'), title: 'Murojaah', nav: 'setoran' },
    { pattern: /^#\/stats$/, handler: renderStats, title: 'Statistik', nav: 'stats' },
    { pattern: /^#\/profile$/, handler: renderProfile, title: 'Profil', nav: 'profile' },
    { pattern: /^#\/settings$/, handler: renderSettings, title: 'Pengaturan', nav: 'profile' }
  ];

  function handleRoute() {
    teardownActiveSession();
    const hash = location.hash || '#/';
    for (const r of routes) {
      const m = hash.match(r.pattern);
      if (m) {
        pageTitle.textContent = r.title;
        backBtn.style.visibility = hash === '#/' ? 'hidden' : 'visible';
        setActiveNav(r.nav);
        content.classList.remove('reanim');
        void content.offsetWidth;
        r.handler(m);
        window.scrollTo(0, 0);
        return;
      }
    }
    navigate('#/');
  }

  function navigate(hash) {
    if (location.hash === hash) handleRoute();
    else location.hash = hash;
  }

  function setActiveNav(page) {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  }

  function teardownActiveSession() {
    if (state.activeSession?.speech) {
      state.activeSession.speech.stop();
    }
    state.activeSession = null;
    fabMic.classList.add('hidden');
  }

  // ---------------------------------------------------------
  // Onboarding
  // ---------------------------------------------------------
  function renderOnboarding() {
    let slide = 0;
    const data = { target: 5, name: '' };

    function draw() {
      content.innerHTML = '';
      pageTitle.textContent = 'Selamat Datang';
      backBtn.style.visibility = 'hidden';
      document.getElementById('app-nav').style.display = 'none';

      const wrap = document.createElement('div');
      wrap.className = 'onboarding-slide';

      if (slide === 0) {
        wrap.innerHTML = `
          <div style="font-size:2.4rem;">🕌</div>
          <h2 style="font-family:var(--font-arabic);font-size:1.6rem;margin-top:.5rem;">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</h2>
          <h1 style="margin-top:1rem;">Selamat datang di Hafiz</h1>
          <p style="color:var(--color-text-secondary);">Teman setia perjalanan menghafal Al-Qur'an — mushaf pojok, setoran suara, dan jadwal murojaah cerdas, semua tersimpan di perangkatmu.</p>
          <button class="btn btn-primary btn-block" id="ob-next">Mulai</button>
        `;
      } else if (slide === 1) {
        wrap.innerHTML = `
          <div style="font-size:2.2rem;">🎯</div>
          <h1>Pilih target hafalan Anda</h1>
          <p style="color:var(--color-text-secondary);">Berapa juz yang ingin Anda targetkan?</p>
          <input type="number" min="1" max="30" value="${data.target}" id="ob-target" class="text-input" style="width:100px;text-align:center;font-size:1.2rem;margin:1rem auto;display:block;" />
          <button class="btn btn-primary btn-block" id="ob-next">Lanjut</button>
        `;
      } else {
        wrap.innerHTML = `
          <div style="font-size:2.2rem;">👤</div>
          <h1>Siapa nama Anda?</h1>
          <p style="color:var(--color-text-secondary);">Agar Hafiz bisa menyapa Anda dengan hangat.</p>
          <input type="text" placeholder="Nama Anda" id="ob-name" class="text-input" style="width:100%;text-align:center;font-size:1rem;margin:1rem 0;display:block;" />
          <button class="btn btn-primary btn-block" id="ob-finish">Mulai Menghafal</button>
        `;
      }

      const dots = document.createElement('div');
      dots.className = 'onboarding-dots';
      for (let i = 0; i < 3; i++) {
        const d = document.createElement('span');
        d.className = 'dot' + (i === slide ? ' active' : '');
        dots.appendChild(d);
      }
      wrap.appendChild(dots);
      content.appendChild(wrap);

      document.getElementById('ob-next')?.addEventListener('click', () => {
        if (slide === 1) data.target = parseInt(document.getElementById('ob-target').value, 10) || 5;
        slide++; draw();
      });
      document.getElementById('ob-finish')?.addEventListener('click', () => {
        data.name = document.getElementById('ob-name').value.trim() || 'Sahabat Qur\'an';
        finishOnboarding(data);
      });
    }
    draw();
  }

  function finishOnboarding(data) {
    state.profile = {
      name: data.name, targetJuz: data.target,
      xp: 0, streak: 0, freezeAvailable: 0, lastActiveDate: null,
      badges: [], createdAt: Utils.todayISO()
    };
    Storage.lsSet('profile', state.profile);
    state.settings = defaultSettings();
    Storage.lsSet('settings', state.settings);
    document.getElementById('app-nav').style.display = '';
    state.profile = Gamification.updateStreak(state.profile);
    Storage.lsSet('profile', state.profile);
    navigate('#/');
  }

  // ---------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------
  async function renderDashboard() {
    document.getElementById('app-nav').style.display = '';
    content.innerHTML = `<div class="empty-state">Memuat dashboard…</div>`;
    const records = await Storage.getAll('hafalan');
    state.records = records;
    const agenda = SpacedRepetition.buildAgenda(records);
    const level = Gamification.levelFromXP(state.profile.xp);
    const quote = Gamification.todaysQuote();
    const totalPages = records.filter(r => r.status !== 'new').length;
    const totalJuz = (totalPages / 20).toFixed(1);

    content.innerHTML = `
      <div class="hero-card">
        <div class="bismillah-line">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
        <div class="greeting">Assalamu'alaikum, ${escapeHtml(state.profile.name)}! 🌙</div>
        <div class="date-line">${Utils.formatDateID()} · ${Utils.toHijri()}</div>
        <div class="stat-row">
          <div class="stat-pill"><div class="stat-value">🔥 ${state.profile.streak}</div><div class="stat-label">Hari Streak</div></div>
          <div class="stat-pill"><div class="stat-value">${level.level}</div><div class="stat-label">${level.name}</div></div>
          <div class="stat-pill"><div class="stat-value">${totalJuz}</div><div class="stat-label">Juz Hafal</div></div>
        </div>
      </div>

      <div class="card" style="margin-top:1rem;text-align:center;">
        <div style="font-family:var(--font-arabic);font-size:1.15rem;line-height:2;">${quote.ar}</div>
        <div style="font-size:.7rem;color:var(--color-text-secondary);margin-top:.3rem;">${quote.src}</div>
      </div>

      <div class="section-title">📗 Sabak — Hafalan Baru</div>
      <div id="agenda-sabak"></div>

      <div class="section-title">📘 Sabqi — Ulang Hafalan Baru</div>
      <div id="agenda-sabqi"></div>

      <div class="section-title">📙 Manzil — Murojaah</div>
      <div id="agenda-manzil"></div>
    `;

    const sabakBox = document.getElementById('agenda-sabak');
    if (agenda.sabak.length === 0) {
      const nextPage = await findNextNewPage(records);
      sabakBox.innerHTML = agendaItem(`Halaman ${nextPage}`, 'Belum dihafal', () => navigate(`#/setoran/${nextPage}`), 'Mulai Hafal');
    } else {
      const r = agenda.sabak[0];
      sabakBox.innerHTML = agendaItem(`Halaman ${r.pageNumber}`, r.surahName || 'Belum dihafal', () => navigate(`#/setoran/${r.pageNumber}`), 'Mulai Hafal');
    }

    const sabqiBox = document.getElementById('agenda-sabqi');
    sabqiBox.innerHTML = agenda.sabqi.length
      ? agenda.sabqi.slice(0, 4).map(r => agendaItem(`Halaman ${r.pageNumber}`, r.surahName, () => navigate(`#/setoran/${r.pageNumber}`), 'Setoran', Utils.isOverdue(r.nextReview))).join('')
      : emptyMini('Tidak ada jadwal Sabqi hari ini');

    const manzilBox = document.getElementById('agenda-manzil');
    manzilBox.innerHTML = agenda.manzil.length
      ? agenda.manzil.slice(0, 4).map(r => agendaItem(`Halaman ${r.pageNumber}`, r.surahName, () => navigate(`#/setoran/${r.pageNumber}`), 'Murojaah', Utils.isOverdue(r.nextReview))).join('')
      : emptyMini('Tidak ada jadwal Murojaah hari ini');

    // bind delegated clicks (agendaItem returns markup with data-action index)
    bindAgendaClicks(sabakBox, agenda.sabak.length ? [agenda.sabak[0]] : [{ pageNumber: await findNextNewPage(records) }]);
    bindAgendaClicks(sabqiBox, agenda.sabqi.slice(0, 4));
    bindAgendaClicks(manzilBox, agenda.manzil.slice(0, 4));
  }

  function agendaItem(title, sub, onClickFn, btnLabel, overdue) {
    return `<div class="agenda-item card-tap">
      <div class="agenda-info">
        <span class="agenda-title">${title} ${overdue ? '<span class="badge-overdue">Terlambat</span>' : ''}</span>
        <span class="agenda-sub">${sub || ''}</span>
      </div>
      <button class="btn btn-primary btn-sm agenda-btn">${btnLabel}</button>
    </div>`;
  }
  function bindAgendaClicks(container, records) {
    const btns = container.querySelectorAll('.agenda-btn');
    btns.forEach((btn, i) => {
      const r = records[i];
      if (!r) return;
      btn.addEventListener('click', () => navigate(`#/setoran/${r.pageNumber}`));
    });
  }
  function emptyMini(text) {
    return `<div class="empty-state" style="padding:1.25rem;"><div class="empty-icon">✅</div>${text}</div>`;
  }

  async function findNextNewPage(records) {
    const known = new Set(records.map(r => r.pageNumber));
    for (let p = 1; p <= QuranData.TOTAL_PAGES; p++) if (!known.has(p)) return p;
    return 1;
  }

  // ---------------------------------------------------------
  // Mushaf Browse (jump to page/surah/juz)
  // ---------------------------------------------------------
  async function renderMushafBrowse() {
    content.innerHTML = `
      <div class="card">
        <h2>Buka Mushaf</h2>
        <p style="font-size:.8rem;color:var(--color-text-secondary);">Lompat langsung ke halaman, surah, atau juz.</p>
        <div style="display:flex;gap:.5rem;margin-bottom:.75rem;">
          <input type="number" min="1" max="604" placeholder="No. Halaman (1-604)" id="jump-page-input" class="text-input" style="flex:1;">
          <button class="btn btn-primary" id="jump-page-btn">Buka</button>
        </div>
        <div id="surah-list" style="max-height:50vh;overflow-y:auto;"></div>
      </div>
    `;
    document.getElementById('jump-page-btn').addEventListener('click', () => {
      const v = Utils.clamp(parseInt(document.getElementById('jump-page-input').value, 10) || 1, 1, 604);
      navigate(`#/mushaf/${v}`);
    });

    const list = await QuranData.getSurahList();
    const listEl = document.getElementById('surah-list');
    listEl.innerHTML = list.map(s => `
      <div class="agenda-item card-tap" data-surah="${s.number}">
        <div class="agenda-info">
          <span class="agenda-title">${s.number}. ${s.englishName}</span>
          <span class="agenda-sub">${s.name || ''} · ${s.numberOfAyahs} ayat</span>
        </div>
        <span style="color:var(--color-text-secondary);font-size:.8rem;">›</span>
      </div>`).join('');
    listEl.querySelectorAll('[data-surah]').forEach(el => {
      el.addEventListener('click', async () => {
        const page = await QuranData.firstPageOfSurah(parseInt(el.dataset.surah, 10));
        navigate(`#/mushaf/${page}`);
      });
    });
  }

  // ---------------------------------------------------------
  // Mushaf Page (read mode, with navigation)
  // ---------------------------------------------------------
  async function renderMushafPage(pageNumber) {
    pageNumber = Utils.clamp(pageNumber || 1, 1, QuranData.TOTAL_PAGES);
    state.currentPage = pageNumber;
    content.innerHTML = `
      <div class="mushaf-wrap">
        <div class="mushaf-toolbar">
          <button class="arrow-btn" id="prev-page" aria-label="Halaman sebelumnya">›</button>
          <button class="jump-btn" id="page-indicator">Hal. <strong>${pageNumber}</strong></button>
          <button class="arrow-btn" id="next-page" aria-label="Halaman berikutnya">‹</button>
        </div>
        <div class="mushaf-page" id="mushaf-page-el"><div class="mushaf-empty">Memuat…</div></div>
        <div style="display:flex;gap:.5rem;margin-top:.9rem;">
          <button class="btn btn-outline btn-block" id="go-tikrar">🔁 Tikrar</button>
          <button class="btn btn-primary btn-block" id="go-setoran">🎙️ Tes Hafalan</button>
        </div>
      </div>
    `;
    await loadAndRenderPage(pageNumber);

    document.getElementById('prev-page').addEventListener('click', () => shiftPage(1));
    document.getElementById('next-page').addEventListener('click', () => shiftPage(-1));
    document.getElementById('go-tikrar').addEventListener('click', () => navigate(`#/tikrar/${state.currentPage}`));
    document.getElementById('go-setoran').addEventListener('click', () => navigate(`#/setoran/${state.currentPage}`));

    attachSwipe(document.getElementById('mushaf-page-el'), (dir) => shiftPage(dir));
  }

  async function loadAndRenderPage(pageNumber, animClass) {
    const el = document.getElementById('mushaf-page-el');
    if (!el) return;
    const record = await QuranData.getPage(pageNumber);
    await document.fonts.ready.catch(() => {});
    MushafRenderer.renderPage(el, record, { animateSlide: animClass });
    document.getElementById('page-indicator').innerHTML = `Hal. <strong>${pageNumber}</strong>`;
  }

  function shiftPage(delta) {
    // RTL mushaf: swipe left(-1 visually) goes to next page (delta convention handled by caller)
    const next = Utils.clamp(state.currentPage + delta, 1, QuranData.TOTAL_PAGES);
    if (next === state.currentPage) return;
    state.currentPage = next;
    history.replaceState(null, '', `#/mushaf/${next}`);
    loadAndRenderPage(next, delta > 0 ? 'slide-right' : 'slide-left');
  }

  function attachSwipe(el, cb) {
    let startX = null;
    el.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) cb(dx > 0 ? -1 : 1); // swipe right -> previous (RTL feel)
      startX = null;
    }, { passive: true });
  }

  // ---------------------------------------------------------
  // Setoran Hub
  // ---------------------------------------------------------
  async function renderSetoranHub() {
    const records = await Storage.getAll('hafalan');
    const agenda = SpacedRepetition.buildAgenda(records);
    const nextNew = await findNextNewPage(records);
    content.innerHTML = `
      <div class="card" style="text-align:center;">
        <div style="font-size:2rem;">🎙️</div>
        <h2>Setoran Suara</h2>
        <p style="font-size:.8rem;color:var(--color-text-secondary);">Baca dengan suara, sistem mendengarkan dan mengoreksi bacaanmu secara real-time.</p>
      </div>
      <div class="section-title">Mulai Sesi</div>
      ${agendaItem(`Sabak — Hal. ${agenda.sabak[0]?.pageNumber || nextNew}`, 'Hafalan baru', null, 'Mulai')}
      ${agenda.sabqi[0] ? agendaItem(`Sabqi — Hal. ${agenda.sabqi[0].pageNumber}`, 'Ulang hafalan baru', null, 'Mulai') : ''}
      ${agenda.manzil[0] ? agendaItem(`Manzil — Hal. ${agenda.manzil[0].pageNumber}`, 'Murojaah', null, 'Mulai') : ''}
    `;
    const targets = [agenda.sabak[0]?.pageNumber || nextNew, agenda.sabqi[0]?.pageNumber, agenda.manzil[0]?.pageNumber].filter(Boolean);
    content.querySelectorAll('.agenda-btn').forEach((btn, i) => {
      btn.addEventListener('click', () => navigate(`#/setoran/${targets[i]}`));
    });
  }

  // ---------------------------------------------------------
  // Setoran / Murojaah Session (voice)
  // ---------------------------------------------------------
  async function renderSetoranSession(pageNumber, sessionType) {
    if (!pageNumber) {
      const records = await Storage.getAll('hafalan');
      const agenda = SpacedRepetition.buildAgenda(records);
      pageNumber = agenda.manzil[0]?.pageNumber || 1;
    }
    document.getElementById('app-nav').style.display = 'none';
    fabMic.classList.remove('hidden');
    fabMic.innerHTML = '🎙️<div class="pulse-ring" style="display:none;"></div>';

    content.innerHTML = `
      <div class="mushaf-wrap">
        <div class="mushaf-page" id="mushaf-page-el"><div class="mushaf-empty">Memuat…</div></div>
      </div>
      <p id="setoran-status" style="text-align:center;font-size:.8rem;color:var(--color-text-secondary);margin-top:.75rem;">Tekan tombol mikrofon untuk mulai setoran.</p>
      <button class="btn btn-outline btn-block" id="cancel-setoran" style="margin-top:.5rem;">Batal</button>
    `;
    document.getElementById('cancel-setoran').addEventListener('click', () => history.back());

    const pageRecord = await QuranData.getPage(pageNumber);
    const el = document.getElementById('mushaf-page-el');
    await document.fonts.ready.catch(() => {});
    MushafRenderer.renderPage(el, pageRecord);

    const revealMode = state.settings.revealMode || 'word-by-word';
    const reveal = new ProgressiveReveal(el, sessionType === 'manzil' ? 'ayah-by-ayah' : revealMode);
    const speech = new SpeechEngine({ threshold: (state.settings.sensitivity || 75) / 100 });

    state.activeSession = { type: sessionType, pageNumber, speech, reveal, errorsList: [] };

    const statusEl = document.getElementById('setoran-status');

    if (!speech.supported) {
      statusEl.innerHTML = `⚠️ Browser ini tidak mendukung pengenalan suara. Gunakan Chrome/Edge, atau <button class="btn btn-sm btn-ghost" id="manual-mode-btn">tandai manual</button>.`;
      document.getElementById('manual-mode-btn')?.addEventListener('click', () => enableManualMode(reveal, el, statusEl, pageNumber, sessionType));
      fabMic.classList.add('hidden');
      return;
    }

    speech.onStateChange = (s) => {
      if (s === 'listening') {
        fabMic.classList.add('listening');
        fabMic.querySelector('.pulse-ring').style.display = 'block';
        statusEl.textContent = 'Mendengarkan… mulai membaca.';
      } else if (s === 'idle') {
        fabMic.classList.remove('listening');
        fabMic.querySelector('.pulse-ring').style.display = 'none';
      } else if (s === 'error') {
        fabMic.classList.add('error-state');
      } else if (s === 'complete') {
        finishSetoran(pageNumber, sessionType, reveal, state.activeSession.errorsList);
      }
    };
    speech.onError = (err) => {
      switch (err.type) {
        case 'not-allowed':
        case 'service-not-allowed':
          statusEl.innerHTML = '🎙️ Akses mikrofon ditolak. Izinkan mikrofon di pengaturan browser untuk melanjutkan.';
          fabMic.classList.add('hidden');
          break;
        case 'network':
          statusEl.innerHTML = '📶 Pengenalan suara butuh koneksi internet aktif. Periksa sinyal/WiFi lalu tekan mikrofon lagi.';
          break;
        case 'audio-capture':
          statusEl.innerHTML = '🎤 Mikrofon tidak terdeteksi. Pastikan tidak ada aplikasi lain yang sedang memakai mikrofon.';
          fabMic.classList.add('hidden');
          break;
        case 'no-speech':
          // Normal saat jeda bicara — akan otomatis lanjut mendengarkan, tidak perlu pesan menakutkan.
          statusEl.textContent = 'Belum terdengar suara… lanjutkan membaca.';
          break;
        case 'aborted':
          // Biasanya akibat aksi pengguna sendiri (mis. stop manual) — tidak perlu ditampilkan sebagai error.
          break;
        default:
          statusEl.textContent = 'Terjadi gangguan mikrofon, mencoba lagi…';
      }
    };
    speech.onWordResult = (result) => {
      const words = MushafRenderer.getWordEls(el);
      const wordEl = words[result.index];
      if (result.type === 'wrong' || result.type === 'similar' || result.type === 'skipped') {
        state.activeSession.errorsList.push({ word: wordEl?.dataset.raw || '', ayah: wordEl?.dataset.ayah });
      }
      ErrorMarker.handleWordResult(result, reveal);
      reveal.setActive(Math.min(result.index + 1, reveal.total - 1));
      statusEl.textContent = `Kata ${reveal.getProgress().revealed}/${reveal.total} · Akurasi berjalan ${reveal.getSummary().accuracy}%`;
    };

    const targetWords = MushafRenderer.getWordEls(el).map((w, i) => ({ index: i, raw: w.dataset.raw }));

    fabMic.onclick = () => {
      if (speech.listening) {
        speech.stop();
      } else {
        speech.start(targetWords);
      }
    };
  }

  function enableManualMode(reveal, el, statusEl, pageNumber, sessionType) {
    const words = MushafRenderer.getWordEls(el);
    statusEl.textContent = 'Mode manual: ketuk tiap kata yang sudah kamu baca.';
    const errorsList = [];
    words.forEach((w, i) => {
      w.addEventListener('click', () => {
        if (i === reveal.currentIndex) {
          reveal.revealNextWord();
          if (reveal.currentIndex >= reveal.total) finishSetoran(pageNumber, sessionType, reveal, errorsList);
        }
      });
    });
  }

  async function finishSetoran(pageNumber, sessionType, reveal, errorsList) {
    if (state.activeSession?.speech) state.activeSession.speech.stop();
    fabMic.classList.add('hidden');
    const summary = reveal.getSummary();

    let record = await Storage.get('hafalan', pageNumber);
    const pageData = await QuranData.getPage(pageNumber);
    const meta = pageData.ayahs[0] || {};
    if (!record) record = SpacedRepetition.defaultRecord(pageNumber, { surahName: meta.surahName, juz: meta.juz });

    record = SpacedRepetition.applySessionResult(record, { accuracy: summary.accuracy, errorsList, sessionType });
    await Storage.put('hafalan', record);

    const xp = Gamification.xpForSession(sessionType, summary.accuracy);
    state.profile.xp += xp;
    Storage.lsSet('profile', state.profile);

    showSummaryModal({ summary, xp, record, pageNumber, sessionType });
  }

  function showSummaryModal({ summary, xp, record, pageNumber, sessionType }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div style="font-size:2rem;">${summary.accuracy >= 85 ? '🎉' : '📝'}</div>
        <h2>${summary.accuracy >= 85 ? 'Alhamdulillah, Mantap!' : 'Terus Semangat!'}</h2>
        <p style="font-size:.8rem;color:var(--color-text-secondary);">Halaman ${pageNumber} · ${sessionType.toUpperCase()}</p>
        <div class="score-ring-wrap">${scoreRingSVG(summary.accuracy)}</div>
        <div class="summary-grid">
          <div class="summary-cell"><div class="summary-num ok">${summary.total - summary.errors}</div><div class="summary-label">Benar</div></div>
          <div class="summary-cell"><div class="summary-num err">${summary.errors}</div><div class="summary-label">Salah</div></div>
          <div class="summary-cell"><div class="summary-num hint">+${xp}</div><div class="summary-label">XP</div></div>
        </div>
        <p style="font-size:.75rem;">${summary.accuracy >= 85 ? `Status halaman ini sekarang: <strong>${record.status}</strong>. Review berikutnya: ${record.nextReview}.` : 'Skor di bawah 85% — disarankan tikrar lagi sebelum lanjut.'}</p>
        <div style="display:flex;gap:.5rem;margin-top:1rem;">
          <button class="btn btn-outline btn-block" id="modal-repeat">Ulangi</button>
          <button class="btn btn-primary btn-block" id="modal-done">Selesai</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('modal-repeat').addEventListener('click', () => {
      overlay.remove();
      renderSetoranSession(pageNumber, sessionType);
    });
    document.getElementById('modal-done').addEventListener('click', () => {
      overlay.remove();
      navigate('#/');
    });
  }

  function scoreRingSVG(pct) {
    const r = 44, c = 2 * Math.PI * r;
    const offset = c - (c * pct / 100);
    const color = pct >= 85 ? 'var(--color-success)' : pct >= 60 ? 'var(--color-warning)' : 'var(--color-error)';
    return `<svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--color-border-light)" stroke-width="10"/>
      <circle cx="55" cy="55" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${offset}" transform="rotate(-90 55 55)"/>
      <text x="55" y="62" text-anchor="middle" font-size="22" font-weight="800" fill="var(--color-text-primary)">${pct}%</text>
    </svg>`;
  }

  // ---------------------------------------------------------
  // Tikrar mode (repetition counter, read mode)
  // ---------------------------------------------------------
  async function renderTikrar(pageNumber) {
    document.getElementById('app-nav').style.display = '';
    let record = await Storage.get('hafalan', pageNumber);
    if (!record) {
      const pageData = await QuranData.getPage(pageNumber);
      const meta = pageData.ayahs[0] || {};
      record = SpacedRepetition.defaultRecord(pageNumber, { surahName: meta.surahName, juz: meta.juz });
      await Storage.put('hafalan', record);
    }
    content.innerHTML = `
      <div class="mushaf-wrap">
        <div class="tikrar-ring-wrap" id="tikrar-ring"></div>
        <div class="mushaf-page" id="mushaf-page-el"><div class="mushaf-empty">Memuat…</div></div>
        <button class="btn btn-primary btn-block" id="tikrar-btn" style="margin-top:1rem;">Sudah 1x Baca ✓</button>
        <button class="btn btn-outline btn-block" id="tikrar-test-btn" style="margin-top:.5rem;">Tes Hafalan Sekarang</button>
      </div>
    `;
    const pageData = await QuranData.getPage(pageNumber);
    await document.fonts.ready.catch(() => {});
    MushafRenderer.renderPage(document.getElementById('mushaf-page-el'), pageData);
    drawTikrarRing(record.tikrarCount, record.tikrarTarget);

    document.getElementById('tikrar-btn').addEventListener('click', async () => {
      record = SpacedRepetition.incrementTikrar(record);
      await Storage.put('hafalan', record);
      drawTikrarRing(record.tikrarCount, record.tikrarTarget);
      if ([10, 20, 30, 40].includes(record.tikrarCount)) showToast(`🎉 Tikrar ke-${record.tikrarCount}! Terus semangat.`);
      if (record.tikrarCount === record.tikrarTarget) {
        state.profile.xp += Gamification.XP_TABLE.tikrar;
        Storage.lsSet('profile', state.profile);
        showToast('Target tikrar tercapai! Yuk tes hafalan.');
      }
    });
    document.getElementById('tikrar-test-btn').addEventListener('click', () => navigate(`#/setoran/${pageNumber}`));
  }

  function drawTikrarRing(count, target) {
    const pct = Utils.clamp((count / target) * 100, 0, 100);
    const r = 40, c = 2 * Math.PI * r;
    const offset = c - (c * pct / 100);
    document.getElementById('tikrar-ring').innerHTML = `
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--color-border-light)" stroke-width="8"/>
        <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--color-accent-400)" stroke-width="8" stroke-linecap="round"
          stroke-dasharray="${c}" stroke-dashoffset="${offset}" transform="rotate(-90 50 50)" class="progress-fill-anim"/>
        <text x="50" y="46" text-anchor="middle" font-size="16" font-weight="800" fill="var(--color-text-primary)">${count}/${target}</text>
        <text x="50" y="62" text-anchor="middle" font-size="9" fill="var(--color-text-secondary)">tikrar</text>
      </svg>`;
  }

  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  // ---------------------------------------------------------
  // Stats
  // ---------------------------------------------------------
  async function renderStats() {
    const records = await Storage.getAll('hafalan');
    const memorized = records.filter(r => r.status !== 'new');
    const weakWords = records.flatMap(r => r.weakWords || []).sort((a, b) => b.errorCount - a.errorCount).slice(0, 8);

    const juzSet = {};
    memorized.forEach(r => { if (r.juz) juzSet[r.juz] = (juzSet[r.juz] || 0) + 1; });

    content.innerHTML = `
      <div class="card">
        <div class="section-title" style="margin-top:0;">Peta 30 Juz</div>
        <div class="juz-map">${Array.from({ length: 30 }, (_, i) => {
          const juz = i + 1; const cnt = juzSet[juz] || 0;
          const cls = cnt >= 18 ? 'progress-full' : cnt > 0 ? 'progress-partial' : '';
          return `<div class="juz-cell ${cls}">${juz}</div>`;
        }).join('')}</div>
      </div>

      <div class="section-title">Aktivitas Terakhir</div>
      <div class="card">
        <div class="heatmap-grid">${buildHeatmap(records)}</div>
      </div>

      <div class="section-title">Progress Halaman per Minggu</div>
      <div class="card">
        <div class="bar-chart">${buildBarChart(records)}</div>
      </div>

      <div class="section-title">Kata yang Sering Salah</div>
      <div class="card">
        ${weakWords.length ? weakWords.map(w => `
          <div class="weak-word-row">
            <span class="ww-arabic">${w.word}</span>
            <span class="ww-count">${w.errorCount}x salah</span>
          </div>`).join('') : `<div class="empty-state"><div class="empty-icon">✨</div>Belum ada catatan kesalahan.</div>`}
      </div>
    `;
  }

  function buildHeatmap(records) {
    const days = [];
    for (let i = 51; i >= 0; i--) days.push(Utils.addDays(new Date(), -i).toISOString().slice(0, 10));
    const byDate = {};
    records.forEach(r => { if (r.lastReview) byDate[r.lastReview] = (byDate[r.lastReview] || 0) + 1; });
    return days.map(d => {
      const cnt = byDate[d] || 0;
      const lvl = cnt === 0 ? '' : cnt === 1 ? 'lvl-1' : cnt === 2 ? 'lvl-2' : cnt <= 4 ? 'lvl-3' : 'lvl-4';
      return `<div class="heatmap-cell ${lvl}" title="${d}: ${cnt} halaman"></div>`;
    }).join('');
  }

  function buildBarChart(records) {
    const weeks = Array.from({ length: 8 }, () => 0);
    records.forEach(r => {
      if (!r.lastReview) return;
      const days = Utils.daysBetween(r.lastReview, Utils.todayISO());
      const w = Math.floor(days / 7);
      if (w >= 0 && w < 8) weeks[7 - w]++;
    });
    const max = Math.max(1, ...weeks);
    return weeks.map((v, i) => `
      <div class="bar-col">
        <div class="bar-fill" style="height:${(v / max) * 90}px;"></div>
        <div class="bar-label">M${i + 1}</div>
      </div>`).join('');
  }

  // ---------------------------------------------------------
  // Profile
  // ---------------------------------------------------------
  async function renderProfile() {
    const records = await Storage.getAll('hafalan');
    const level = Gamification.levelFromXP(state.profile.xp);
    const memorized = records.filter(r => r.status !== 'new').length;
    const avgScore = records.length ? Math.round(records.reduce((s, r) => s + (r.averageScore || 0), 0) / records.length) : 0;
    const totalSessions = records.reduce((s, r) => s + (r.totalSessions || 0), 0);

    content.innerHTML = `
      <div class="card" style="text-align:center;">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--color-primary-500);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin:0 auto .5rem;">${(state.profile.name || '?')[0].toUpperCase()}</div>
        <h2>${escapeHtml(state.profile.name)}</h2>
        <div class="badge-chip">${level.name}</div>
        <div style="margin-top:.75rem;">
          <div style="height:8px;background:var(--color-border-light);border-radius:100px;overflow:hidden;">
            <div style="height:100%;width:${level.progressToNext}%;background:linear-gradient(90deg,var(--color-primary-400),var(--color-accent-400));" class="progress-fill-anim"></div>
          </div>
          <div style="font-size:.7rem;color:var(--color-text-secondary);margin-top:.25rem;">${state.profile.xp} XP ${level.next ? `· ${level.next.xp - state.profile.xp} XP menuju ${level.next.name}` : '· Level Maksimum'}</div>
        </div>
        <div class="stat-row" style="margin-top:1rem;">
          <div class="stat-pill" style="background:var(--color-bg-primary);border:1px solid var(--color-border-light);"><div class="stat-value" style="color:var(--color-primary-600);">${memorized}</div><div class="stat-label" style="color:var(--color-text-secondary);">Halaman</div></div>
          <div class="stat-pill" style="background:var(--color-bg-primary);border:1px solid var(--color-border-light);"><div class="stat-value" style="color:var(--color-primary-600);">${totalSessions}</div><div class="stat-label" style="color:var(--color-text-secondary);">Sesi</div></div>
          <div class="stat-pill" style="background:var(--color-bg-primary);border:1px solid var(--color-border-light);"><div class="stat-value" style="color:var(--color-primary-600);">${avgScore}%</div><div class="stat-label" style="color:var(--color-text-secondary);">Rata Skor</div></div>
        </div>
      </div>

      <div class="section-title">Koleksi Badge</div>
      <div class="card">
        <div class="badge-grid">
          ${Gamification.BADGES.map(b => `
            <div class="badge-cell ${state.profile.badges.includes(b.id) ? '' : 'locked'}">
              <div class="badge-emoji">${b.emoji}</div>
              <div class="badge-name">${b.name}</div>
            </div>`).join('')}
        </div>
      </div>

      <button class="btn btn-outline btn-block" id="go-settings" style="margin-top:1rem;">⚙️ Pengaturan</button>
    `;
    document.getElementById('go-settings').addEventListener('click', () => navigate('#/settings'));
  }

  // ---------------------------------------------------------
  // Settings
  // ---------------------------------------------------------
  function renderSettings() {
    const s = state.settings;
    content.innerHTML = `
      <div class="card">
        <div class="settings-row">
          <div><div class="settings-label">Target Sabak / hari</div></div>
          <input type="number" min="0" max="5" step="0.5" value="${s.targetSabak}" id="set-sabak" class="text-input" style="width:60px;">
        </div>
        <div class="settings-row">
          <div><div class="settings-label">Target Sabqi / hari</div></div>
          <input type="number" min="0" max="10" value="${s.targetSabqi}" id="set-sabqi" class="text-input" style="width:60px;">
        </div>
        <div class="settings-row">
          <div><div class="settings-label">Target Manzil / hari</div></div>
          <input type="number" min="0" max="10" value="${s.targetManzil}" id="set-manzil" class="text-input" style="width:60px;">
        </div>
        <div class="settings-row">
          <div><div class="settings-label">Target Tikrar</div></div>
          <input type="number" min="5" max="100" value="${s.tikrarTarget}" id="set-tikrar" class="text-input" style="width:60px;">
        </div>
        <div class="settings-row">
          <div><div class="settings-label">Mode Reveal Default</div></div>
          <select id="set-reveal" class="select-input">
            <option value="word-by-word" ${s.revealMode === 'word-by-word' ? 'selected' : ''}>Per Kata</option>
            <option value="ayah-by-ayah" ${s.revealMode === 'ayah-by-ayah' ? 'selected' : ''}>Per Ayat</option>
            <option value="line-by-line" ${s.revealMode === 'line-by-line' ? 'selected' : ''}>Per Baris</option>
            <option value="full-blank" ${s.revealMode === 'full-blank' ? 'selected' : ''}>Kosong Total</option>
          </select>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">Sensitivitas Suara</div><div class="settings-sub">Threshold kemiripan bacaan</div></div>
          <input type="number" min="40" max="95" value="${s.sensitivity}" id="set-sensitivity" class="text-input" style="width:60px;">
        </div>
        <div class="settings-row">
          <div><div class="settings-label">Audio Feedback</div></div>
          <button class="toggle-switch ${s.audioFeedback ? 'on' : ''}" id="tgl-audio"></button>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">Haptic Feedback</div></div>
          <button class="toggle-switch ${s.hapticFeedback ? 'on' : ''}" id="tgl-haptic"></button>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">Mode Tampilan</div></div>
          <select id="set-theme" class="select-input">
            <option value="auto" ${s.darkMode === 'auto' ? 'selected' : ''}>Auto</option>
            <option value="light" ${s.darkMode === 'light' ? 'selected' : ''}>Terang</option>
            <option value="dark" ${s.darkMode === 'dark' ? 'selected' : ''}>Gelap</option>
          </select>
        </div>
      </div>

      <div class="section-title">Data</div>
      <div class="card" style="display:flex;flex-direction:column;gap:.5rem;">
        <button class="btn btn-ghost btn-block" id="export-data">⬇️ Export Data (JSON)</button>
        <label class="btn btn-ghost btn-block" style="text-align:center;">⬆️ Import Data
          <input type="file" id="import-data" accept="application/json" style="display:none;">
        </label>
        <button class="btn btn-danger btn-block" id="reset-data">🗑️ Reset Semua Data</button>
      </div>
    `;

    const save = () => Storage.lsSet('settings', state.settings);
    document.getElementById('set-sabak').addEventListener('change', e => { s.targetSabak = parseFloat(e.target.value); save(); });
    document.getElementById('set-sabqi').addEventListener('change', e => { s.targetSabqi = parseInt(e.target.value, 10); save(); });
    document.getElementById('set-manzil').addEventListener('change', e => { s.targetManzil = parseInt(e.target.value, 10); save(); });
    document.getElementById('set-tikrar').addEventListener('change', e => { s.tikrarTarget = parseInt(e.target.value, 10); save(); });
    document.getElementById('set-reveal').addEventListener('change', e => { s.revealMode = e.target.value; save(); });
    document.getElementById('set-sensitivity').addEventListener('change', e => { s.sensitivity = parseInt(e.target.value, 10); save(); });
    document.getElementById('set-theme').addEventListener('change', e => {
      s.darkMode = e.target.value; save(); applyStoredTheme();
    });
    document.getElementById('tgl-audio').addEventListener('click', (e) => {
      s.audioFeedback = !s.audioFeedback; e.target.classList.toggle('on', s.audioFeedback);
      ErrorMarker.configure({ audio: s.audioFeedback }); save();
    });
    document.getElementById('tgl-haptic').addEventListener('click', (e) => {
      s.hapticFeedback = !s.hapticFeedback; e.target.classList.toggle('on', s.hapticFeedback);
      ErrorMarker.configure({ haptic: s.hapticFeedback }); save();
    });

    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('import-data').addEventListener('change', importData);
    document.getElementById('reset-data').addEventListener('click', resetData);
  }

  async function exportData() {
    const records = await Storage.getAll('hafalan');
    const payload = { profile: state.profile, settings: state.settings, records, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hafiz-backup-${Utils.todayISO()}.json`;
    a.click();
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.profile) { state.profile = data.profile; Storage.lsSet('profile', state.profile); }
        if (data.settings) { state.settings = data.settings; Storage.lsSet('settings', state.settings); }
        if (Array.isArray(data.records)) for (const r of data.records) await Storage.put('hafalan', r);
        showToast('Data berhasil diimpor.');
        navigate('#/');
      } catch (err) { showToast('File tidak valid.'); }
    };
    reader.readAsText(file);
  }

  function resetData() {
    if (!confirm('Yakin ingin menghapus SEMUA data hafalan, statistik, dan pengaturan?')) return;
    if (!confirm('Tindakan ini tidak dapat dibatalkan. Lanjutkan?')) return;
    Storage.clearAll().then(() => {
      Storage.lsRemoveAll();
      location.hash = '#/';
      location.reload();
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { init, navigate };
})();

document.addEventListener('DOMContentLoaded', App.init);
