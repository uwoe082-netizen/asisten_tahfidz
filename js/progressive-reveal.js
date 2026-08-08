/* ============================================================
   HAFIZ — progressive-reveal.js
   Logika blank-to-visible per kata/ayat
   ============================================================ */

class ProgressiveReveal {
  /**
   * @param {HTMLElement} mushafPage - container .mushaf-page
   * @param {string} mode - 'word-by-word' | 'ayah-by-ayah' | 'line-by-line' | 'full-blank'
   */
  constructor(mushafPage, mode = 'word-by-word') {
    this.container = mushafPage;
    this.words = MushafRenderer.getWordEls(mushafPage);
    this.currentIndex = 0;
    this.mode = mode;
    this.revealedWords = new Set();
    this.errorWords = new Set();
    this.hintWords = new Set();
    this.onComplete = null;
    this.onProgress = null;

    this.container.classList.add('reveal-mode');
    if (mode === 'full-blank') this.container.classList.add('full-blank');
  }

  get total() { return this.words.length; }

  currentWordEl() { return this.words[this.currentIndex] || null; }

  revealNextWord() {
    const el = this.words[this.currentIndex];
    if (!el) return this._maybeComplete();
    el.classList.add('revealing');
    setTimeout(() => { el.classList.add('revealed'); el.classList.remove('revealing'); }, 600);
    this.revealedWords.add(this.currentIndex);
    this.currentIndex++;
    this._updateProgress();
    this._maybeComplete();
  }

  revealNextAyah() {
    if (!this.words[this.currentIndex]) return this._maybeComplete();
    const ayah = this.words[this.currentIndex].dataset.ayah;
    let i = this.currentIndex;
    let delay = 0;
    while (this.words[i] && this.words[i].dataset.ayah === ayah) {
      const el = this.words[i];
      setTimeout(() => {
        el.classList.add('revealing');
        setTimeout(() => { el.classList.add('revealed'); el.classList.remove('revealing'); }, 600);
      }, delay);
      this.revealedWords.add(i);
      delay += 50;
      i++;
    }
    this.currentIndex = i;
    this._updateProgress();
    this._maybeComplete();
  }

  revealAll() {
    while (this.currentIndex < this.total) this.revealNextWord();
  }

  markError(wordIndex, type = 'wrong') {
    const el = this.words[wordIndex];
    if (!el) return;
    el.classList.remove('error-wrong', 'error-similar', 'error-skipped');
    el.classList.add(type === 'similar' ? 'error-similar' : type === 'skipped' ? 'error-skipped' : 'error-wrong');
    this.errorWords.add(wordIndex);
  }

  markHint(wordIndex) {
    const el = this.words[wordIndex];
    if (el) el.classList.add('hint-used');
    this.hintWords.add(wordIndex);
  }

  setActive(wordIndex) {
    this.words.forEach(w => w.classList.remove('active-word'));
    const el = this.words[wordIndex];
    if (el) {
      el.classList.add('active-word');
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  _updateProgress() {
    MushafRenderer.setProgress(this.container, this.getProgress().percentage);
    if (this.onProgress) this.onProgress(this.getProgress());
  }

  _maybeComplete() {
    if (this.currentIndex >= this.total && this.onComplete) this.onComplete(this.getSummary());
  }

  getProgress() {
    return {
      revealed: this.revealedWords.size,
      total: this.total,
      errors: this.errorWords.size,
      hints: this.hintWords.size,
      percentage: this.total ? (this.revealedWords.size / this.total) * 100 : 0
    };
  }

  getSummary() {
    const p = this.getProgress();
    const correct = p.total - p.errors;
    const accuracy = p.total ? Math.round((correct / p.total) * 100) : 0;
    return { ...p, accuracy };
  }
}
