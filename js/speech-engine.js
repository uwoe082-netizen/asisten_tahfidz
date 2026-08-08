/* ============================================================
   HAFIZ — speech-engine.js
   Web Speech API wrapper: recognition, matching, scoring
   ============================================================ */

class SpeechEngine {
  constructor(settings = {}) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = !!SR;
    this.settings = Object.assign({ threshold: 0.75, lang: 'ar-SA' }, settings);
    this.listening = false;
    this.onWordResult = null;   // (result) => {}
    this.onStateChange = null;  // (state) => {}
    this.onError = null;        // (err) => {}
    this._restartTimer = null;
    this._shouldContinue = false;

    if (this.supported) {
      this.recognition = new SR();
      this.recognition.lang = this.settings.lang;
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 5;

      this.recognition.onresult = (e) => this._handleResult(e);
      this.recognition.onerror = (e) => this._handleError(e);
      this.recognition.onend = () => this._handleEnd();
    }
  }

  /** target: array of {index, raw, normalized} produced from mushaf words */
  start(targetWords) {
    if (!this.supported) {
      this.onError?.({ type: 'unsupported' });
      return;
    }
    this.targetWords = targetWords;
    this.pointer = 0;
    this._shouldContinue = true;
    try {
      this.recognition.start();
      this.listening = true;
      this.onStateChange?.('listening');
    } catch (e) {
      // already started - ignore
    }
  }

  stop() {
    this._shouldContinue = false;
    this.listening = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
    this.onStateChange?.('idle');
  }

  _handleEnd() {
    this.listening = false;
    if (this._shouldContinue) {
      // auto-restart for continuous setoran sessions
      this._restartTimer = setTimeout(() => {
        if (this._shouldContinue) {
          try { this.recognition.start(); this.listening = true; this.onStateChange?.('listening'); } catch (e) {}
        }
      }, 250);
    } else {
      this.onStateChange?.('idle');
    }
  }

  _handleError(e) {
    this.onStateChange?.('error');
    this.onError?.({ type: e.error, raw: e });
    if (e.error === 'no-speech' || e.error === 'audio-capture') {
      // will auto-restart via onend
    }
  }

  _handleResult(event) {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript + ' ';
    }
    this._matchTranscript(transcript);
  }

  /** Fuzzy match transcript against target words with 3-5 word lookahead */
  _matchTranscript(transcript) {
    if (!this.targetWords || !this.targetWords.length) return;
    const spoken = Utils.splitWords(transcript);
    if (!spoken.length) return;

    spoken.forEach(spokenWord => {
      if (this.pointer >= this.targetWords.length) return;

      const LOOKAHEAD = 5;
      let bestScore = -1, bestOffset = 0;
      for (let off = 0; off < LOOKAHEAD && this.pointer + off < this.targetWords.length; off++) {
        const target = this.targetWords[this.pointer + off];
        const sim = Utils.levenshteinSimilarity(spokenWord, target.raw);
        if (sim > bestScore) { bestScore = sim; bestOffset = off; }
      }

      const cls = Utils.classifyMatch(bestScore, this.settings.threshold);

      if (cls === 'correct' && bestOffset > 0) {
        // skipped words in between
        for (let s = 0; s < bestOffset; s++) {
          this.onWordResult?.({ index: this.targetWords[this.pointer].index, type: 'skipped' });
          this.pointer++;
        }
      }

      if (cls === 'correct') {
        this.onWordResult?.({ index: this.targetWords[this.pointer].index, type: 'correct', similarity: bestScore });
        this.pointer++;
      } else if (cls === 'similar') {
        this.onWordResult?.({ index: this.targetWords[this.pointer].index, type: 'similar', similarity: bestScore });
        // do not advance pointer — user should self-correct
      } else {
        this.onWordResult?.({ index: this.targetWords[this.pointer].index, type: 'wrong', similarity: bestScore });
      }
    });

    if (this.pointer >= this.targetWords.length) {
      this._shouldContinue = false;
      this.onStateChange?.('complete');
    }
  }
}
