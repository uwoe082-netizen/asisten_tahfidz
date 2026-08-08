/* ============================================================
   HAFIZ — utils.js
   Helper: normalisasi teks Arab, fuzzy matching, waktu, format
   ============================================================ */

const Utils = (() => {

  /** Hapus harakat/tashkeel & normalisasi huruf Arab agar mudah dibandingkan */
  function normalizeArabic(text) {
    if (!text) return '';
    return text
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08E1\u08E3-\u08FF]/g, '') // harakat
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[ـ]/g, '')
      .replace(/[۩۞﴾﴿]/g, '')
      .replace(/[0-9\u0660-\u0669]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stripDiacriticsOnly(text) {
    return (text || '').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  }

  /** Levenshtein distance */
  function levenshtein(a, b) {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    let prev = new Array(bl + 1);
    let curr = new Array(bl + 1);
    for (let j = 0; j <= bl; j++) prev[j] = j;
    for (let i = 1; i <= al; i++) {
      curr[0] = i;
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      [prev, curr] = [curr, prev];
    }
    return prev[bl];
  }

  /** Similarity ratio 0..1 */
  function levenshteinSimilarity(a, b) {
    a = normalizeArabic(a);
    b = normalizeArabic(b);
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - levenshtein(a, b) / maxLen;
  }

  function classifyMatch(similarity, threshold = 0.75) {
    if (similarity >= threshold) return 'correct';
    if (similarity >= threshold - 0.25) return 'similar';
    return 'wrong';
  }

  function splitWords(text) {
    return normalizeArabic(text).split(' ').filter(Boolean);
  }

  function formatDateID(date = new Date()) {
    const days = ['Minggu','Senin','Selasa','Rabu','Kamis',"Jum'at",'Sabtu'];
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  /** Perkiraan tanggal Hijriah (algoritma tabular, akurasi +-1 hari) */
  function toHijri(date = new Date()) {
    const jd = Math.floor((date.getTime() / 86400000) + 2440587.5);
    let l = jd - 1948440 + 10632;
    const n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    const j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) + (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
    l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) - (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
    const hMonth = Math.floor((24 * l) / 709);
    const hDay = l - Math.floor((709 * hMonth) / 24);
    const hYear = 30 * n + j - 30;
    const months = ['Muharram','Safar',"Rabi'ul Awal","Rabi'ul Akhir",'Jumadil Awal','Jumadil Akhir','Rajab',"Sya'ban",'Ramadhan','Syawal',"Dzulqa'dah","Dzulhijjah"];
    return `${hDay} ${months[hMonth - 1] || ''} ${hYear} H`;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function isOverdue(isoDate) {
    return isoDate && isoDate < todayISO();
  }

  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  return {
    normalizeArabic, stripDiacriticsOnly, levenshtein, levenshteinSimilarity,
    classifyMatch, splitWords, formatDateID, toHijri, addDays, todayISO,
    isOverdue, daysBetween, debounce, uid, vibrate, clamp
  };
})();
