/* ============================================================
   CLICKER ONLINE — game.js  (полная версия)
   ✔ Исправлен таймер арены (локальный тик + серверное время)
   ✔ Исправлено двойное списание/потеря ставок (система inbox)
   ✔ Исправлены утечки слушателей и «фантомные» комнаты
   ✔ Чат внутри комнаты арены
   ✔ Кланы (до 5 игроков, +10% сокланам)
   ============================================================ */

// ============================================================
// FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyDunk-eA8oiY4SwbCql0D-h9EyVYL-wwiA",
    authDomain: "clicker-94702.firebaseapp.com",
    databaseURL: "https://clicker-94702-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "clicker-94702",
    storageBucket: "clicker-94702.firebasestorage.app",
    messagingSenderId: "1085651157718",
    appId: "1:1085651157718:web:55f45d11b1883b0ae33f77"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================================
// СОСТОЯНИЕ ИГРЫ
// ============================================================
const STATE = {
    userId: localStorage.getItem('cv_uid') || null,
    nickname: localStorage.getItem('cv_nick') || '',
    clicks: parseInt(localStorage.getItem('cv_clicks')) || 0,
    totalClicks: parseInt(localStorage.getItem('cv_total')) || 0,
    level: parseInt(localStorage.getItem('cv_level')) || 1,
    streak: parseInt(localStorage.getItem('cv_streak')) || 0,
    lastLoginDate: localStorage.getItem('cv_lastlogin') || '',

    energy: 100,
    maxEnergy: 100,
    energyCost: 1,
    energyRegen: 4,          // 2 ед/сек
    clicksPerLevel: 1000,
    multiplier: 1,

    penaltyActive: false,
    penaltyTimer: 0,
    warmupDone: false,

    cpsHistory: [],
    currentCps: 0,

    comboCount: 0,
    lastClickTime: 0,
    maxCombo: parseInt(localStorage.getItem('cv_maxcombo')) || 0,

    btnScale: 1,
    particles: [],

    achievements: JSON.parse(localStorage.getItem('cv_achievements') || '[]'),
    upgrades: JSON.parse(localStorage.getItem('cv_upgrades') || '{}'),

    audioCtx: null,

    currentTab: 'clicker',
    unseenMessages: 0,
    chatInitialized: false,

    // КЛАН
    clanId: localStorage.getItem('cv_clan') || null,
    clan: null,
    clanInvites: {},
    seenInvites: new Set(),
    clanPending: 0,          // накопленные 10% для раздачи
    clanEarnWindow: 0,       // заработано с последней раздачи
    clanBonus: parseInt(localStorage.getItem('cv_clanbonus')) || 0,
    clanToastBuf: 0,

    // АРЕНА
    currentRoomId: null,
    roomData: null,
    roomChat: [],
    isHolding: false,
    roomSig: '',
    roomShellBuilt: false,

    onlineUsers: {},
    usersCache: [],
    serverOffset: 0,
    gameStarted: false
};

function nowTs() { return Date.now() + STATE.serverOffset; }

db.ref('.info/serverTimeOffset').on('value', s => { STATE.serverOffset = s.val() || 0; });

// ============================================================
// УЛУЧШЕНИЯ (новые цены: /10 + 10 000)
// ============================================================
const UPGRADES = [
    { id: 'click_multiplier_1',  name: 'Мощность клика',    icon: '💪', desc: '+1 очко за каждый клик',                    baseCost: 11500, maxLevel: 10 },
    { id: 'auto_clicker_1',      name: 'Авто-шахтёр',       icon: '🤖', desc: 'Пассивно +1 клик/сек (без траты энергии)',  baseCost: 14000, maxLevel: 10 },
    { id: 'crit_chance_1',       name: 'Критический удар',  icon: '⚡', desc: '3% шанс ударить на x5 очков',               baseCost: 16000, maxLevel: 5  },
    { id: 'combo_boost_1',       name: 'Мастер комбо',      icon: '🔥', desc: '+15% времени на удержание комбо',           baseCost: 12500, maxLevel: 5  },
    { id: 'lucky_click_1',       name: 'Удачливость',       icon: '🍀', desc: '5% шанс получить x2 за клик',               baseCost: 15000, maxLevel: 5  },
    { id: 'penalty_reduction_1', name: 'Охлаждение',        icon: '❄️', desc: '-2 сек. времени перегрева',                 baseCost: 13000, maxLevel: 5  },
    { id: 'chat_color_1',        name: 'Цветной никнейм',   icon: '🎨', desc: 'Уникальный цвет в чате',                    baseCost: 20000, maxLevel: 1  },
    { id: 'chat_badge_1',        name: 'VIP бейдж',         icon: '⭐', desc: 'Звёздочка рядом с ником',                   baseCost: 35000, maxLevel: 1  }
];

if (!STATE.upgrades || typeof STATE.upgrades !== 'object') STATE.upgrades = {};
UPGRADES.forEach(u => { if (STATE.upgrades[u.id] === undefined) STATE.upgrades[u.id] = 0; });

const CLAN_COST = 5000;
const CLAN_MAX = 5;
const CLAN_SHARE = 0.10;

// ============================================================
// ФИЛЬТР МАТОВ  (баг: /g + .test() сохранял lastIndex → чинено)
// ============================================================
const BAD_SOURCES = [
    '[хx][уy][йиеёяюijею]', '[пp][иieё][зз3][дd][аеёоуыэюяaeiouy]', '[бb6][лl][яьъ]',
    '[еёe][бb6][аaоoуyлlиiтtнnсsкk]', '[сsc][уyu][кkч][аaiи]', '[дd][еeёo][рrб][ьъ]?[мm][оo]',
    '[мm][уyu][дd][аaоoиiлlкk]', '[гg][оo][вv][нnh][оo]', '[жzj][оo][пp][аaуyыe]',
    '[пp][иieё][дd][оoаaеeёо][рr]', '[шш][лl][юуy][хx]', '[тt][вv][аa][рr][ьъ]',
    '[дd][аa][уyu][нnh]', '[дd][еe][бb6][иi][лl]',
    'fuck', 'shit', 'bitch', 'ass\\s*hole', 'dick', 'cunt', 'nigger', 'whore', 'bastard'
];
const BAD_TEST = BAD_SOURCES.map(s => new RegExp(s, 'i'));
const BAD_REPLACE = BAD_SOURCES.map(s => new RegExp(s, 'gi'));

const BAD_WORDS_EXACT = [
    'хуй','хуя','хуе','хуи','хую','пизда','пизде','пизду','пиздец','блять','бля','блядь','блядина',
    'ебать','ебал','ебло','ебан','сука','суки','сучка','сучара','мудак','мудила','мразь','мрази',
    'гандон','гнида','падла','ублюдок','уебок','уебан','залупа','даун','дебил','дебилы','лох','лохи',
    'шлюха','шалава','говно','говна','жопа','жопу','пидор','пидар','пидорас','нахуй','нахуя','похуй',
    'похуя','охуеть','заебал','заебись','ёбаный','ебаный','ёбаная','пиздато','хуйня','пиздёж'
];

function containsBadWords(text) {
    const lower = String(text || '').toLowerCase().trim();
    if (!lower) return false;
    const stripped = lower.replace(/[\s\-_.*!@#$%^&()0-9]/g, '');
    for (const w of lower.split(/\s+/)) {
        const clean = w.replace(/[^а-яёa-z]/gi, '');
        if (clean && BAD_WORDS_EXACT.includes(clean)) return true;
    }
    for (const re of BAD_TEST) { if (re.test(lower) || re.test(stripped)) return true; }
    return false;
}

function censorText(text) {
    let r = String(text || '');
    for (const re of BAD_REPLACE) r = r.replace(re, m => '🤬'.repeat(Math.max(1, Math.ceil(m.length / 3))));
    for (const w of BAD_WORDS_EXACT) r = r.replace(new RegExp(w, 'gi'), '🤬');
    return r;
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = String(text == null ? '' : text);
    return d.innerHTML;
}

function fmt(n) { return Math.floor(n || 0).toLocaleString('ru-RU'); }

// ============================================================
// ДОСТИЖЕНИЯ
// ============================================================
const ACHIEVEMENTS_DEF = [
    { id: 'click100',   name: 'Новичок',          icon: '🐣', desc: '100 кликов',                check: () => STATE.totalClicks >= 100 },
    { id: 'click500',   name: 'Начинающий',       icon: '👆', desc: '500 кликов',                check: () => STATE.totalClicks >= 500 },
    { id: 'click1000',  name: 'Кликер',           icon: '✊', desc: '1 000 кликов',              check: () => STATE.totalClicks >= 1000 },
    { id: 'click5000',  name: 'Профи',            icon: '💪', desc: '5 000 кликов',              check: () => STATE.totalClicks >= 5000 },
    { id: 'click10000', name: 'Мастер',           icon: '🏅', desc: '10 000 кликов',             check: () => STATE.totalClicks >= 10000 },
    { id: 'level5',     name: 'Ур. 5',            icon: '⭐', desc: 'Достигните 5 уровня',       check: () => STATE.level >= 5 },
    { id: 'level10',    name: 'Ур. 10',           icon: '🌟', desc: 'Достигните 10 уровня',      check: () => STATE.level >= 10 },
    { id: 'combo20',    name: 'Комбо 20',         icon: '🔥', desc: 'Наберите комбо 20',         check: () => STATE.maxCombo >= 20 },
    { id: 'cps8',       name: 'Скорострел',       icon: '⚡', desc: '8+ кликов/сек',             check: () => STATE.currentCps >= 8 },
    { id: 'shopper1',   name: 'Первая покупка',   icon: '🛒', desc: 'Купите улучшение',          check: () => Object.values(STATE.upgrades).some(v => v > 0) },
    { id: 'clanman',    name: 'Не один',          icon: '🛡️', desc: 'Вступите в клан',           check: () => !!STATE.clanId },
    { id: 'arenawin',   name: 'Гладиатор',        icon: '👑', desc: 'Победа на арене',           check: () => localStorage.getItem('cv_arenawin') === '1' }
];

function checkAchievements() {
    for (const a of ACHIEVEMENTS_DEF) {
        if (!STATE.achievements.includes(a.id)) {
            let ok = false;
            try { ok = a.check(); } catch (e) { ok = false; }
            if (ok) {
                STATE.achievements.push(a.id);
                localStorage.setItem('cv_achievements', JSON.stringify(STATE.achievements));
                showAchievementModal(a);
                updateMiniAchievements();
            }
        }
    }
}

function showAchievementModal(a) {
    document.getElementById('ach-modal-icon').textContent = a.icon;
    document.getElementById('ach-modal-title').textContent = a.name;
    document.getElementById('ach-modal-desc').textContent = a.desc;
    document.getElementById('achievement-modal').style.display = 'flex';
    spawnConfetti('ach-confetti');
    playBonusSound();
}

function updateMiniAchievements() {
    const c = document.getElementById('mini-achievements');
    if (!c) return;
    c.innerHTML = '';
    STATE.achievements.slice(-5).forEach(id => {
        const d = ACHIEVEMENTS_DEF.find(a => a.id === id);
        if (d) c.innerHTML += `<div class="mini-ach">${d.icon} ${escapeHtml(d.name)}</div>`;
    });
}

// ============================================================
// ШТРАФ / ПЕРЕГРЕВ
// ============================================================
function activatePenalty(silent) {
    if (STATE.penaltyActive) return;
    STATE.penaltyActive = true;
    const dur = 20 - (STATE.upgrades.penalty_reduction_1 || 0) * 2;
    STATE.penaltyTimer = Math.max(5, dur);
    STATE.energy = 0;
    const b = document.getElementById('penalty-banner');
    if (b) b.style.display = 'flex';
    const cv = document.getElementById('click-canvas');
    if (cv) cv.classList.add('penalty-mode');
    if (!silent) {
        showToast('🚫 Перегрев! ' + Math.ceil(STATE.penaltyTimer) + ' сек перезарядка', 'danger');
        playPenaltySound();
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
}

function updatePenaltyTimer() {
    if (!STATE.penaltyActive) return;
    STATE.penaltyTimer -= 0.1;
    const el = document.getElementById('penalty-timer');
    if (el) el.textContent = Math.max(0, Math.ceil(STATE.penaltyTimer)) + 'с';
    STATE.energy = 0;
    if (STATE.penaltyTimer <= 0) endPenalty();
}

function endPenalty() {
    STATE.penaltyActive = false;
    const b = document.getElementById('penalty-banner');
    if (b) b.style.display = 'none';
    const cv = document.getElementById('click-canvas');
    if (cv) cv.classList.remove('penalty-mode');
    if (!STATE.warmupDone) {           // стартовый «прогрев» — сразу полная энергия
        STATE.warmupDone = true;
        STATE.energy = STATE.maxEnergy;
    } else {
        showToast('✅ Перезарядка завершена!', 'success');
    }
}

// ============================================================
// ЗВУКИ
// ============================================================
function getAudioCtx() {
    if (!STATE.audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        STATE.audioCtx = new AC();
    }
    if (STATE.audioCtx.state === 'suspended') STATE.audioCtx.resume();
    return STATE.audioCtx;
}

function playClickSound() {
    try {
        const ctx = getAudioCtx(); if (!ctx) return;
        const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(800 + Math.min(600, STATE.comboCount * 15), t);
        o.frequency.exponentialRampToValueAtTime(400, t + 0.06);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        o.start(t); o.stop(t + 0.07);
    } catch (e) {}
}

function playBonusSound() {
    try {
        const ctx = getAudioCtx(); if (!ctx) return;
        const t = ctx.currentTime;
        [523, 659, 784, 1047].forEach((f, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sine';
            o.frequency.setValueAtTime(f, t + i * 0.09);
            g.gain.setValueAtTime(0.13, t + i * 0.09);
            g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.3);
            o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.32);
        });
    } catch (e) {}
}

function playPenaltySound() {
    try {
        const ctx = getAudioCtx(); if (!ctx) return;
        const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(200, t);
        o.frequency.exponentialRampToValueAtTime(80, t + 0.3);
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.start(t); o.stop(t + 0.31);
    } catch (e) {}
}

function playComboSound(c) {
    try {
        const ctx = getAudioCtx(); if (!ctx) return;
        const t = ctx.currentTime, base = 400 + Math.min(400, c * 10);
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(base, t);
        o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.08);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        o.start(t); o.stop(t + 0.09);
    } catch (e) {}
}

function playTickSound(high) {
    try {
        const ctx = getAudioCtx(); if (!ctx) return;
        const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'square';
        o.frequency.setValueAtTime(high ? 900 : 500, t);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.start(t); o.stop(t + 0.13);
    } catch (e) {}
}

// ============================================================
// ТОСТЫ / ВСПЛЫВАЮЩИЙ ТЕКСТ / КОНФЕТТИ
// ============================================================
function showToast(message, type = 'info', duration = 3000) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const icons = { success: '✅', warning: '⚠️', danger: '❌', info: 'ℹ️' };
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    c.appendChild(t);
    while (c.children.length > 4) c.removeChild(c.firstChild);
    setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 320); }, duration);
}

function spawnFloatingEvent(text, color) {
    const c = document.getElementById('floating-events-container');
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'floating-event';
    el.textContent = text;
    el.style.color = color;
    c.appendChild(el);
    while (c.children.length > 5) c.removeChild(c.firstChild);
    setTimeout(() => el.remove(), 1200);
}

function spawnConfetti(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = '';
    const colors = ['#7c5cfc', '#06d6a0', '#f72585', '#ffd700', '#ff6b6b', '#4ecdc4'];
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-piece';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = '-10px';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.animationDelay = (Math.random() * 0.5) + 's';
        p.style.animationDuration = (1.5 + Math.random()) + 's';
        c.appendChild(p);
    }
}

function closeModal(id) { const m = document.getElementById(id); if (m) m.style.display = 'none'; }
function openModal(id) { const m = document.getElementById(id); if (m) m.style.display = 'flex'; }

function askConfirm(icon, title, text, onYes) {
    document.getElementById('confirm-icon').textContent = icon;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-text').innerHTML = text;
    const btn = document.getElementById('confirm-yes');
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', () => { closeModal('confirm-modal'); onYes(); });
    openModal('confirm-modal');
}

// ============================================================
// МОДАЛКИ ПРОФИЛЯ
// ============================================================
function showChatRules() { openModal('rules-modal'); }

function showProfileModal() {
    document.getElementById('profile-avatar').textContent = (STATE.nickname || 'A').charAt(0).toUpperCase();
    document.getElementById('profile-modal-nick').textContent = STATE.nickname;
    document.getElementById('profile-modal-clan').textContent =
        STATE.clan ? `🛡️ [${STATE.clan.tag}] ${STATE.clan.name}` : 'Без клана';
    document.getElementById('profile-clicks').textContent = fmt(STATE.clicks);
    document.getElementById('profile-level').textContent = STATE.level;
    document.getElementById('profile-combo').textContent = STATE.maxCombo;
    document.getElementById('new-nick-input').value = '';
    document.getElementById('nick-change-error').textContent = '';
    openModal('profile-modal');
}

function changeNickname() {
    const input = document.getElementById('new-nick-input');
    const nick = input.value.trim();
    const err = document.getElementById('nick-change-error');
    if (nick.length < 2) { err.textContent = '⚠️ Минимум 2 символа'; return; }
    if (nick.length > 15) { err.textContent = '⚠️ Максимум 15 символов'; return; }
    if (containsBadWords(nick)) { err.textContent = '🚫 Недопустимое имя'; return; }
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9_\- ]+$/.test(nick)) { err.textContent = '⚠️ Только буквы, цифры, _-'; return; }
    if (nick === STATE.nickname) { err.textContent = '⚠️ Это ваш текущий ник'; return; }
    if (STATE.clicks < 10000) { err.textContent = '❌ Нужно 10 000 кликов'; return; }

    STATE.clicks -= 10000;
    STATE.nickname = nick;
    localStorage.setItem('cv_nick', nick);
    document.getElementById('header-nickname').textContent = nick;
    document.getElementById('header-avatar').textContent = nick.charAt(0).toUpperCase();

    if (STATE.clanId) db.ref(`clans/${STATE.clanId}/members/${STATE.userId}/nickname`).set(nick);
    if (STATE.currentRoomId) db.ref(`rooms/${STATE.currentRoomId}/players/${STATE.userId}/nickname`).set(nick);

    saveLocal(); saveToFirebase(); updateUI();
    closeModal('profile-modal');
    showToast('✅ Никнейм изменён на «' + escapeHtml(nick) + '»', 'success');
}

// Профиль другого игрока (клик по строке в топе или по нику в чате)
function openPlayerModal(uid) {
    if (!uid || uid === STATE.userId) { showProfileModal(); return; }
    document.getElementById('pm-error').textContent = '';
    document.getElementById('pm-actions').innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Загрузка...</div>';
    openModal('player-modal');

    db.ref('users/' + uid).once('value').then(snap => {
        const u = snap.val();
        if (!u) { document.getElementById('pm-error').textContent = 'Игрок не найден'; return; }
        const nick = u.nickname || 'Аноним';
        document.getElementById('pm-avatar').textContent = nick.charAt(0).toUpperCase();
        document.getElementById('pm-nick').textContent = nick;
        document.getElementById('pm-status').textContent = STATE.onlineUsers[uid] ? '🟢 Сейчас в игре' : '⚫ Оффлайн';
        document.getElementById('pm-clicks').textContent = fmt(u.clicks);
        document.getElementById('pm-level').textContent = u.level || 1;
        document.getElementById('pm-clan').textContent = u.clanTag ? '[' + u.clanTag + ']' : '—';

        const box = document.getElementById('pm-actions');
        box.innerHTML = '';

        if (!STATE.clanId) {
            box.innerHTML = `<div style="font-size:12px;color:var(--text-muted);line-height:1.5;">
                Создайте клан, чтобы приглашать игроков и получать <b style="color:var(--accent-secondary)">+10%</b> с их кликов.</div>
                <button class="modal-btn green" onclick="closeModal('player-modal');switchTab('clan');">🛡️ К кланам</button>`;
            return;
        }
        const members = STATE.clan ? Object.keys(STATE.clan.members || {}) : [];
        if (members.includes(uid)) {
            box.innerHTML = `<div style="font-size:13px;color:var(--accent-secondary);font-weight:700;">✅ Уже в вашем клане</div>`;
            return;
        }
        if (members.length >= CLAN_MAX) {
            box.innerHTML = `<div style="font-size:13px;color:var(--warning);font-weight:700;">⚠️ В клане уже ${CLAN_MAX}/${CLAN_MAX} игроков</div>`;
            return;
        }
        if (u.clanId) {
            box.innerHTML = `<div style="font-size:13px;color:var(--text-muted);">Игрок уже состоит в другом клане</div>`;
            return;
        }
        const b = document.createElement('button');
        b.className = 'modal-btn green';
        b.textContent = '🛡️ Пригласить в клан';
        b.onclick = () => invitePlayer(uid, nick, b);
        box.appendChild(b);
    }).catch(() => { document.getElementById('pm-error').textContent = 'Ошибка загрузки'; });
}

// ============================================================
// СКРОЛЛ ЧАТА
// ============================================================
function chatScrollUp() { const c = document.getElementById('chat-messages'); if (c) c.scrollBy({ top: -180, behavior: 'smooth' }); }
function chatScrollDown() { const c = document.getElementById('chat-messages'); if (c) c.scrollBy({ top: 180, behavior: 'smooth' }); }

// ============================================================
// ЧАСТИЦЫ
// ============================================================
function spawnParticles(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
        STATE.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8 - 3,
            life: 1,
            decay: 0.015 + Math.random() * 0.02,
            size: 2 + Math.random() * 4,
            color: Math.random() > 0.5 ? '#7c5cfc' : '#06d6a0',
            type: Math.random() > 0.7 ? 'star' : 'circle'
        });
    }
    if (STATE.particles.length > 400) STATE.particles.splice(0, STATE.particles.length - 400);
}

function updateAndDrawParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) { requestAnimationFrame(updateAndDrawParticles); return; }
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width + 100));
    const h = Math.max(1, Math.round(rect.height + 100));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = STATE.particles.length - 1; i >= 0; i--) {
        const p = STATE.particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= p.decay;
        if (p.life <= 0) { STATE.particles.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        const cx = p.x + 50, cy = p.y + 50;
        if (p.type === 'star') drawStar(ctx, cx, cy, p.size);
        else { ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.5, p.size * p.life), 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    requestAnimationFrame(updateAndDrawParticles);
}

function drawStar(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](x + r * Math.cos(a), y + r * Math.sin(a));
    }
    ctx.closePath(); ctx.fill();
}

// ============================================================
// РИСОВАНИЕ КНОПКИ КЛИКЕРА
// ============================================================
function drawClickButton() {
    const canvas = document.getElementById('click-canvas');
    if (!canvas) { requestAnimationFrame(drawClickButton); return; }
    const ctx = canvas.getContext('2d');
    const w = canvas.width, cx = w / 2;
    const r = (w * 0.38) * STATE.btnScale;

    ctx.clearRect(0, 0, w, w);

    ctx.beginPath();
    ctx.arc(cx, cx, r + 30, 0, Math.PI * 2);
    ctx.fillStyle = STATE.penaltyActive ? 'rgba(255,71,87,0.15)' : `hsla(${(Date.now() / 30) % 360},70%,60%,0.08)`;
    ctx.fill();

    ctx.beginPath(); ctx.arc(cx, cx + 6, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();

    ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(cx - r * 0.3, cx - r * 0.3, 0, cx, cx, r);
    if (STATE.penaltyActive) { g.addColorStop(0, '#ff6b6b'); g.addColorStop(1, '#c0392b'); }
    else { g.addColorStop(0, '#a78bfa'); g.addColorStop(1, '#5a3ce0'); }
    ctx.fillStyle = g; ctx.fill();

    ctx.beginPath(); ctx.arc(cx - r * 0.15, cx - r * 0.2, r * 0.55, 0, Math.PI * 2);
    const hg = ctx.createRadialGradient(cx - r * 0.15, cx - r * 0.3, 0, cx - r * 0.15, cx - r * 0.2, r * 0.55);
    hg.addColorStop(0, 'rgba(255,255,255,0.2)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg; ctx.fill();

    const pct = Math.max(0, Math.min(1, STATE.energy / STATE.maxEnergy));
    ctx.beginPath();
    ctx.arc(cx, cx, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.strokeStyle = STATE.penaltyActive ? '#ff4757' : pct > 0.3 ? '#06d6a0' : pct > 0.1 ? '#ffa502' : '#ff4757';
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();

    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (STATE.penaltyActive) {
        ctx.font = `800 ${w * 0.07}px Inter, sans-serif`;
        ctx.fillText('ПЕРЕГРЕВ', cx, cx - 10);
        ctx.font = `900 ${w * 0.12}px Inter, sans-serif`;
        ctx.fillText(Math.max(0, Math.ceil(STATE.penaltyTimer)) + 'с', cx, cx + 20);
    } else {
        ctx.font = `900 ${w * 0.13}px Inter, sans-serif`;
        ctx.fillText('КЛИК', cx, cx);
        if (STATE.comboCount > 4) {
            ctx.font = `800 ${w * 0.055}px Inter, sans-serif`;
            ctx.fillStyle = '#ffd700';
            ctx.fillText('x' + STATE.comboCount, cx, cx + w * 0.11);
        }
    }
    requestAnimationFrame(drawClickButton);
}

// ============================================================
// РЕГИСТРАЦИЯ / ЗАПУСК
// ============================================================
function register() {
    const input = document.getElementById('nickname-input');
    const nick = input.value.trim();
    const err = document.getElementById('reg-error');

    if (nick.length < 2) { err.textContent = '⚠️ Минимум 2 символа'; return; }
    if (nick.length > 15) { err.textContent = '⚠️ Максимум 15 символов'; return; }
    if (containsBadWords(nick)) { err.textContent = '🚫 Недопустимое имя'; return; }
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9_\- ]+$/.test(nick)) { err.textContent = '⚠️ Только буквы, цифры, _-'; return; }

    err.textContent = '';
    document.getElementById('reg-btn').innerHTML = '<span class="btn-text">Подключение...</span>';

    if (!STATE.userId) STATE.userId = 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    STATE.nickname = nick;
    localStorage.setItem('cv_uid', STATE.userId);
    localStorage.setItem('cv_nick', nick);

    db.ref('users/' + STATE.userId).update({
        nickname: nick, clicks: STATE.clicks, totalClicks: STATE.totalClicks,
        level: STATE.level, lastSeen: firebase.database.ServerValue.TIMESTAMP
    }).then(startGame).catch(() => {
        err.textContent = '❌ Ошибка подключения';
        document.getElementById('reg-btn').innerHTML = '<span class="btn-text">Начать игру</span><span class="btn-icon">→</span>';
    });
}

function startGame() {
    if (STATE.gameStarted) return;
    STATE.gameStarted = true;

    document.getElementById('registration-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
    document.getElementById('header-nickname').textContent = STATE.nickname;
    document.getElementById('header-avatar').textContent = (STATE.nickname || 'A').charAt(0).toUpperCase();
    document.getElementById('streak-display').textContent = STATE.streak;

    drawLogo(document.getElementById('header-logo'));
    recalcLevel(true);
    updateUI();
    updateMiniAchievements();
    checkDailyStreak();

    // Подтягиваем серверные данные (клан, максимум кликов)
    db.ref('users/' + STATE.userId).once('value').then(snap => {
        const u = snap.val() || {};
        if ((u.clicks || 0) > STATE.clicks) STATE.clicks = u.clicks;
        if ((u.totalClicks || 0) > STATE.totalClicks) STATE.totalClicks = u.totalClicks;
        if (u.clanId) STATE.clanId = u.clanId;
        recalcLevel(true);
        saveLocal(); updateUI();
        if (STATE.clanId) attachClanListener(STATE.clanId); else renderClan();
        saveToFirebase();
    }).catch(() => { if (STATE.clanId) attachClanListener(STATE.clanId); else renderClan(); });

    drawClickButton();
    updateAndDrawParticles();
    setupClicker();
    setupOnlineCounter();
    listenInbox();
    listenInvites();
    listenLeaderboard();
    listenChat();
    renderShop();
    renderArenaLobby();
    setupArenaGlobalListeners();

    activatePenalty(true);          // короткий стартовый «прогрев»
    STATE.penaltyTimer = 3;

    // Авто-шахтёр
    setInterval(() => {
        const lvl = STATE.upgrades.auto_clicker_1 || 0;
        if (lvl > 0) { addClicks(lvl); updateUI(); }
    }, 1000);

    // Главный цикл (энергия / штраф)
    setInterval(() => {
        if (STATE.penaltyActive) { updatePenaltyTimer(); updateUI(); return; }
        if (STATE.energy < STATE.maxEnergy) STATE.energy = Math.min(STATE.maxEnergy, STATE.energy + STATE.energyRegen / 10);
        updateUI();
    }, 100);

    setInterval(updateCPS, 200);
    setInterval(() => { saveLocal(); saveToFirebase(); }, 5000);
    setInterval(checkAchievements, 2000);
    setInterval(flushClanShare, 5000);
    setInterval(flushClanToast, 4000);
    setInterval(arenaTick, 100);
    setInterval(cleanupRooms, 60000);
    setTimeout(cleanupRooms, 8000);
}

function saveLocal() {
    localStorage.setItem('cv_clicks', Math.floor(STATE.clicks));
    localStorage.setItem('cv_total', Math.floor(STATE.totalClicks));
    localStorage.setItem('cv_level', STATE.level);
    localStorage.setItem('cv_upgrades', JSON.stringify(STATE.upgrades));
    localStorage.setItem('cv_maxcombo', STATE.maxCombo);
    localStorage.setItem('cv_clanbonus', Math.floor(STATE.clanBonus));
    if (STATE.clanId) localStorage.setItem('cv_clan', STATE.clanId); else localStorage.removeItem('cv_clan');
}

function saveToFirebase() {
    if (!STATE.userId || !STATE.nickname) return;
    db.ref('users/' + STATE.userId).update({
        nickname: STATE.nickname,
        clicks: Math.floor(STATE.clicks),
        totalClicks: Math.floor(STATE.totalClicks),
        level: STATE.level,
        maxCombo: STATE.maxCombo,
        clanId: STATE.clanId || null,
        clanTag: STATE.clan ? STATE.clan.tag : null,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    }).catch(() => {});
}

// ============================================================
// НАЧИСЛЕНИЕ КЛИКОВ
// ============================================================
function addClicks(n) {
    n = Math.max(0, Math.floor(n));
    if (!n) return;
    STATE.clicks += n;
    STATE.totalClicks += n;
    if (STATE.clanId && STATE.clan) { STATE.clanEarnWindow += n; STATE.clanPending += n * CLAN_SHARE; }
    recalcLevel();
}

// начисление извне (арена, клан) — без повторной раздачи 10%
function addClicksRaw(n) {
    n = Math.max(0, Math.floor(n));
    if (!n) return;
    STATE.clicks += n;
    STATE.totalClicks += n;
    recalcLevel();
}

function recalcLevel(silent) {
    const lvl = Math.floor(STATE.totalClicks / STATE.clicksPerLevel) + 1;
    if (!silent && lvl > STATE.level) {
        STATE.level = lvl;
        showToast('🎉 Новый уровень: ' + lvl + '!', 'success');
        playBonusSound();
        spawnFloatingEvent('⭐ УРОВЕНЬ ' + lvl, 'var(--accent-gold)');
    } else {
        STATE.level = lvl;
    }
}

// ============================================================
// КЛИКЕР
// ============================================================
function setupClicker() {
    const cvs = document.getElementById('click-canvas');
    if (!cvs || cvs.dataset.bound) return;
    cvs.dataset.bound = '1';

    const handleClick = (e) => {
        e.preventDefault(); e.stopPropagation();
        getAudioCtx();

        if (STATE.penaltyActive) { playPenaltySound(); return; }
        if (STATE.energy < STATE.energyCost) { activatePenalty(); return; }

        STATE.energy -= STATE.energyCost;
        if (STATE.energy <= 0) activatePenalty();

        let base = 1 + (STATE.upgrades.click_multiplier_1 || 0);

        let isCrit = false;
        if (STATE.upgrades.crit_chance_1 && Math.random() < STATE.upgrades.crit_chance_1 * 0.03) {
            base *= 5; isCrit = true;
            spawnFloatingEvent('⚡ КРИТ x5', '#f72585');
        }
        let isLucky = false;
        if (!isCrit && STATE.upgrades.lucky_click_1 && Math.random() < STATE.upgrades.lucky_click_1 * 0.05) {
            base *= 2; isLucky = true;
            spawnFloatingEvent('🍀 УДАЧА x2', '#ffd700');
        }

        const points = Math.max(1, Math.round(base * STATE.multiplier));
        addClicks(points);

        STATE.cpsHistory.push(Date.now());
        updateCombo();

        STATE.btnScale = 0.88;
        setTimeout(() => STATE.btnScale = 1, 90);
        playClickSound();

        const touch = e.touches ? e.touches[0] : e;
        const rect = cvs.getBoundingClientRect();
        const lx = touch.clientX - rect.left, ly = touch.clientY - rect.top;
        spawnParticles(
            (lx / rect.width) * (rect.width + 100) - 50,
            (ly / rect.height) * (rect.height + 100) - 50,
            isCrit ? 16 : 8
        );

        const fb = document.createElement('div');
        fb.className = 'click-feedback';
        fb.textContent = '+' + points;
        fb.style.left = (touch.clientX - 15) + 'px';
        fb.style.top = (touch.clientY - 25) + 'px';
        if (isCrit) { fb.style.color = '#f72585'; fb.style.fontSize = '38px'; }
        else if (isLucky) { fb.style.color = '#ffd700'; fb.style.fontSize = '32px'; }
        document.body.appendChild(fb);
        setTimeout(() => fb.remove(), 700);

        updateUI();
    };

    cvs.addEventListener('mousedown', handleClick);
    cvs.addEventListener('touchstart', handleClick, { passive: false });
    cvs.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    cvs.addEventListener('contextmenu', e => e.preventDefault());
}

function updateCPS() {
    const now = Date.now();
    STATE.cpsHistory = STATE.cpsHistory.filter(t => now - t < 1000);
    STATE.currentCps = STATE.cpsHistory.length;
    const el = document.getElementById('cps-display');
    if (el) el.textContent = STATE.currentCps;
    if (STATE.comboCount > 0 && now - STATE.lastClickTime > 1200) STATE.comboCount = 0;
}

function updateCombo() {
    const now = Date.now();
    const comboTime = 500 * (1 + (STATE.upgrades.combo_boost_1 || 0) * 0.15);
    if (now - STATE.lastClickTime < comboTime) {
        STATE.comboCount++;
        if (STATE.comboCount > STATE.maxCombo) {
            STATE.maxCombo = STATE.comboCount;
            localStorage.setItem('cv_maxcombo', STATE.maxCombo);
        }
        if (STATE.comboCount >= 5 && STATE.comboCount % 5 === 0) {
            playComboSound(STATE.comboCount);
            spawnFloatingEvent(`🔥 COMBO x${STATE.comboCount}`, '#f72585');
        }
    } else {
        STATE.comboCount = 1;
    }
    STATE.lastClickTime = now;
}

// ============================================================
// UI
// ============================================================
function updateUI() {
    const set = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; };

    set('clicks-display', fmt(STATE.clicks));
    set('level-display', String(STATE.level));
    set('header-level-badge', 'Ур. ' + STATE.level);
    set('shop-balance', fmt(STATE.clicks));
    set('energy-text', Math.floor(STATE.energy) + ' / ' + STATE.maxEnergy);

    const eb = document.getElementById('energy-bar');
    if (eb) {
        eb.style.width = Math.max(0, Math.min(100, STATE.energy / STATE.maxEnergy * 100)) + '%';
        eb.classList.remove('danger', 'penalty');
        if (STATE.penaltyActive) eb.classList.add('penalty');
        else if (STATE.energy < 20) eb.classList.add('danger');
    }

    const prog = STATE.totalClicks % STATE.clicksPerLevel;
    set('level-progress-label', fmt(prog) + ' / ' + fmt(STATE.clicksPerLevel));
    const lb = document.getElementById('level-bar');
    if (lb) lb.style.width = (prog / STATE.clicksPerLevel * 100) + '%';
}

// ============================================================
// СТРИК
// ============================================================
function checkDailyStreak() {
    const today = new Date().toISOString().split('T')[0];
    if (STATE.lastLoginDate === today) return;
    if (STATE.lastLoginDate) {
        const diff = Math.floor((new Date(today) - new Date(STATE.lastLoginDate)) / 86400000);
        if (diff === 1) { STATE.streak++; showToast(`🔥 Серия: ${STATE.streak} дней подряд!`, 'success'); }
        else if (diff > 1) { STATE.streak = 1; showToast('📅 Серия сброшена. Заходите каждый день!', 'warning'); }
    } else STATE.streak = 1;
    STATE.lastLoginDate = today;
    localStorage.setItem('cv_streak', STATE.streak);
    localStorage.setItem('cv_lastlogin', today);
    const el = document.getElementById('streak-display');
    if (el) el.textContent = STATE.streak;
}

// ============================================================
// ONLINE
// ============================================================
function setupOnlineCounter() {
    if (!STATE.userId) return;
    const onlineRef = db.ref('online/' + STATE.userId);
    db.ref('.info/connected').on('value', snap => {
        if (snap.val() === true) {
            onlineRef.onDisconnect().remove();
            onlineRef.set({ nickname: STATE.nickname, ts: firebase.database.ServerValue.TIMESTAMP });
        }
    });
    db.ref('online').on('value', snap => {
        STATE.onlineUsers = {};
        snap.forEach(c => { STATE.onlineUsers[c.key] = true; });
        const el = document.getElementById('online-num');
        if (el) el.textContent = Object.keys(STATE.onlineUsers).length;
        renderLeaderboard();
    });
}

// ============================================================
// INBOX (надёжные начисления: арена, клан, возвраты)
// ============================================================
function listenInbox() {
    if (!STATE.userId) return;
    db.ref('inbox/' + STATE.userId).on('child_added', snap => {
        const d = snap.val() || {};
        const amt = Math.max(0, Math.floor(d.amount || 0));
        snap.ref.remove();
        if (!amt) return;
        addClicksRaw(amt);
        saveLocal(); updateUI();
        if (d.reason === 'clan') {
            STATE.clanBonus += amt;
            STATE.clanToastBuf += amt;
        } else if (d.reason === 'arena_win') {
            showToast(`👑 Победа на арене: +${fmt(amt)} кликов!`, 'success', 5000);
            playBonusSound();
        } else if (d.reason === 'refund') {
            showToast(`↩️ Возврат ставки: +${fmt(amt)}`, 'info');
        } else {
            showToast(`+${fmt(amt)} кликов`, 'success');
        }
    });
}

function sendToInbox(uid, amount, reason, from) {
    if (!uid || amount <= 0) return;
    db.ref('inbox/' + uid).push({
        amount: Math.floor(amount),
        reason: reason || 'gift',
        from: from || '',
        ts: firebase.database.ServerValue.TIMESTAMP
    }).catch(() => {});
}

function flushClanToast() {
    if (STATE.clanToastBuf >= 1) {
        showToast(`🛡️ Бонус клана: +${fmt(STATE.clanToastBuf)} кликов`, 'info', 2500);
        STATE.clanToastBuf = 0;
        renderClanIfOpen();
    }
}

// ============================================================
// РАЗДАЧА 10% СОКЛАНАМ
// ============================================================
function flushClanShare() {
    if (!STATE.clanId || !STATE.clan || !STATE.clan.members) { STATE.clanPending = 0; STATE.clanEarnWindow = 0; return; }
    const share = Math.floor(STATE.clanPending);
    if (share < 1) return;
    STATE.clanPending -= share;
    const earned = Math.round(STATE.clanEarnWindow);
    STATE.clanEarnWindow = 0;

    const others = Object.keys(STATE.clan.members).filter(id => id !== STATE.userId);
    others.forEach(id => sendToInbox(id, share, 'clan', STATE.nickname));

    if (earned > 0) {
        db.ref(`clans/${STATE.clanId}/members/${STATE.userId}/contributed`).transaction(v => (v || 0) + earned);
        db.ref(`clans/${STATE.clanId}/totalClicks`).transaction(v => (v || 0) + earned);
    }
}

// ============================================================
// ТАБЛИЦА ЛИДЕРОВ
// ============================================================
function listenLeaderboard() {
    db.ref('users').orderByChild('clicks').limitToLast(25).on('value', snap => {
        const users = [];
        snap.forEach(c => {
            const u = c.val();
            if (u && u.nickname) users.push({ id: c.key, ...u });
        });
        users.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
        STATE.usersCache = users.slice(0, 15);
        renderLeaderboard();
    });
}

function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    const top = STATE.usersCache;
    const badge = document.getElementById('lb-count');
    if (badge) badge.textContent = top.length;

    if (!top.length) { list.innerHTML = '<div class="lb-empty">Пока никого нет.<br>Будьте первым! 🚀</div>'; return; }

    list.innerHTML = '';
    top.forEach((u, i) => {
        const rank = i + 1;
        const isMe = u.id === STATE.userId;
        const online = !!STATE.onlineUsers[u.id];
        const rc = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
        const nick = u.nickname || 'Аноним';
        const item = document.createElement('div');
        item.className = 'lb-item' + (isMe ? ' is-me' : '');
        item.innerHTML = `
            <div class="lb-rank ${rc}">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</div>
            <div class="lb-avatar">${escapeHtml(nick.charAt(0).toUpperCase())}<span class="dot ${online ? 'online' : 'offline'}"></span></div>
            <div class="lb-info">
                <div class="lb-name">${u.clanTag ? `<span class="lb-clan">${escapeHtml(u.clanTag)}</span>` : ''}${escapeHtml(nick)}</div>
                <div class="lb-clicks">${fmt(u.clicks)} кликов</div>
            </div>
            <div class="lb-level-badge">Ур. ${u.level || 1}</div>`;
        item.onclick = () => openPlayerModal(u.id);
        list.appendChild(item);
    });
}

// ============================================================
// ОБЩИЙ ЧАТ
// ============================================================
function listenChat() {
    if (STATE.chatInitialized) return;
    STATE.chatInitialized = true;

    db.ref('chat').limitToLast(50).on('child_added', snap => {
        const m = snap.val();
        if (!m || !m.text) return;
        const container = document.getElementById('chat-messages');
        if (!container) return;
        const isMe = m.userId === STATE.userId;

        const el = document.createElement('div');
        el.className = 'chat-msg' + (isMe ? ' my-msg' : '');
        const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';

        let nameStyle = '';
        if (m.chatColor) {
            let hash = 0; const s = m.nickname || '';
            for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
            nameStyle = ` style="color:hsl(${Math.abs(hash) % 360},80%,65%)"`;
        }
        const badge = m.vipBadge ? '⭐ ' : '';
        const clan = m.clanTag ? `<span class="lb-clan">${escapeHtml(m.clanTag)}</span> ` : '';

        el.innerHTML = `
            <div class="chat-msg-header">
                <span class="chat-msg-name"${nameStyle} data-uid="${escapeHtml(m.userId || '')}">${clan}${badge}${escapeHtml(m.nickname || 'Аноним')}</span>
                <span class="chat-msg-level">Ур.${m.level || 1}</span>
                <span class="chat-msg-time">${time}</span>
            </div>
            <div class="chat-msg-text">${escapeHtml(censorText(String(m.text).substring(0, 200)))}</div>`;

        const nameEl = el.querySelector('.chat-msg-name');
        if (nameEl && m.userId) nameEl.onclick = () => openPlayerModal(m.userId);

        container.appendChild(el);
        while (container.children.length > 80) container.removeChild(container.firstChild);

        const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
        if (atBottom || isMe) container.scrollTop = container.scrollHeight;

        if (!isMe && STATE.currentTab !== 'chat') {
            STATE.unseenMessages++;
            const b = document.getElementById('chat-badge');
            if (b) { b.style.display = 'flex'; b.textContent = STATE.unseenMessages > 9 ? '9+' : STATE.unseenMessages; }
        }
    });
}

function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    if (text.length > 200) { showToast('Сообщение слишком длинное (макс. 200)', 'warning'); return; }
    if (containsBadWords(text)) { showToast('🚫 Сообщение содержит запрещённые слова', 'danger'); input.value = ''; return; }

    const now = Date.now();
    if (!sendChat._last) sendChat._last = 0;
    if (now - sendChat._last < 1500) { showToast('⏳ Подождите перед следующим сообщением', 'warning'); return; }
    sendChat._last = now;

    db.ref('chat').push({
        nickname: STATE.nickname,
        userId: STATE.userId,
        text: text,
        level: STATE.level,
        clanTag: STATE.clan ? STATE.clan.tag : null,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        chatColor: (STATE.upgrades.chat_color_1 || 0) > 0,
        vipBadge: (STATE.upgrades.chat_badge_1 || 0) > 0
    });
    input.value = '';
}

// ============================================================
// МАГАЗИН
// ============================================================
function renderShop() {
    const c = document.getElementById('shop-items');
    if (!c) return;
    c.innerHTML = '';
    UPGRADES.forEach(item => {
        const lvl = STATE.upgrades[item.id] || 0;
        const max = lvl >= item.maxLevel;
        const cost = Math.floor(item.baseCost * Math.pow(1.5, lvl));
        const can = STATE.clicks >= cost;
        const div = document.createElement('div');
        div.className = 'shop-item' + (max ? ' max-level' : '');
        div.innerHTML = `
            <div class="shop-item-header">
                <div class="shop-item-icon">${item.icon}</div>
                <div class="shop-item-info">
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-level">Уровень: ${lvl} / ${item.maxLevel}</div>
                </div>
            </div>
            <div class="shop-item-desc">${item.desc}</div>
            <div class="shop-item-footer">
                ${max ? '<div class="shop-item-max">⭐ МАКСИМУМ</div>'
                      : `<div class="shop-item-price">💎 ${fmt(cost)}</div>
                         <button class="shop-item-buy" ${can ? '' : 'disabled'} data-id="${item.id}">${can ? 'Купить' : 'Мало 💎'}</button>`}
            </div>`;
        const btn = div.querySelector('.shop-item-buy');
        if (btn) btn.onclick = () => buyUpgrade(item.id);
        c.appendChild(div);
    });
}

function buyUpgrade(id) {
    const up = UPGRADES.find(u => u.id === id);
    if (!up) return;
    const lvl = STATE.upgrades[id] || 0;
    if (lvl >= up.maxLevel) { showToast('⚠️ Достигнут максимум', 'warning'); return; }
    const cost = Math.floor(up.baseCost * Math.pow(1.5, lvl));
    if (STATE.clicks < cost) { showToast('❌ Недостаточно кликов', 'danger'); return; }

    STATE.clicks -= cost;
    STATE.upgrades[id] = lvl + 1;
    saveLocal(); saveToFirebase(); updateUI(); renderShop();
    showToast(`✅ Куплено: ${up.name} (Ур. ${STATE.upgrades[id]})`, 'success');
    playBonusSound();
}

// ============================================================
// ============================  КЛАНЫ  ========================
// ============================================================
let CLAN_REF = null, CLAN_CB = null;

function attachClanListener(clanId) {
    detachClanListener();
    if (!clanId) { renderClan(); return; }
    STATE.clanId = clanId;
    CLAN_REF = db.ref('clans/' + clanId);
    CLAN_CB = CLAN_REF.on('value', snap => {
        const c = snap.val();
        if (!c) {
            STATE.clan = null; STATE.clanId = null;
            localStorage.removeItem('cv_clan');
            db.ref('users/' + STATE.userId).update({ clanId: null, clanTag: null });
            detachClanListener();
            showToast('🛡️ Клан был распущен', 'warning');
            renderClan(); updateClanHeader();
            return;
        }
        if (!c.members || !c.members[STATE.userId]) {
            STATE.clan = null; STATE.clanId = null;
            localStorage.removeItem('cv_clan');
            db.ref('users/' + STATE.userId).update({ clanId: null, clanTag: null });
            detachClanListener();
            showToast('🚪 Вы больше не состоите в клане', 'warning');
            renderClan(); updateClanHeader();
            return;
        }
        STATE.clan = c;
        localStorage.setItem('cv_clan', clanId);
        db.ref('users/' + STATE.userId).update({ clanId: clanId, clanTag: c.tag });
        renderClan(); updateClanHeader();
    });
}

function detachClanListener() {
    if (CLAN_REF && CLAN_CB) { CLAN_REF.off('value', CLAN_CB); }
    CLAN_REF = null; CLAN_CB = null;
}

function updateClanHeader() {
    const tagEl = document.getElementById('header-clan-tag');
    if (tagEl) tagEl.textContent = STATE.clan ? '[' + STATE.clan.tag + ']' : '';
    const mini = document.getElementById('clan-mini');
    const miniTxt = document.getElementById('clan-mini-text');
    if (mini && miniTxt) {
        if (STATE.clan) {
            const n = Object.keys(STATE.clan.members || {}).length;
            mini.classList.add('visible');
            miniTxt.textContent = `${STATE.clan.name} • ${n}/${CLAN_MAX} • +${CLAN_MAX > 1 ? 10 : 0}% сокланам`;
        } else mini.classList.remove('visible');
    }
    const cnt = document.getElementById('clan-members-count');
    if (cnt) cnt.textContent = (STATE.clan ? Object.keys(STATE.clan.members || {}).length : 0) + '/' + CLAN_MAX;
}

function listenInvites() {
    if (!STATE.userId) return;
    db.ref('invites/' + STATE.userId).on('value', snap => {
        STATE.clanInvites = snap.val() || {};
        const keys = Object.keys(STATE.clanInvites);
        const n = keys.length;

        [['clan-side-badge'], ['clan-nav-badge']].forEach(([id]) => {
            const b = document.getElementById(id);
            if (b) { b.style.display = n ? 'flex' : 'none'; b.textContent = n > 9 ? '9+' : n; }
        });

        if (!STATE.clanId) {
            for (const k of keys) {
                if (!STATE.seenInvites.has(k)) {
                    STATE.seenInvites.add(k);
                    showInviteModal(STATE.clanInvites[k], k);
                    break;
                }
            }
        }
        renderClanIfOpen();
    });
}

function showInviteModal(inv, clanId) {
    if (!inv) return;
    document.getElementById('clan-invite-text').innerHTML =
        `<b>${escapeHtml(inv.fromNick || 'Игрок')}</b> приглашает вас в клан<br>
         <span style="color:var(--accent-secondary);font-weight:800">[${escapeHtml(inv.clanTag || '')}] ${escapeHtml(inv.clanName || '')}</span><br><br>
         Все участники получают <b>+10%</b> от кликов друг друга.`;
    const acc = document.getElementById('clan-invite-accept');
    const dec = document.getElementById('clan-invite-decline');
    const a2 = acc.cloneNode(true), d2 = dec.cloneNode(true);
    acc.parentNode.replaceChild(a2, acc);
    dec.parentNode.replaceChild(d2, dec);
    a2.onclick = () => { closeModal('clan-invite-modal'); acceptInvite(clanId); };
    d2.onclick = () => { closeModal('clan-invite-modal'); declineInvite(clanId); };
    openModal('clan-invite-modal');
    playBonusSound();
}

function createClan() {
    const name = document.getElementById('clan-name-input').value.trim();
    const tag = document.getElementById('clan-tag-input').value.trim().toUpperCase();
    const err = document.getElementById('create-clan-error');
    err.textContent = '';

    if (STATE.clanId) { err.textContent = '⚠️ Вы уже в клане'; return; }
    if (name.length < 3) { err.textContent = '⚠️ Название: минимум 3 символа'; return; }
    if (name.length > 18) { err.textContent = '⚠️ Название: максимум 18 символов'; return; }
    if (tag.length < 2 || tag.length > 4) { err.textContent = '⚠️ Тег: 2–4 символа'; return; }
    if (!/^[A-ZА-Я0-9]+$/.test(tag)) { err.textContent = '⚠️ Тег: только буквы и цифры'; return; }
    if (containsBadWords(name) || containsBadWords(tag)) { err.textContent = '🚫 Недопустимое название'; return; }
    if (STATE.clicks < CLAN_COST) { err.textContent = `❌ Нужно ${fmt(CLAN_COST)} кликов`; return; }

    err.textContent = '⏳ Проверка тега...';
    db.ref('clans').orderByChild('tag').equalTo(tag).once('value').then(s => {
        if (s.exists()) { err.textContent = '⚠️ Такой тег уже занят'; return; }

        STATE.clicks -= CLAN_COST;
        saveLocal(); updateUI();

        const ref = db.ref('clans').push();
        ref.set({
            name, tag,
            leaderId: STATE.userId,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            totalClicks: 0,
            members: {
                [STATE.userId]: {
                    nickname: STATE.nickname, role: 'leader',
                    contributed: 0, joinedAt: firebase.database.ServerValue.TIMESTAMP
                }
            }
        }).then(() => {
            db.ref('invites/' + STATE.userId).remove();
            attachClanListener(ref.key);
            saveToFirebase();
            closeModal('create-clan-modal');
            showToast(`🛡️ Клан «${escapeHtml(name)}» создан!`, 'success');
            playBonusSound();
            switchTab('clan');
        }).catch(() => {
            STATE.clicks += CLAN_COST; saveLocal(); updateUI();
            err.textContent = '❌ Ошибка создания клана';
        });
    }).catch(() => { err.textContent = '❌ Ошибка сети'; });
}

function invitePlayer(uid, nick, btnEl) {
    if (!STATE.clanId || !STATE.clan) { showToast('❌ Вы не в клане', 'danger'); return; }
    const members = Object.keys(STATE.clan.members || {});
    if (members.length >= CLAN_MAX) { showToast(`❌ В клане максимум ${CLAN_MAX} игроков`, 'danger'); return; }
    if (members.includes(uid)) { showToast('⚠️ Игрок уже в клане', 'warning'); return; }
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳ Отправка...'; }

    db.ref(`invites/${uid}/${STATE.clanId}`).set({
        clanId: STATE.clanId,
        clanName: STATE.clan.name,
        clanTag: STATE.clan.tag,
        fromNick: STATE.nickname,
        fromId: STATE.userId,
        ts: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        if (btnEl) btnEl.textContent = '✅ Приглашение отправлено';
        showToast(`📨 Приглашение отправлено игроку ${escapeHtml(nick)}`, 'success');
    }).catch(() => {
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = '🛡️ Пригласить в клан'; }
        showToast('❌ Не удалось отправить', 'danger');
    });
}

function acceptInvite(clanId) {
    if (STATE.clanId) { showToast('⚠️ Вы уже состоите в клане', 'warning'); return; }
    db.ref('clans/' + clanId).once('value').then(snap => {
        const c = snap.val();
        if (!c) { showToast('❌ Клан больше не существует', 'danger'); db.ref(`invites/${STATE.userId}/${clanId}`).remove(); return; }
        const members = Object.keys(c.members || {});
        if (members.length >= CLAN_MAX) { showToast('❌ В клане нет свободных мест', 'danger'); return; }

        db.ref(`clans/${clanId}/members/${STATE.userId}`).set({
            nickname: STATE.nickname, role: 'member',
            contributed: 0, joinedAt: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            db.ref('invites/' + STATE.userId).remove();
            attachClanListener(clanId);
            saveToFirebase();
            showToast(`🛡️ Вы вступили в клан «${escapeHtml(c.name)}»!`, 'success');
            playBonusSound();
            switchTab('clan');
        });
    });
}

function declineInvite(clanId) {
    db.ref(`invites/${STATE.userId}/${clanId}`).remove();
    showToast('Приглашение отклонено', 'info');
}

function leaveClan() {
    if (!STATE.clanId || !STATE.clan) return;
    const clanId = STATE.clanId;
    const isLeader = STATE.clan.leaderId === STATE.userId;
    const others = Object.keys(STATE.clan.members || {}).filter(id => id !== STATE.userId);

    askConfirm('🚪', isLeader && others.length === 0 ? 'Распустить клан?' : 'Покинуть клан?',
        isLeader && others.length > 0
            ? 'Лидерство перейдёт другому участнику.'
            : (others.length === 0 ? 'Клан будет удалён навсегда.' : 'Вы потеряете бонус +10% от сокланов.'),
        () => {
            if (isLeader && others.length === 0) {
                db.ref('clans/' + clanId).remove();
            } else {
                db.ref(`clans/${clanId}/members/${STATE.userId}`).remove();
                if (isLeader && others.length > 0) {
                    db.ref(`clans/${clanId}/leaderId`).set(others[0]);
                    db.ref(`clans/${clanId}/members/${others[0]}/role`).set('leader');
                }
            }
            STATE.clanId = null; STATE.clan = null; STATE.clanPending = 0; STATE.clanEarnWindow = 0;
            localStorage.removeItem('cv_clan');
            detachClanListener();
            db.ref('users/' + STATE.userId).update({ clanId: null, clanTag: null });
            renderClan(); updateClanHeader();
            showToast('🚪 Вы покинули клан', 'info');
        });
}

function kickMember(uid, nick) {
    if (!STATE.clan || STATE.clan.leaderId !== STATE.userId) return;
    askConfirm('⚔️', 'Исключить игрока?', `Исключить <b>${escapeHtml(nick)}</b> из клана?`, () => {
        db.ref(`clans/${STATE.clanId}/members/${uid}`).remove();
        db.ref('users/' + uid).update({ clanId: null, clanTag: null });
        showToast(`Игрок ${escapeHtml(nick)} исключён`, 'warning');
    });
}

function disbandClan() {
    if (!STATE.clan || STATE.clan.leaderId !== STATE.userId) return;
    askConfirm('💥', 'Распустить клан?', 'Клан будет удалён навсегда, все участники его покинут.', () => {
        const id = STATE.clanId;
        Object.keys(STATE.clan.members || {}).forEach(uid => {
            db.ref('users/' + uid).update({ clanId: null, clanTag: null });
        });
        db.ref('clans/' + id).remove();
        STATE.clanId = null; STATE.clan = null;
        localStorage.removeItem('cv_clan');
        detachClanListener();
        renderClan(); updateClanHeader();
        showToast('💥 Клан распущен', 'warning');
    });
}

function renderClanIfOpen() { if (document.getElementById('clan-content')) renderClan(); }

function renderClan() {
    const c = document.getElementById('clan-content');
    if (!c) return;
    updateClanHeader();

    // --- нет клана ---
    if (!STATE.clan) {
        const invites = Object.entries(STATE.clanInvites || {});
        let inviteHtml = '';
        if (invites.length) {
            inviteHtml = `<div class="clan-section-title">📨 Приглашения (${invites.length})</div>`;
            invites.forEach(([cid, inv]) => {
                inviteHtml += `
                <div class="clan-invite-card">
                    <div class="clan-member-avatar">${escapeHtml((inv.clanTag || '?').charAt(0))}</div>
                    <div class="clan-invite-info">
                        <div class="clan-invite-name">[${escapeHtml(inv.clanTag || '')}] ${escapeHtml(inv.clanName || '')}</div>
                        <div class="clan-invite-sub">от ${escapeHtml(inv.fromNick || '')}</div>
                    </div>
                    <button class="clan-mini-btn ok" data-accept="${cid}">✅</button>
                    <button class="clan-mini-btn no" data-decline="${cid}">✖</button>
                </div>`;
            });
        }

        c.innerHTML = `
            <div class="clan-hero">
                <div class="clan-emblem">🛡️</div>
                <div class="clan-title">Вы не в клане</div>
                <div class="clan-tag-label">Объединяйтесь и зарабатывайте вместе</div>
            </div>
            ${inviteHtml}
            <div class="clan-actions">
                <button class="clan-big-btn" id="btn-create-clan">➕ Создать клан (💎 ${fmt(CLAN_COST)})</button>
                <button class="clan-big-btn ghost" id="btn-find-players">🔍 Найти игроков в топе</button>
            </div>
            <div class="clan-info-box">
                <b>Как это работает:</b><br>
                • В клане до <b>${CLAN_MAX}</b> игроков.<br>
                • Каждый клик участника приносит <b>+10%</b> от его награды <b>каждому</b> соклану.<br>
                • Чтобы позвать игрока — нажмите на него в таблице лидеров или в чате.<br>
                • Бонусы приходят автоматически, даже если вы были офлайн.
            </div>`;

        const cb = document.getElementById('btn-create-clan');
        if (cb) cb.onclick = () => {
            document.getElementById('create-clan-error').textContent = '';
            document.getElementById('clan-name-input').value = '';
            document.getElementById('clan-tag-input').value = '';
            openModal('create-clan-modal');
        };
        const fb = document.getElementById('btn-find-players');
        if (fb) fb.onclick = () => switchTab('leaderboard');

        c.querySelectorAll('[data-accept]').forEach(b => b.onclick = () => acceptInvite(b.dataset.accept));
        c.querySelectorAll('[data-decline]').forEach(b => b.onclick = () => declineInvite(b.dataset.decline));
        return;
    }

    // --- есть клан ---
    const clan = STATE.clan;
    const members = Object.entries(clan.members || {})
        .sort((a, b) => (b[1].contributed || 0) - (a[1].contributed || 0));
    const isLeader = clan.leaderId === STATE.userId;
    const my = clan.members[STATE.userId] || {};

    let membersHtml = '';
    members.forEach(([uid, m]) => {
        const isMe = uid === STATE.userId;
        const leader = uid === clan.leaderId;
        const online = !!STATE.onlineUsers[uid];
        membersHtml += `
        <div class="clan-member ${isMe ? 'is-me' : ''}">
            <div class="clan-member-avatar">${escapeHtml((m.nickname || 'A').charAt(0).toUpperCase())}</div>
            <div class="clan-member-info">
                <div class="clan-member-name">
                    ${escapeHtml(m.nickname || 'Аноним')}
                    <span class="clan-role ${leader ? 'role-leader' : 'role-member'}">${leader ? '👑 ЛИДЕР' : 'БОЕЦ'}</span>
                </div>
                <div class="clan-member-sub">${online ? '🟢 в игре' : '⚫ офлайн'} • вклад ${fmt(m.contributed)}</div>
            </div>
            ${(isLeader && !isMe) ? `<button class="clan-kick" data-kick="${uid}" data-nick="${escapeHtml(m.nickname || '')}" title="Исключить">✖</button>` : ''}
        </div>`;
    });

    const free = CLAN_MAX - members.length;
    c.innerHTML = `
        <div class="clan-hero">
            <div class="clan-emblem">${escapeHtml(clan.tag)}</div>
            <div class="clan-title">${escapeHtml(clan.name)}</div>
            <div class="clan-tag-label">[${escapeHtml(clan.tag)}] • ${members.length}/${CLAN_MAX} участников</div>
            <div class="clan-stats-row">
                <div class="clan-stat"><div class="clan-stat-val">${fmt(clan.totalClicks)}</div><div class="clan-stat-lbl">Клики клана</div></div>
                <div class="clan-stat"><div class="clan-stat-val">${fmt(my.contributed)}</div><div class="clan-stat-lbl">Мой вклад</div></div>
                <div class="clan-stat"><div class="clan-stat-val">${fmt(STATE.clanBonus)}</div><div class="clan-stat-lbl">Бонус мне</div></div>
            </div>
        </div>

        <div class="clan-section-title">👥 Состав ${free > 0 ? `• свободно ${free}` : '• полный'}</div>
        ${membersHtml}

        <div class="clan-actions">
            ${free > 0 ? `<button class="clan-big-btn" id="btn-invite-more">➕ Пригласить игрока</button>` : ''}
            <button class="clan-big-btn danger" id="btn-leave-clan">🚪 Покинуть клан</button>
            ${isLeader ? `<button class="clan-big-btn ghost" id="btn-disband-clan">💥 Распустить клан</button>` : ''}
        </div>
        <div class="clan-info-box">
            Каждый ваш клик приносит <b>+10%</b> каждому соклану, а их клики — <b>вам</b>.
            Начисления приходят пачками раз в несколько секунд.
        </div>`;

    c.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => kickMember(b.dataset.kick, b.dataset.nick));
    const inv = document.getElementById('btn-invite-more');
    if (inv) inv.onclick = () => { switchTab('leaderboard'); showToast('👆 Нажмите на игрока в списке, чтобы пригласить', 'info', 4000); };
    const lv = document.getElementById('btn-leave-clan');
    if (lv) lv.onclick = leaveClan;
    const ds = document.getElementById('btn-disband-clan');
    if (ds) ds.onclick = disbandClan;
}

// ============================================================
// ============================  АРЕНА  ========================
// ============================================================
const ARENA = {
    roomsRef: null, roomsCb: null,
    roomRef: null, roomCb: null,
    chatRef: null, chatCb: null,
    refundRef: null,
    lastTickSecond: -1,
    lastChatSend: 0
};

function setBet(v) {
    const el = document.getElementById('room-bet-input');
    if (el) el.value = v;
}

// ---------- ЛОББИ ----------
function renderArenaLobby() {
    detachRoomListeners();
    STATE.currentRoomId = null;
    STATE.roomData = null;
    STATE.roomShellBuilt = false;
    STATE.roomSig = '';
    STATE.isHolding = false;

    const content = document.getElementById('arena-content');
    if (!content) return;

    content.innerHTML = `
        <div class="arena-scroll">
            <div class="arena-top-bar">
                <button class="arena-btn primary" id="btn-open-create-room">➕ Создать</button>
                <button class="arena-btn" id="btn-refresh-rooms">🔄 Обновить</button>
            </div>
            <div class="arena-rooms-list" id="arena-rooms-list">
                <div class="arena-empty">Загрузка комнат...</div>
            </div>
        </div>`;

    document.getElementById('btn-open-create-room').onclick = () => {
        document.getElementById('create-room-error').textContent = '';
        document.getElementById('room-name-input').value = '';
        document.getElementById('room-bet-input').value = 100;
        document.getElementById('room-max-input').value = 2;
        document.getElementById('create-room-btn').disabled = false;
        openModal('create-room-modal');
    };
    document.getElementById('btn-refresh-rooms').onclick = () => { renderArenaLobby(); showToast('🔄 Список обновлён', 'info', 1200); };

    attachRoomsListener();
}

function attachRoomsListener() {
    detachRoomsListener();
    ARENA.roomsRef = db.ref('rooms').limitToLast(40);
    ARENA.roomsCb = ARENA.roomsRef.on('value', snap => {
        const list = document.getElementById('arena-rooms-list');
        if (!list) return;
        const rooms = [];
        snap.forEach(ch => {
            const r = ch.val();
            if (r && r.state !== 'finished') rooms.push({ id: ch.key, ...r });
        });
        rooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        const badge = document.getElementById('arena-count');
        if (badge) badge.textContent = rooms.length;

        if (!rooms.length) {
            list.innerHTML = `<div class="arena-empty">🏜️ Активных комнат нет.<br>Создайте первую и заберите банк!</div>`;
            return;
        }

        list.innerHTML = '';
        rooms.forEach(room => {
            const count = room.players ? Object.keys(room.players).length : 0;
            const full = count >= (room.maxPlayers || 2);
            const playing = room.state !== 'waiting';
            const card = document.createElement('div');
            card.className = 'arena-room-card';
            card.innerHTML = `
                <div class="arena-room-info">
                    <div class="arena-room-name">${escapeHtml(room.name || 'Комната')}</div>
                    <div class="arena-room-meta">
                        <span>👥 ${count}/${room.maxPlayers || 2}</span>
                        <span>💎 ${fmt(room.bet)}</span>
                        <span>🏆 ${fmt((room.bet || 0) * (room.maxPlayers || 2))}</span>
                        <span>${playing ? '🎮 Идёт бой' : '⏳ Ожидание'}</span>
                    </div>
                </div>
                <button class="arena-room-join" ${(full || playing) ? 'disabled' : ''}>${playing ? 'Идёт' : full ? 'Полная' : 'Войти'}</button>`;
            const btn = card.querySelector('button');
            if (!full && !playing) btn.onclick = () => joinRoom(room.id);
            list.appendChild(card);
        });
    });
}

function detachRoomsListener() {
    if (ARENA.roomsRef && ARENA.roomsCb) ARENA.roomsRef.off('value', ARENA.roomsCb);
    ARENA.roomsRef = null; ARENA.roomsCb = null;
}

// ---------- СОЗДАНИЕ / ВХОД ----------
function createRoom() {
    const err = document.getElementById('create-room-error');
    const btn = document.getElementById('create-room-btn');
    err.textContent = '';

    const name = document.getElementById('room-name-input').value.trim() || ('Арена ' + STATE.nickname);
    const bet = parseInt(document.getElementById('room-bet-input').value, 10);
    const maxP = parseInt(document.getElementById('room-max-input').value, 10);

    if (name.length > 20) { err.textContent = '⚠️ Название: макс. 20 символов'; return; }
    if (containsBadWords(name)) { err.textContent = '🚫 Недопустимое название'; return; }
    if (!bet || bet < 10) { err.textContent = '⚠️ Минимальная ставка 10'; return; }
    if (bet > 100000) { err.textContent = '⚠️ Максимальная ставка 100 000'; return; }
    if (!maxP || maxP < 2 || maxP > 5) { err.textContent = '⚠️ Игроков: от 2 до 5'; return; }
    if (STATE.clicks < bet) { err.textContent = `❌ Нужно ${fmt(bet)} кликов`; return; }
    if (STATE.currentRoomId) { err.textContent = '⚠️ Вы уже в комнате'; return; }

    btn.disabled = true;
    err.textContent = '⏳ Создание...';

    STATE.clicks -= bet;                       // списываем ОДИН раз
    saveLocal(); saveToFirebase(); updateUI();

    const ref = db.ref('rooms').push();
    ref.set({
        name, bet, maxPlayers: maxP,
        creatorId: STATE.userId,
        state: 'waiting',
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastActivity: firebase.database.ServerValue.TIMESTAMP,
        players: {
            [STATE.userId]: { nickname: STATE.nickname, status: 'waiting', joinedAt: nowTs() }
        }
    }).then(() => {
        closeModal('create-room-modal');
        btn.disabled = false;
        showToast('✅ Комната создана! Ждём соперников', 'success');
        enterRoom(ref.key, bet);
    }).catch(() => {
        STATE.clicks += bet; saveLocal(); updateUI();
        btn.disabled = false;
        err.textContent = '❌ Ошибка создания комнаты';
    });
}

function joinRoom(roomId) {
    if (STATE.currentRoomId) { showToast('⚠️ Вы уже в комнате', 'warning'); return; }

    db.ref('rooms/' + roomId).once('value').then(snap => {
        const room = snap.val();
        if (!room) { showToast('❌ Комната не найдена', 'danger'); return; }
        if (room.state !== 'waiting') { showToast('❌ Игра уже началась', 'danger'); return; }
        const count = room.players ? Object.keys(room.players).length : 0;
        if (count >= (room.maxPlayers || 2)) { showToast('❌ Комната заполнена', 'danger'); return; }
        if (STATE.clicks < room.bet) { showToast(`❌ Нужно ${fmt(room.bet)} кликов`, 'danger'); return; }

        STATE.clicks -= room.bet;              // списываем ОДИН раз
        saveLocal(); saveToFirebase(); updateUI();

        db.ref(`rooms/${roomId}/players/${STATE.userId}`).set({
            nickname: STATE.nickname, status: 'waiting', joinedAt: nowTs()
        }).then(() => {
            db.ref(`rooms/${roomId}/lastActivity`).set(firebase.database.ServerValue.TIMESTAMP);
            showToast('✅ Вы вошли в комнату!', 'success');
            sendRoomSystemMsg(roomId, `${STATE.nickname} присоединился`);
            enterRoom(roomId, room.bet);
        }).catch(() => {
            STATE.clicks += room.bet; saveLocal(); saveToFirebase(); updateUI();
            showToast('❌ Ошибка входа', 'danger');
        });
    }).catch(() => showToast('❌ Ошибка сети', 'danger'));
}

// ---------- ВНУТРИ КОМНАТЫ ----------
function enterRoom(roomId, bet) {
    detachRoomsListener();
    STATE.currentRoomId = roomId;
    STATE.roomChat = [];
    STATE.roomSig = '';
    STATE.roomShellBuilt = false;
    STATE.isHolding = false;

    buildRoomShell();
    armDisconnectSafety(bet);

    ARENA.roomRef = db.ref('rooms/' + roomId);
    ARENA.roomCb = ARENA.roomRef.on('value', onRoomValue);

    ARENA.chatRef = db.ref('roomChats/' + roomId).limitToLast(40);
    ARENA.chatCb = ARENA.chatRef.on('child_added', s => {
        const m = s.val(); if (!m) return;
        STATE.roomChat.push(m);
        if (STATE.roomChat.length > 40) STATE.roomChat.shift();
        renderRoomChat();
    });
}

// Страховка от вылета: пока идёт ожидание — вернём ставку и уберём игрока
function armDisconnectSafety(bet) {
    disarmDisconnectSafety();
    if (!STATE.currentRoomId) return;
    ARENA.refundRef = db.ref('inbox/' + STATE.userId).push();
    ARENA.refundRef.onDisconnect().set({
        amount: bet, reason: 'refund', from: 'arena',
        ts: firebase.database.ServerValue.TIMESTAMP
    });
    db.ref(`rooms/${STATE.currentRoomId}/players/${STATE.userId}`).onDisconnect().remove();
}

function disarmDisconnectSafety() {
    if (ARENA.refundRef) {
        ARENA.refundRef.onDisconnect().cancel();
        ARENA.refundRef.remove().catch(() => {});
        ARENA.refundRef = null;
    }
}

// Когда игра стартовала — возврат отменяем, при вылете игрок «отпускает»
function switchDisconnectToLost() {
    if (ARENA.refundRef) {
        ARENA.refundRef.onDisconnect().cancel();
        ARENA.refundRef.remove().catch(() => {});
        ARENA.refundRef = null;
    }
    if (!STATE.currentRoomId) return;
    const pRef = db.ref(`rooms/${STATE.currentRoomId}/players/${STATE.userId}`);
    pRef.onDisconnect().cancel();
    pRef.child('status').onDisconnect().set('lost');
    pRef.child('releasedAt').onDisconnect().set(nowTs());
}

function detachRoomListeners() {
    if (ARENA.roomRef && ARENA.roomCb) ARENA.roomRef.off('value', ARENA.roomCb);
    if (ARENA.chatRef && ARENA.chatCb) ARENA.chatRef.off('child_added', ARENA.chatCb);
    ARENA.roomRef = null; ARENA.roomCb = null;
    ARENA.chatRef = null; ARENA.chatCb = null;
    disarmDisconnectSafety();
    if (STATE.currentRoomId) {
        const pRef = db.ref(`rooms/${STATE.currentRoomId}/players/${STATE.userId}`);
        pRef.onDisconnect().cancel();
        pRef.child('status').onDisconnect().cancel();
        pRef.child('releasedAt').onDisconnect().cancel();
    }
}

function buildRoomShell() {
    const content = document.getElementById('arena-content');
    if (!content) return;
    content.innerHTML = `
        <div class="arena-room-screen">
            <div class="arena-room-header">
                <button class="arena-back-btn" id="room-leave-btn">← Выйти</button>
                <div class="arena-room-title" id="room-title">Комната</div>
                <div class="arena-room-bet-info" id="room-bet">💎 0</div>
            </div>
            <div class="arena-room-body">
                <div class="arena-players-list" id="room-players"></div>
                <div class="arena-game-area" id="room-game"></div>
            </div>
            <div class="room-chat">
                <div class="room-chat-head">💬 Чат комнаты</div>
                <div class="room-chat-messages" id="room-chat-messages"></div>
                <div class="room-chat-input-row">
                    <input class="room-chat-input" id="room-chat-input" maxlength="120" placeholder="Написать соперникам..." autocomplete="off">
                    <button class="room-chat-send" id="room-chat-send">➤</button>
                </div>
            </div>
        </div>`;
    STATE.roomShellBuilt = true;

    document.getElementById('room-leave-btn').onclick = leaveRoom;
    document.getElementById('room-chat-send').onclick = sendRoomChat;
    document.getElementById('room-chat-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') sendRoomChat();
    });
    renderRoomChat();
}

function onRoomValue(snap) {
    const room = snap.val();
    if (!room) {
        showToast('🚪 Комната закрыта', 'info');
        detachRoomListeners();
        renderArenaLobby();
        return;
    }
    STATE.roomData = room;
    const players = room.players || {};

    if (!players[STATE.userId] && room.state !== 'finished') {
        detachRoomListeners();
        renderArenaLobby();
        return;
    }

    if (room.state === 'countdown' || room.state === 'playing') switchDisconnectToLost();

    // Автопереход countdown → playing (страховка на всех клиентах)
    if (room.state === 'countdown' && nowTs() >= (room.countdownEnd || 0)) {
        const iAmHost = room.creatorId === STATE.userId;
        const grace = iAmHost ? 0 : 1200;
        if (nowTs() >= (room.countdownEnd || 0) + grace) tryStartPlaying();
    }

    if (room.state === 'playing') {
        const holders = Object.values(players).filter(p => p.status === 'holding').length;
        if (holders <= 1) tryResolveWinner();
    }

    updateRoomView(room);
}

function updateRoomView(room) {
    if (!STATE.roomShellBuilt) buildRoomShell();

    const players = room.players || {};
    const ids = Object.keys(players);
    const me = players[STATE.userId];
    const isHost = room.creatorId === STATE.userId;
    const pot = (room.bet || 0) * ids.length;

    document.getElementById('room-title').textContent = room.name || 'Комната';
    document.getElementById('room-bet').textContent = '💎 ' + fmt(room.bet);

    // подпись, чтобы не перерисовывать DOM во время удержания
    const sig = room.state + '|' + ids.map(id => id + ':' + players[id].status).join(',') + '|' + (room.winnerId || '');
    if (sig === STATE.roomSig) return;
    STATE.roomSig = sig;

    // --- список игроков ---
    let ph = '';
    ids.forEach(pid => {
        const p = players[pid];
        const isMe = pid === STATE.userId;
        const map = {
            holding: ['status-holding', '🟢 Держит'],
            lost:    ['status-lost', '❌ Отпустил'],
            winner:  ['status-winner', '👑 Победитель'],
            waiting: ['status-waiting', room.state === 'countdown' ? '⏳ Не держит' : '⏳ Готов']
        };
        const [cls, txt] = map[p.status] || map.waiting;
        ph += `
        <div class="arena-player-row ${isMe ? 'is-me' : ''} ${p.status === 'lost' ? 'eliminated' : ''}">
            <div class="arena-player-avatar">${escapeHtml((p.nickname || 'A').charAt(0).toUpperCase())}</div>
            <div class="arena-player-name">${escapeHtml(p.nickname || 'Аноним')}${pid === room.creatorId ? ' 👑' : ''}</div>
            <div class="arena-player-status ${cls}">${txt}</div>
        </div>`;
    });
    document.getElementById('room-players').innerHTML = ph;

    // --- игровая зона ---
    const game = document.getElementById('room-game');
    let gh = '';

    if (room.state === 'waiting') {
        const canStart = isHost && ids.length >= 2;
        gh = `
            <div class="arena-hold-btn waiting">⏳<span class="arena-hold-sub">Ожидание игроков<br>${ids.length}/${room.maxPlayers || 2}</span></div>
            <div class="arena-pot">🏆 Банк: ${fmt(pot)} кликов</div>
            ${isHost
                ? `<button class="arena-start-btn" id="btn-start-game" ${canStart ? '' : 'disabled'}>${canStart ? '🎮 Начать игру!' : '👥 Нужно минимум 2 игрока'}</button>`
                : `<div class="arena-hint muted">Ждём, пока хост начнёт бой...</div>`}
            <div class="arena-hint muted">Правило: кто дольше всех удержит кнопку — забирает весь банк</div>`;
    }
    else if (room.state === 'countdown') {
        gh = `
            <div class="arena-countdown" id="room-countdown">3</div>
            <div class="arena-hold-btn ${me && me.status === 'holding' ? 'holding' : 'ready'}" id="arena-hold-btn">
                ${me && me.status === 'holding' ? '🔒' : '🎯'}
                <span class="arena-hold-sub">${me && me.status === 'holding' ? 'Отлично, держите!' : 'ЗАЖМИТЕ И ДЕРЖИТЕ'}</span>
            </div>
            <div class="arena-hint">${me && me.status === 'holding' ? 'Не отпускайте до конца отсчёта!' : '⚠️ Успейте зажать до старта, иначе поражение!'}</div>`;
    }
    else if (room.state === 'playing') {
        const st = me ? me.status : 'lost';
        if (st === 'holding') {
            gh = `
                <div class="arena-countdown" id="room-timer">0.0с</div>
                <div class="arena-hold-btn holding" id="arena-hold-btn">🔥<span class="arena-hold-sub">ДЕРЖИТЕ!</span></div>
                <div class="arena-hint">Отпустите — проиграете. Банк: ${fmt(pot)} 💎</div>`;
        } else {
            gh = `
                <div class="arena-countdown" id="room-timer">0.0с</div>
                <div class="arena-hold-btn lost">💀<span class="arena-hold-sub">Вы выбыли</span></div>
                <div class="arena-hint muted">Смотрим, кто продержится дольше...</div>`;
        }
    }
    else if (room.state === 'finished') {
        const iWon = room.winnerId === STATE.userId;
        const winnerNick = room.winnerId && players[room.winnerId] ? players[room.winnerId].nickname : null;
        gh = `
            <div class="arena-hold-btn ${iWon ? 'won' : 'lost'}">${iWon ? '👑' : '😢'}
                <span class="arena-hold-sub">${iWon ? 'Вы забрали ' + fmt(pot) + ' 💎' : (winnerNick ? 'Победил ' + escapeHtml(winnerNick) : 'Ничья — ставки возвращены')}</span>
            </div>
            <button class="arena-start-btn" id="btn-back-lobby">← Вернуться в лобби</button>`;
    }

    game.innerHTML = gh;

    const sb = document.getElementById('btn-start-game');
    if (sb) sb.onclick = startArenaGame;
    const bb = document.getElementById('btn-back-lobby');
    if (bb) bb.onclick = () => { detachRoomListeners(); renderArenaLobby(); };
}

// ---------- ТИК (главный фикс таймера) ----------
function arenaTick() {
    const room = STATE.roomData;
    if (!STATE.currentRoomId || !room) return;

    if (room.state === 'countdown') {
        const left = Math.max(0, (room.countdownEnd || 0) - nowTs());
        const el = document.getElementById('room-countdown');
        const sec = Math.ceil(left / 1000);
        if (el) el.textContent = left > 0 ? String(sec) : 'СТАРТ!';
        if (sec !== ARENA.lastTickSecond) {
            ARENA.lastTickSecond = sec;
            if (sec > 0 && sec <= 5) playTickSound(false);
            if (sec === 0) playTickSound(true);
        }
        if (left <= 0) {
            const isHost = room.creatorId === STATE.userId;
            if (nowTs() >= (room.countdownEnd || 0) + (isHost ? 0 : 1300)) tryStartPlaying();
        }
    }
    else if (room.state === 'playing') {
        const el = document.getElementById('room-timer');
        if (el) {
            const t = Math.max(0, (nowTs() - (room.startedAt || nowTs())) / 1000);
            el.textContent = t.toFixed(1) + 'с';
        }
    }
}

function startArenaGame() {
    const id = STATE.currentRoomId;
    if (!id) return;
    const btn = document.getElementById('btn-start-game');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Запуск...'; }
    db.ref('rooms/' + id).update({
        state: 'countdown',
        countdownEnd: nowTs() + 5000,
        lastActivity: firebase.database.ServerValue.TIMESTAMP
    });
    sendRoomSystemMsg(id, 'Бой начинается! Зажимайте кнопку 🔥');
}

function tryStartPlaying() {
    const id = STATE.currentRoomId;
    if (!id) return;
    if (tryStartPlaying._busy) return;
    tryStartPlaying._busy = true;

    db.ref('rooms/' + id).transaction(cur => {
        if (!cur || cur.state !== 'countdown') return;
        if (nowTs() < (cur.countdownEnd || 0)) return;
        cur.state = 'playing';
        cur.startedAt = nowTs();
        const pl = cur.players || {};
        Object.keys(pl).forEach(pid => {
            if (pl[pid].status !== 'holding') { pl[pid].status = 'lost'; pl[pid].releasedAt = nowTs(); }
        });
        cur.players = pl;
        return cur;
    }, () => { tryStartPlaying._busy = false; });
}

function tryResolveWinner() {
    const id = STATE.currentRoomId;
    if (!id) return;
    if (tryResolveWinner._busy) return;
    tryResolveWinner._busy = true;

    db.ref('rooms/' + id).transaction(cur => {
        if (!cur || cur.state !== 'playing') return;
        const pl = cur.players || {};
        const ids = Object.keys(pl);
        const holders = ids.filter(p => pl[p].status === 'holding');
        if (holders.length > 1) return;

        let winner = null;
        if (holders.length === 1) winner = holders[0];
        else {
            let best = -1;
            ids.forEach(p => { const t = pl[p].releasedAt || 0; if (t > best) { best = t; winner = p; } });
            if (best <= 0) winner = null;
        }
        cur.state = 'finished';
        cur.finishedAt = nowTs();
        cur.winnerId = winner || null;
        if (winner && pl[winner]) pl[winner].status = 'winner';
        cur.players = pl;
        return cur;
    }, (err, committed, snap) => {
        tryResolveWinner._busy = false;
        if (err || !committed || !snap) return;
        const room = snap.val();
        if (!room || room.paid) return;
        payoutRoom(id, room);
    });
}

function payoutRoom(roomId, room) {
    db.ref('rooms/' + roomId + '/paid').transaction(v => {
        if (v) return;               // уже выплачено
        return true;
    }, (err, committed) => {
        if (err || !committed) return;
        const players = room.players || {};
        const ids = Object.keys(players);
        const pot = (room.bet || 0) * ids.length;

        if (room.winnerId && players[room.winnerId]) {
            sendToInbox(room.winnerId, pot, 'arena_win', 'arena');
            sendRoomSystemMsg(roomId, `👑 ${players[room.winnerId].nickname} забирает ${fmt(pot)} 💎`);
            if (room.winnerId === STATE.userId) {
                localStorage.setItem('cv_arenawin', '1');
                spawnConfetti('ach-confetti');
            }
        } else {
            ids.forEach(pid => sendToInbox(pid, room.bet || 0, 'refund', 'arena'));
            sendRoomSystemMsg(roomId, '🤝 Ничья — ставки возвращены');
        }
    });
}

// ---------- УДЕРЖАНИЕ ----------
function arenaPressStart() {
    const room = STATE.roomData;
    if (!STATE.currentRoomId || !room) return;
    if (room.state !== 'countdown' && room.state !== 'playing') return;
    const me = (room.players || {})[STATE.userId];
    if (!me || me.status === 'lost' || me.status === 'winner') return;
    if (STATE.isHolding) return;

    STATE.isHolding = true;
    const btn = document.getElementById('arena-hold-btn');
    if (btn) btn.classList.add('holding');
    db.ref(`rooms/${STATE.currentRoomId}/players/${STATE.userId}/status`).set('holding');
    if (navigator.vibrate) navigator.vibrate(15);
}

function arenaPressEnd() {
    if (!STATE.isHolding) return;
    STATE.isHolding = false;
    const room = STATE.roomData;
    const btn = document.getElementById('arena-hold-btn');
    if (btn) btn.classList.remove('holding');
    if (!STATE.currentRoomId || !room) return;

    if (room.state === 'countdown') {
        db.ref(`rooms/${STATE.currentRoomId}/players/${STATE.userId}/status`).set('waiting');
    } else if (room.state === 'playing') {
        db.ref(`rooms/${STATE.currentRoomId}/players/${STATE.userId}`).update({
            status: 'lost', releasedAt: nowTs()
        }).then(() => setTimeout(tryResolveWinner, 250));
        if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
    }
}

function setupArenaGlobalListeners() {
    if (setupArenaGlobalListeners._done) return;
    setupArenaGlobalListeners._done = true;

    const down = e => {
        const t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('#arena-hold-btn')) { e.preventDefault(); getAudioCtx(); arenaPressStart(); }
    };
    document.addEventListener('pointerdown', down, { passive: false });
    document.addEventListener('touchstart', e => {
        const t = e.target;
        if (t && t.closest && t.closest('#arena-hold-btn')) e.preventDefault();
    }, { passive: false });

    document.addEventListener('pointerup', arenaPressEnd);
    document.addEventListener('pointercancel', arenaPressEnd);
    document.addEventListener('mouseleave', arenaPressEnd);
    window.addEventListener('blur', arenaPressEnd);
    document.addEventListener('visibilitychange', () => { if (document.hidden) arenaPressEnd(); });
}

// ---------- ЧАТ КОМНАТЫ ----------
function renderRoomChat() {
    const box = document.getElementById('room-chat-messages');
    if (!box) return;
    if (!STATE.roomChat.length) {
        box.innerHTML = `<div class="room-msg sys">Общайтесь с соперниками 👋</div>`;
        return;
    }
    box.innerHTML = STATE.roomChat.map(m => {
        if (m.sys) return `<div class="room-msg sys">${escapeHtml(censorText(m.text))}</div>`;
        const mine = m.userId === STATE.userId;
        return `<div class="room-msg ${mine ? 'mine' : ''}"><b>${escapeHtml(m.nickname || '?')}:</b> ${escapeHtml(censorText(m.text))}</div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

function sendRoomChat() {
    const input = document.getElementById('room-chat-input');
    if (!input || !STATE.currentRoomId) return;
    const text = input.value.trim();
    if (!text) return;
    if (containsBadWords(text)) { showToast('🚫 Запрещённые слова', 'danger'); input.value = ''; return; }
    const now = Date.now();
    if (now - ARENA.lastChatSend < 900) { showToast('⏳ Слишком часто', 'warning', 1500); return; }
    ARENA.lastChatSend = now;

    db.ref('roomChats/' + STATE.currentRoomId).push({
        userId: STATE.userId,
        nickname: STATE.nickname,
        text: text.substring(0, 120),
        ts: firebase.database.ServerValue.TIMESTAMP
    });
    input.value = '';
}

function sendRoomSystemMsg(roomId, text) {
    if (!roomId) return;
    db.ref('roomChats/' + roomId).push({
        sys: true, text: text, ts: firebase.database.ServerValue.TIMESTAMP
    }).catch(() => {});
}

// ---------- ВЫХОД ----------
function leaveRoom() {
    const id = STATE.currentRoomId;
    if (!id) { renderArenaLobby(); return; }
    const room = STATE.roomData || {};
    const state = room.state;

    const finish = () => { detachRoomListeners(); renderArenaLobby(); };

    if (state === 'waiting') {
        askConfirm('🚪', 'Покинуть комнату?', 'Ставка будет возвращена.', () => {
            disarmDisconnectSafety();
            STATE.clicks += (room.bet || 0);
            saveLocal(); saveToFirebase(); updateUI();
            sendRoomSystemMsg(id, `${STATE.nickname} вышел из комнаты`);

            const isHost = room.creatorId === STATE.userId;
            db.ref(`rooms/${id}/players/${STATE.userId}`).remove().then(() => {
                if (isHost) {
                    db.ref('rooms/' + id).once('value').then(s => {
                        const r = s.val();
                        if (!r) return;
                        const rest = Object.keys(r.players || {});
                        if (!rest.length) { db.ref('rooms/' + id).remove(); db.ref('roomChats/' + id).remove(); }
                        else db.ref('rooms/' + id + '/creatorId').set(rest[0]);   // передаём хоста
                    });
                }
            });
            showToast(`↩️ Ставка ${fmt(room.bet)} возвращена`, 'info');
            finish();
        });
        return;
    }

    if (state === 'countdown' || state === 'playing') {
        askConfirm('⚠️', 'Сдаться?', 'Вы покинете бой и <b>потеряете ставку</b>.', () => {
            STATE.isHolding = false;
            db.ref(`rooms/${id}/players/${STATE.userId}`).update({ status: 'lost', releasedAt: nowTs() })
                .then(() => setTimeout(tryResolveWinner, 250));
            sendRoomSystemMsg(id, `${STATE.nickname} сдался 🏳️`);
            finish();
        });
        return;
    }

    finish();
}

// ---------- ОЧИСТКА КОМНАТ ----------
function cleanupRooms() {
    db.ref('rooms').limitToLast(50).once('value').then(snap => {
        const now = Date.now();
        snap.forEach(ch => {
            const r = ch.val(); if (!r) return;
            const id = ch.key;
            const players = r.players ? Object.keys(r.players).length : 0;
            const age = now - (r.createdAt || now);
            const idle = now - (r.lastActivity || r.createdAt || now);

            if (r.state === 'finished' && now - (r.finishedAt || r.createdAt || now) > 180000) {
                db.ref('rooms/' + id).remove(); db.ref('roomChats/' + id).remove(); return;
            }
            if (players === 0 && age > 20000) {
                db.ref('rooms/' + id).remove(); db.ref('roomChats/' + id).remove(); return;
            }
            if (r.state === 'waiting' && idle > 1800000) {                 // «мёртвая» комната 30 мин
                Object.keys(r.players || {}).forEach(pid => sendToInbox(pid, r.bet || 0, 'refund', 'cleanup'));
                db.ref('rooms/' + id).remove(); db.ref('roomChats/' + id).remove(); return;
            }
            if ((r.state === 'playing' || r.state === 'countdown') && idle > 600000) { // зависший бой 10 мин
                if (!r.paid) Object.keys(r.players || {}).forEach(pid => sendToInbox(pid, r.bet || 0, 'refund', 'cleanup'));
                db.ref('rooms/' + id).remove(); db.ref('roomChats/' + id).remove();
            }
        });
    }).catch(() => {});
}

// ============================================================
// НАВИГАЦИЯ
// ============================================================
const SIDE_TABS = ['leaderboard', 'shop', 'arena', 'clan'];

function switchTab(tabName) {
    const panel = document.getElementById('tab-' + tabName);
    if (!panel) return;

    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active-tab'));
    panel.classList.add('active-tab');

    if (SIDE_TABS.includes(tabName)) {
        SIDE_TABS.forEach(t => {
            const el = document.getElementById('tab-' + t);
            if (el) el.classList.remove('side-active');
        });
        panel.classList.add('side-active');
        document.querySelectorAll('.side-switch-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.tab === tabName));
    }
    document.querySelectorAll('.nav-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === tabName));

    STATE.currentTab = tabName;

    if (tabName === 'chat') {
        STATE.unseenMessages = 0;
        const b = document.getElementById('chat-badge');
        if (b) b.style.display = 'none';
        setTimeout(() => { const c = document.getElementById('chat-messages'); if (c) c.scrollTop = c.scrollHeight; }, 60);
    }
    if (tabName === 'shop') renderShop();
    if (tabName === 'clan') renderClan();
    if (tabName === 'arena' && !STATE.currentRoomId && !ARENA.roomsRef) renderArenaLobby();
}

// ============================================================
// ФОН РЕГИСТРАЦИИ И ЛОГОТИП
// ============================================================
function initRegBackground() {
    const canvas = document.getElementById('reg-bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const ps = [];
    const count = window.innerWidth < 600 ? 45 : 80;
    for (let i = 0; i < count; i++) {
        ps.push({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            r: Math.random() * 2 + 0.5,
            vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
            alpha: Math.random() * 0.5 + 0.1,
            color: Math.random() > 0.5 ? '#7c5cfc' : '#06d6a0'
        });
    }

    (function animate() {
        if (document.getElementById('registration-screen').style.display === 'none') return;
        ctx.fillStyle = 'rgba(6,6,20,0.08)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const p of ps) {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha; ctx.fill();
        }
        ctx.globalAlpha = 0.05; ctx.strokeStyle = '#7c5cfc'; ctx.lineWidth = 0.5;
        for (let i = 0; i < ps.length; i++) {
            for (let j = i + 1; j < ps.length; j++) {
                const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y;
                if (Math.abs(dx) < 100 && Math.abs(dy) < 100) {
                    ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;
        requestAnimationFrame(animate);
    })();
}

function drawLogo(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, cx = w / 2, r = w * 0.38;
    ctx.clearRect(0, 0, w, w);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (Math.PI / 3) * i;
        ctx.lineTo(cx + r * Math.cos(a), cx + r * Math.sin(a));
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, w, w);
    g.addColorStop(0, '#7c5cfc'); g.addColorStop(0.5, '#a78bfa'); g.addColorStop(1, '#06d6a0');
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (Math.PI / 3) * i;
        ctx.lineTo(cx + r * 0.6 * Math.cos(a), cx + r * 0.6 * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
window.addEventListener('load', () => {
    setTimeout(() => {
        const ls = document.getElementById('loading-screen');
        ls.style.transition = 'opacity 0.5s';
        ls.style.opacity = '0';
        setTimeout(() => {
            ls.style.display = 'none';
            if (STATE.nickname && STATE.userId) startGame();
            else {
                document.getElementById('registration-screen').style.display = 'flex';
                initRegBackground();
                drawLogo(document.getElementById('reg-logo'));
            }
        }, 500);
    }, 800);
});

document.addEventListener('DOMContentLoaded', () => {
    const regBtn = document.getElementById('reg-btn');
    if (regBtn) regBtn.addEventListener('click', register);

    const nickInput = document.getElementById('nickname-input');
    if (nickInput) nickInput.addEventListener('keydown', e => { if (e.key === 'Enter') register(); });

    const chatInput = document.getElementById('chat-input');
    if (chatInput) chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

    const chatSend = document.getElementById('chat-send-btn');
    if (chatSend) chatSend.addEventListener('click', sendChat);

    const tagInput = document.getElementById('clan-tag-input');
    if (tagInput) tagInput.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    });
});

// Анти-зум
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());

let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300 && !(e.target && e.target.tagName === 'INPUT')) e.preventDefault();
    lastTouchEnd = now;
}, false);

window.addEventListener('beforeunload', () => {
    saveLocal();
    saveToFirebase();
    if (STATE.userId) db.ref('online/' + STATE.userId).remove();
});
