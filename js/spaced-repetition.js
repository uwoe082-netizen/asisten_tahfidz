/* ============================================================
   HAFIZ — spaced-repetition.js
   Algoritma SM-2 + sistem Sabak / Sabqi / Manzil
   ============================================================ */

const SpacedRepetition = (() => {

  /**
   * quality: 0-5 (derived from accuracy%)
   * pageData: { easeFactor, interval, repetition }
   */
  function scoreToQuality(accuracyPct) {
    if (accuracyPct >= 95) return 5;
    if (accuracyPct >= 85) return 4;
    if (accuracyPct >= 70) return 3;
    if (accuracyPct >= 50) return 2;
    if (accuracyPct >= 25) return 1;
    return 0;
  }

  function calculateNextReview(pageData, quality) {
    let { easeFactor = 2.5, interval = 0, repetition = 0 } = pageData;

    if (quality >= 3) {
      if (repetition === 0) interval = 1;
      else if (repetition === 1) interval = 3;
      else if (repetition === 2) interval = 7;
      else interval = Math.round(interval * easeFactor);
      repetition++;
    } else {
      repetition = 0;
      interval = 1;
    }

    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

    return {
      easeFactor: Math.round(easeFactor * 100) / 100,
      interval,
      repetition,
      nextReview: Utils.addDays(new Date(), interval).toISOString().slice(0, 10)
    };
  }

  function defaultRecord(pageNumber, meta = {}) {
    return {
      pageNumber,
      surahName: meta.surahName || '',
      juz: meta.juz || null,
      status: 'new', // new | sabak | sabqi | manzil | mutqin
      easeFactor: 2.5,
      interval: 0,
      repetition: 0,
      nextReview: Utils.todayISO(),
      lastReview: null,
      totalSessions: 0,
      averageScore: 0,
      totalErrors: 0,
      streakCorrect: 0,
      tikrarCount: 0,
      tikrarTarget: 40,
      firstMemorized: null,
      weakWords: []
    };
  }

  /** Terapkan hasil sesi ke record halaman, kembalikan record baru */
  function applySessionResult(record, { accuracy, errorsList = [], sessionType }) {
    const quality = scoreToQuality(accuracy);
    const sr = calculateNextReview(record, quality);

    const totalSessions = record.totalSessions + 1;
    const averageScore = Math.round(((record.averageScore * record.totalSessions) + accuracy) / totalSessions);

    let status = record.status;
    if (sessionType === 'sabak') {
      status = accuracy >= 85 ? 'sabqi' : 'sabak';
    } else if (sessionType === 'sabqi') {
      status = accuracy >= 85 ? 'manzil' : 'sabqi';
    } else if (sessionType === 'manzil') {
      status = quality >= 4 && record.streakCorrect + 1 >= 10 ? 'mutqin' : 'manzil';
    }

    const streakCorrect = accuracy >= 90 ? record.streakCorrect + 1 : 0;

    // merge weak words
    const weakWords = [...record.weakWords];
    errorsList.forEach(w => {
      const existing = weakWords.find(x => x.word === w.word && x.ayah === w.ayah);
      if (existing) existing.errorCount++;
      else weakWords.push({ word: w.word, ayah: w.ayah, errorCount: 1 });
    });
    weakWords.sort((a, b) => b.errorCount - a.errorCount);

    return {
      ...record,
      ...sr,
      status,
      totalSessions,
      averageScore,
      totalErrors: record.totalErrors + errorsList.length,
      streakCorrect,
      firstMemorized: record.firstMemorized || (sessionType === 'sabak' && accuracy >= 85 ? Utils.todayISO() : record.firstMemorized),
      lastReview: Utils.todayISO(),
      weakWords: weakWords.slice(0, 30)
    };
  }

  function incrementTikrar(record) {
    return { ...record, tikrarCount: record.tikrarCount + 1 };
  }

  /** Klasifikasi seluruh koleksi record ke Sabak/Sabqi/Manzil agenda hari ini */
  function buildAgenda(records) {
    const today = Utils.todayISO();
    const sabak = records.filter(r => r.status === 'new' || r.status === 'sabak');
    const sabqi = records.filter(r => r.status === 'sabqi' && r.nextReview <= today);
    const manzil = records.filter(r => (r.status === 'manzil' || r.status === 'mutqin') && r.nextReview <= today);
    const overdueSabqi = sabqi.filter(r => Utils.isOverdue(r.nextReview));
    const overdueManzil = manzil.filter(r => Utils.isOverdue(r.nextReview));
    return { sabak, sabqi, manzil, overdueSabqi, overdueManzil };
  }

  return { scoreToQuality, calculateNextReview, defaultRecord, applySessionResult, incrementTikrar, buildAgenda };
})();
