/* ============================================================
   HAFIZ — error-marker.js
   Deteksi kesalahan, highlight, haptic feedback, audio cue
   ============================================================ */

const ErrorMarker = (() => {
  let audioCtx = null;
  let audioEnabled = true;
  let hapticEnabled = true;

  function configure({ audio, haptic } = {}) {
    if (typeof audio === 'boolean') audioEnabled = audio;
    if (typeof haptic === 'boolean') hapticEnabled = haptic;
  }

  function ensureAudioCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    return audioCtx;
  }

  function tone(freq, duration, type = 'sine', gain = 0.08) {
    if (!audioEnabled) return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(ctx.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  }

  function playCorrect() { tone(880, 0.12, 'sine', 0.06); }
  function playError() { tone(160, 0.18, 'square', 0.05); }

  function hapticError() {
    if (hapticEnabled) Utils.vibrate([50, 30, 50]);
  }
  function hapticSuccess() {
    if (hapticEnabled) Utils.vibrate(20);
  }

  const ERROR_TYPES = {
    'wrong-word':    { arabic: 'اللحن الجلي', label: 'Kata salah' },
    'similar-word':  { arabic: 'اللحن الخفي', label: 'Mirip, kurang tepat' },
    'skipped-word':  { arabic: 'سقط', label: 'Kata dilewati' },
    'repeated-word': { arabic: 'تكرار', label: 'Kata diulang' },
    'long-pause':    { arabic: 'وقف طويل', label: 'Diam terlalu lama' }
  };

  /** Dipanggil oleh session controller saat menerima hasil kata dari SpeechEngine */
  function handleWordResult(result, revealController) {
    switch (result.type) {
      case 'correct':
        playCorrect();
        hapticSuccess();
        revealController.revealNextWord();
        break;
      case 'similar':
        revealController.markError(result.index, 'similar');
        playError();
        break;
      case 'wrong':
        revealController.markError(result.index, 'wrong');
        playError();
        hapticError();
        break;
      case 'skipped':
        revealController.markError(result.index, 'skipped');
        break;
    }
  }

  return { configure, playCorrect, playError, hapticError, hapticSuccess, handleWordResult, ERROR_TYPES };
})();
