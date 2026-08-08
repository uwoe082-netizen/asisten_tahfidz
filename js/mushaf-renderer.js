/* ============================================================
   HAFIZ — mushaf-renderer.js
   Engine render halaman mushaf pojok (15 baris)
   ============================================================ */

const MushafRenderer = (() => {

  const ARABIC_ORDINALS = ['۰','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  function toArabicNumber(num) {
    return String(num).split('').map(d => ARABIC_ORDINALS[parseInt(d, 10)] ?? d).join('');
  }

  /**
   * Render halaman mushaf ke dalam container.
   * pageRecord: { page, ayahs: [{surah, surahName, surahNameArabic, ayah, text, juz}] }
   * Mengembalikan { wordCount } untuk dipakai modul lain.
   */
  function renderPage(container, pageRecord, opts = {}) {
    const { page, ayahs } = pageRecord;
    container.innerHTML = '';

    if (!ayahs || ayahs.length === 0) {
      container.innerHTML = `
        <div class="mushaf-empty">
          <div style="font-size:2rem;">📖</div>
          <div>Halaman ${page} belum tersedia offline.<br/>Sambungkan internet untuk memuat data.</div>
        </div>`;
      return { wordCount: 0 };
    }

    const firstAyah = ayahs[0];
    const isSurahStart = firstAyah.ayah === 1;
    const showBismillah = isSurahStart && firstAyah.surah !== 9 && firstAyah.surah !== 1;

    let headerHtml = '';
    if (isSurahStart) {
      headerHtml = `
        <div class="mushaf-header">
          <div>${firstAyah.surahNameArabic || firstAyah.surahName} — ${firstAyah.surahName}</div>
          ${showBismillah ? `<span class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>` : ''}
        </div>`;
    }

    const bodyEl = document.createElement('div');
    bodyEl.className = 'mushaf-body';

    let globalWordIndex = 0;
    ayahs.forEach(ayahData => {
      const words = ayahData.text.split(/\s+/).filter(Boolean);
      words.forEach((w, i) => {
        const span = document.createElement('span');
        span.className = 'word';
        span.dataset.wordIndex = globalWordIndex++;
        span.dataset.ayah = ayahData.ayah;
        span.dataset.surah = ayahData.surah;
        span.dataset.raw = w;
        span.textContent = w;
        bodyEl.appendChild(span);
        bodyEl.appendChild(document.createTextNode(' '));
      });
      const marker = document.createElement('span');
      marker.className = 'ayah-marker';
      marker.textContent = `﴿${toArabicNumber(ayahData.ayah)}﴾`;
      bodyEl.appendChild(marker);
      bodyEl.appendChild(document.createTextNode(' '));
    });

    container.innerHTML = `
      <div class="mushaf-progress"><div class="mushaf-progress-fill" id="mushaf-progress-fill"></div></div>
      ${headerHtml}
    `;
    container.appendChild(bodyEl);

    const footer = document.createElement('div');
    footer.className = 'mushaf-footer';
    const juz = firstAyah.juz || '-';
    footer.innerHTML = `<span>Juz ${juz}</span><span>Hal. ${page} dari 604</span>`;
    container.appendChild(footer);

    if (opts.animateSlide) {
      container.classList.remove('slide-left', 'slide-right');
      void container.offsetWidth;
      container.classList.add(opts.animateSlide);
    }

    return { wordCount: globalWordIndex };
  }

  function getWordEls(container) {
    return Array.from(container.querySelectorAll('.word'));
  }

  function setProgress(container, pct) {
    const fill = container.querySelector('#mushaf-progress-fill');
    if (fill) fill.style.width = Utils.clamp(pct, 0, 100) + '%';
  }

  return { renderPage, getWordEls, setProgress, toArabicNumber };
})();
