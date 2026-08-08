/* ============================================================
   HAFIZ — gamification.js
   Streak, XP, level, achievement, badge lokal
   ============================================================ */

const Gamification = (() => {

  const LEVELS = [
    { level: 1,  name: "Mubtadi' (Pemula)",  xp: 0 },
    { level: 2,  name: 'Thalib (Pelajar)',   xp: 100 },
    { level: 3,  name: "Qari' (Pembaca)",    xp: 300 },
    { level: 4,  name: 'Hafiz Muda',         xp: 600 },
    { level: 5,  name: 'Hafiz Pratama',      xp: 1000 },
    { level: 6,  name: 'Hafiz Madya',        xp: 2000 },
    { level: 7,  name: 'Hafiz Utama',        xp: 4000 },
    { level: 8,  name: 'Hafiz Kamil',        xp: 7000 },
    { level: 9,  name: 'Mutqin',             xp: 10000 },
    { level: 10, name: 'Sahibul Qur\'an',    xp: 15000 }
  ];

  const XP_TABLE = { sabak: 15, sabqi: 8, manzil: 5, tikrar: 10, accuracyBonus: 5 };

  const BADGES = [
    { id: 'al-fatihah',     emoji: '📖', name: "Al-Fatihah",     desc: 'Selesai hafal surah Al-Fatihah' },
    { id: 'qiyamul-lail',   emoji: '🌅', name: 'Qiyamul Lail',   desc: 'Setoran pada jam 3–5 pagi' },
    { id: 'mukarrir',       emoji: '🔁', name: 'Mukarrir',       desc: 'Tikrar satu halaman 40x' },
    { id: 'mujawwad',       emoji: '🎯', name: 'Mujawwad',       desc: '3 halaman berturut skor 100%' },
    { id: 'istiqomah-30',   emoji: '🗓️', name: 'Istiqomah 30',   desc: 'Streak 30 hari' },
    { id: 'khatam-juz',     emoji: '🏆', name: 'Khatam Juz',     desc: 'Selesai hafal 1 juz penuh' },
    { id: 'mutqin-page',    emoji: '💎', name: 'Mutqin Page',    desc: '1 halaman skor >95% 10x berturut' },
    { id: 'dzikir-quran',   emoji: '📿', name: "Dzikir Al-Qur'an", desc: '1000 halaman dimurojaah (akumulatif)' },
    { id: 'ramadhan-spirit',emoji: '🌙', name: 'Ramadhan Spirit', desc: 'Setoran 30 hari berturut' },
    { id: 'nur-ala-nur',    emoji: '🌟', name: "Nur 'ala Nur",   desc: 'Hafal 30 juz lengkap' }
  ];

  const MOTIVATIONAL_QUOTES = [
    { ar: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ', src: 'HR. Bukhari' },
    { ar: 'يُقَالُ لِصَاحِبِ الْقُرْآنِ اقْرَأْ وَارْتَقِ وَرَتِّلْ كَمَا كُنْتَ تُرَتِّلُ فِي الدُّنْيَا', src: 'HR. Abu Daud & Tirmidzi' },
    { ar: 'إِنَّ اللَّهَ يَرْفَعُ بِهَٰذَا الْكِتَابِ أَقْوَامًا وَيَضَعُ بِهِ آخَرِينَ', src: 'HR. Muslim' },
    { ar: 'مَثَلُ الَّذِي يَقْرَأُ الْقُرْآنَ وَهُوَ حَافِظٌ لَهُ مَعَ السَّفَرَةِ الْكِرَامِ الْبَرَرَةِ', src: 'Muttafaq alaih' }
  ];

  function levelFromXP(xp) {
    let current = LEVELS[0];
    for (const l of LEVELS) if (xp >= l.xp) current = l;
    const idx = LEVELS.indexOf(current);
    const next = LEVELS[idx + 1] || null;
    return { ...current, next, progressToNext: next ? Utils.clamp((xp - current.xp) / (next.xp - current.xp) * 100, 0, 100) : 100 };
  }

  function xpForSession(type, accuracy) {
    let xp = XP_TABLE[type] || 0;
    if (accuracy >= 95) xp += XP_TABLE.accuracyBonus;
    return xp;
  }

  function xpForStreak(streakDays) {
    return 2 * streakDays;
  }

  function todaysQuote() {
    const day = Math.floor(Date.now() / 86400000);
    return MOTIVATIONAL_QUOTES[day % MOTIVATIONAL_QUOTES.length];
  }

  /** Update streak given last-active date; returns { streak, freezeAvailable, streakBroken } */
  function updateStreak(profile) {
    const today = Utils.todayISO();
    if (profile.lastActiveDate === today) return profile;

    const yesterday = Utils.addDays(new Date(), -1).toISOString().slice(0, 10);
    let streak = profile.streak || 0;
    let freezeAvailable = profile.freezeAvailable || 0;
    let streakBroken = false;

    if (profile.lastActiveDate === yesterday) {
      streak += 1;
    } else if (profile.lastActiveDate && profile.lastActiveDate < yesterday) {
      if (freezeAvailable > 0) {
        freezeAvailable -= 1; // consume a freeze, streak preserved
      } else {
        streak = 1;
        streakBroken = true;
      }
    } else {
      streak = 1;
    }

    if (streak > 0 && streak % 7 === 0) freezeAvailable += 1;

    return { ...profile, streak, freezeAvailable, lastActiveDate: today, streakBroken };
  }

  function streakFireColor(streak) {
    if (streak >= 30) return 'blue';
    if (streak >= 7) return 'gold';
    return 'orange';
  }

  function checkBadges(profile, stats) {
    const unlocked = new Set(profile.badges || []);
    const newly = [];
    const consider = (id, condition) => {
      if (!unlocked.has(id) && condition) { unlocked.add(id); newly.push(id); }
    };
    consider('al-fatihah', stats.fatihahMemorized);
    consider('qiyamul-lail', stats.qiyamulLailSession);
    consider('mukarrir', stats.maxTikrar >= 40);
    consider('mujawwad', stats.perfectStreak3);
    consider('istiqomah-30', profile.streak >= 30);
    consider('khatam-juz', stats.juzCompleted >= 1);
    consider('mutqin-page', stats.mutqinPageStreak >= 10);
    consider('dzikir-quran', stats.totalMurojaahPages >= 1000);
    consider('ramadhan-spirit', profile.streak >= 30 && stats.dailySetoranStreak >= 30);
    consider('nur-ala-nur', stats.juzCompleted >= 30);
    return { badges: Array.from(unlocked), newly };
  }

  return { LEVELS, XP_TABLE, BADGES, MOTIVATIONAL_QUOTES, levelFromXP, xpForSession, xpForStreak, todaysQuote, updateStreak, streakFireColor, checkBadges };
})();
