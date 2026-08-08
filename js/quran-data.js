/* ============================================================
   HAFIZ — quran-data.js
   Fetch & cache data Al-Qur'an dari Al Quran Cloud API
   ============================================================ */

const QuranData = (() => {
  const API_BASE = 'https://api.alquran.cloud/v1';
  const TOTAL_PAGES = 604;

  // Minimal offline fallback so the app still demos something meaningful
  // even with zero connectivity on first run (Al-Fatihah + Al-Ikhlas + Al-Falaq + An-Nas).
  const FALLBACK_AYAHS = [
    { surah: 1, surahName: 'Al-Fatihah', ayah: 1, page: 1, juz: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
    { surah: 1, surahName: 'Al-Fatihah', ayah: 2, page: 1, juz: 1, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' },
    { surah: 1, surahName: 'Al-Fatihah', ayah: 3, page: 1, juz: 1, text: 'الرَّحْمَٰنِ الرَّحِيمِ' },
    { surah: 1, surahName: 'Al-Fatihah', ayah: 4, page: 1, juz: 1, text: 'مَالِكِ يَوْمِ الدِّينِ' },
    { surah: 1, surahName: 'Al-Fatihah', ayah: 5, page: 1, juz: 1, text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ' },
    { surah: 1, surahName: 'Al-Fatihah', ayah: 6, page: 1, juz: 1, text: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ' },
    { surah: 1, surahName: 'Al-Fatihah', ayah: 7, page: 1, juz: 1, text: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ' },
    { surah: 112, surahName: 'Al-Ikhlas', ayah: 1, page: 604, juz: 30, text: 'قُلْ هُوَ اللَّهُ أَحَدٌ' },
    { surah: 112, surahName: 'Al-Ikhlas', ayah: 2, page: 604, juz: 30, text: 'اللَّهُ الصَّمَدُ' },
    { surah: 112, surahName: 'Al-Ikhlas', ayah: 3, page: 604, juz: 30, text: 'لَمْ يَلِدْ وَلَمْ يُولَدْ' },
    { surah: 112, surahName: 'Al-Ikhlas', ayah: 4, page: 604, juz: 30, text: 'وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ' },
    { surah: 113, surahName: 'Al-Falaq', ayah: 1, page: 604, juz: 30, text: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ' },
    { surah: 113, surahName: 'Al-Falaq', ayah: 2, page: 604, juz: 30, text: 'مِنْ شَرِّ مَا خَلَقَ' },
    { surah: 113, surahName: 'Al-Falaq', ayah: 3, page: 604, juz: 30, text: 'وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ' },
    { surah: 113, surahName: 'Al-Falaq', ayah: 4, page: 604, juz: 30, text: 'وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ' },
    { surah: 113, surahName: 'Al-Falaq', ayah: 5, page: 604, juz: 30, text: 'وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ' },
    { surah: 114, surahName: 'An-Nas', ayah: 1, page: 604, juz: 30, text: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ' },
    { surah: 114, surahName: 'An-Nas', ayah: 2, page: 604, juz: 30, text: 'مَلِكِ النَّاسِ' },
    { surah: 114, surahName: 'An-Nas', ayah: 3, page: 604, juz: 30, text: 'إِلَٰهِ النَّاسِ' },
    { surah: 114, surahName: 'An-Nas', ayah: 4, page: 604, juz: 30, text: 'مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ' },
    { surah: 114, surahName: 'An-Nas', ayah: 5, page: 604, juz: 30, text: 'الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ' },
    { surah: 114, surahName: 'An-Nas', ayah: 6, page: 604, juz: 30, text: 'مِنَ الْجِنَّةِ وَالنَّاسِ' }
  ];

  let surahListCache = null;
  let onlineFlag = navigator.onLine;
  window.addEventListener('online', () => onlineFlag = true);
  window.addEventListener('offline', () => onlineFlag = false);

  async function fetchJSON(url, timeoutMs = 8000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  /** Ambil daftar surah (nama, jumlah ayat, dsb) — cached in meta store */
  async function getSurahList() {
    if (surahListCache) return surahListCache;
    const cached = await Storage.get('meta', 'surahList');
    if (cached) { surahListCache = cached.value; return surahListCache; }
    try {
      const data = await fetchJSON(`${API_BASE}/surah`);
      const list = data.data;
      await Storage.put('meta', { key: 'surahList', value: list });
      surahListCache = list;
      return list;
    } catch (e) {
      return SURAH_META_FALLBACK;
    }
  }

  function mapAyahsFromApi(json, pageNumber) {
    const ayahs = json.data.ayahs || (json.data.surahs ? json.data.surahs.flatMap(s => s.ayahs.map(a => ({ ...a, surahMeta: s }))) : []);
    return ayahs.map(a => ({
      surah: a.surah ? a.surah.number : (a.surahMeta ? a.surahMeta.number : null),
      surahName: a.surah ? a.surah.englishName : (a.surahMeta ? a.surahMeta.englishName : ''),
      surahNameArabic: a.surah ? a.surah.name : (a.surahMeta ? a.surahMeta.name : ''),
      ayah: a.numberInSurah,
      globalAyah: a.number,
      page: a.page || pageNumber,
      juz: a.juz,
      text: a.text
    }));
  }

  /** Ambil 1 halaman mushaf (cache-first, network fallback) */
  async function getPage(pageNumber) {
    pageNumber = Utils.clamp(parseInt(pageNumber, 10) || 1, 1, TOTAL_PAGES);
    const cached = await Storage.get('pages', pageNumber).catch(() => null);
    if (cached) return cached;

    if (!navigator.onLine) {
      return buildFallbackPage(pageNumber);
    }

    try {
      const json = await fetchJSON(`${API_BASE}/page/${pageNumber}/quran-uthmani`);
      const ayahs = mapAyahsFromApi(json, pageNumber);
      const record = { page: pageNumber, ayahs, fetchedAt: Date.now() };
      await Storage.put('pages', record);
      return record;
    } catch (e) {
      console.warn('Quran API unavailable, using fallback for page', pageNumber, e);
      return buildFallbackPage(pageNumber);
    }
  }

  function buildFallbackPage(pageNumber) {
    const ayahs = FALLBACK_AYAHS.filter(a => a.page === pageNumber);
    return { page: pageNumber, ayahs, fetchedAt: Date.now(), isFallback: true };
  }

  async function getSurah(surahNumber) {
    try {
      const json = await fetchJSON(`${API_BASE}/surah/${surahNumber}/quran-uthmani`);
      return mapAyahsFromApi(json);
    } catch (e) {
      return FALLBACK_AYAHS.filter(a => a.surah === surahNumber);
    }
  }

  /** Cari halaman awal untuk surah tertentu */
  async function firstPageOfSurah(surahNumber) {
    const list = await getSurahList();
    const s = list.find(x => x.number === surahNumber);
    if (s) return s.startPage || firstPageFallback(surahNumber);
    return firstPageFallback(surahNumber);
  }

  function firstPageFallback(surahNumber) {
    const hit = FALLBACK_AYAHS.find(a => a.surah === surahNumber);
    return hit ? hit.page : 1;
  }

  const SURAH_META_FALLBACK = [
    { number: 1, name: 'الفاتحة', englishName: 'Al-Fatihah', numberOfAyahs: 7, startPage: 1 },
    { number: 112, name: 'الإخلاص', englishName: 'Al-Ikhlas', numberOfAyahs: 4, startPage: 604 },
    { number: 113, name: 'الفلق', englishName: 'Al-Falaq', numberOfAyahs: 5, startPage: 604 },
    { number: 114, name: 'الناس', englishName: 'An-Nas', numberOfAyahs: 6, startPage: 604 }
  ];

  return { TOTAL_PAGES, getPage, getSurah, getSurahList, firstPageOfSurah };
})();
