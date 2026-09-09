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
    level: parseInt(localStorage.getItem('cv_level')) || 1,
    totalClicks: parseInt(localStorage.getItem('cv_total')) || 0,
    streak: parseInt(localStorage.getItem('cv_streak')) || 0,
    lastLoginDate: localStorage.getItem('cv_lastlogin') || '',

    energy: 0,
    maxEnergy: 100,
    energyCost: 1,
    energyRegen: 2, // Фиксировано: 2 энергии в секунду
    clicksPerLevel: 1000,

    multiplier: 1,

    penaltyActive: false,
    penaltyTimer: 0,
    initialPenalty: true,

    cpsHistory: [],
    currentCps: 0,

    comboCount: 0,
    comboTimer: null,
    lastClickTime: 0,
    maxCombo: parseInt(localStorage.getItem('cv_maxcombo')) || 0,

    btnScale: 1,
    particles: [],

    achievements: JSON.parse(localStorage.getItem('cv_achievements') || '[]'),
    audioCtx: null,

    chatInitialized: false,
    currentTab: 'clicker',
    unseenMessages: 0,

    upgrades: JSON.parse(localStorage.getItem('cv_upgrades') || '{}'),

    // Арена
    currentRoomId: null,
    arenaListener: null,
    arenaRoomsListener: null,
    arenaState: 'lobby',
    isHolding: false,
    arenaGameActive: false,

    onlineUsers: {}
};

// ============================================================
// УЛУЧШЕНИЯ (единое меню, цены x10)
// ============================================================
const UPGRADES = [
    {
        id: 'click_multiplier_1',
        name: 'Мощность клика I',
        icon: '💪',
        desc: '+1 очко за каждый клик',
        baseCost: 15000,
        maxLevel: 10,
        effect: (level) => ({ clickPower: level })
    },
    {
        id: 'combo_boost_1',
        name: 'Мастер комбо I',
        icon: '🔥',
        desc: '+15% время на комбо',
        baseCost: 25000,
        maxLevel: 5,
        effect: (level) => ({ comboTime: 0.15 * level })
    },
    {
        id: 'lucky_click_1',
        name: 'Удачливость I',
        icon: '🍀',
        desc: '5% шанс x2 за клик',
        baseCost: 50000,
        maxLevel: 5,
        effect: (level) => ({ luckyChance: 0.05 * level })
    },
    {
        id: 'penalty_reduction_1',
        name: 'Охлаждение I',
        icon: '❄️',
        desc: '-2 сек. перегрева',
        baseCost: 30000,
        maxLevel: 5,
        effect: (level) => ({ penaltyReduction: 2 * level })
    },
    {
        id: 'chat_color_1',
        name: 'Цветной никнейм',
        icon: '🎨',
        desc: 'Уникальный цвет ника в чате',
        baseCost: 100000,
        maxLevel: 1,
        effect: (level) => ({ chatColor: true })
    },
    {
        id: 'chat_badge_1',
        name: 'VIP бейдж',
        icon: '⭐',
        desc: 'VIP статус в чате',
        baseCost: 250000,
        maxLevel: 1,
        effect: (level) => ({ vipBadge: true })
    },
];

if (!STATE.upgrades || Object.keys(STATE.upgrades).length === 0) {
    STATE.upgrades = {};
}
UPGRADES.forEach(upg => {
    if (STATE.upgrades[upg.id] === undefined) STATE.upgrades[upg.id] = 0;
});

// ============================================================
// ФИЛЬТР МАТОВ
// ============================================================
const BAD_WORDS_PATTERNS = [
    /[хx][уy][йиеёяюijею]/gi, /[пp][иieё][зз3][дd][аеёоуыэюяaeiouy]/gi,
    /[бb6][лl][яьъ]/gi, /[еёe][бb6][аaоoуyлlиiтtнnсsкk]/gi, /[сsc][уyu][кkч][аaiи]/gi,
    /[дd][еeёo][рrб][ьъ]?[мm][оo]/gi, /[мm][уyu][дd][аaоoиiлlкk]/gi, /[гg][оo][вv][нnh][оo]/gi,
    /[жzj][оo][пp][аaуyыe]/gi, /[пp][иieё][дd][оoаaеeёо][рr]/gi, /[шш][лl][юуy][хx]/gi,
    /[тt][вv][аa][рr][ьъ]/gi, /[дd][аa][уyu][нnh]/gi, /[лl][оo][хx]/gi, /[дd][еe][бb6][иi][лl]/gi,
    /[иi][дd][иi][оo][тt]/gi, /fuck/gi, /shit/gi, /bitch/gi, /ass\s*hole/gi, /dick/gi,
    /cunt/gi, /nigger/gi, /whore/gi, /bastard/gi, /damn/gi,
];

const BAD_WORDS_EXACT = [
    'хуй','хуя','хуе','хуи','хую','пизда','пизде','пизду','пиздец',
    'блять','бля','блядь','блядина','ебать','ебал','ебло','ебан',
    'сука','суки','сучка','сучара','мудак','мудила','мразь','мрази',
    'гандон','гнида','падла','ублюдок','уебок','уебан','залупа',
    'даун','дебил','дебилы','лох','лохи','шлюха','шалава',
    'говно','говна','жопа','жопу','пидор','пидар','пидорас',
    'нахуй','нахуя','похуй','похуя','охуеть','заебал','заебись',
    'ёбаный','ебаный','ёбаная','пиздато','хуйня','пиздёж',
];

function containsBadWords(text) {
    const lower = text.toLowerCase().trim();
    const stripped = lower.replace(/[\s\-_.*!@#$%^&()0-9]/g, '');
    for (const word of lower.split(/\s+/)) {
        if (BAD_WORDS_EXACT.includes(word.replace(/[^а-яёa-z]/gi, ''))) return true;
    }
    for (const pattern of BAD_WORDS_PATTERNS) {
        if (pattern.test(lower) || pattern.test(stripped)) return true;
    }
    return false;
}

function censorText(text) {
    let result = text;
    for (const pattern of BAD_WORDS_PATTERNS) {
        result = result.replace(pattern, match => '🤬'.repeat(Math.ceil(match.length / 2)));
    }
    for (const word of BAD_WORDS_EXACT) {
        result = result.replace(new RegExp(word, 'gi'), '🤬');
    }
    return result;
}

// ============================================================
// ДОСТИЖЕНИЯ
// ============================================================
const ACHIEVEMENTS_DEF = [
    { id: 'click100', name: 'Новичок', icon: '🐣', desc: '100 кликов', check: () => STATE.clicks >= 100 },
    { id: 'click500', name: 'Начинающий', icon: '👆', desc: '500 кликов', check: () => STATE.clicks >= 500 },
    { id: 'click1000', name: 'Кликер', icon: '✊', desc: '1 000 кликов', check: () => STATE.clicks >= 1000 },
    { id: 'click5000', name: 'Профи', icon: '💪', desc: '5 000 кликов', check: () => STATE.clicks >= 5000 },
    { id: 'click10000', name: 'Мастер', icon: '🏅', desc: '10 000 кликов', check: () => STATE.clicks >= 10000 },
    { id: 'level5', name: 'Ур. 5', icon: '⭐', desc: 'Достигните 5 уровня', check: () => STATE.level >= 5 },
    { id: 'level10', name: 'Ур. 10', icon: '🌟', desc: 'Достигните 10 уровня', check: () => STATE.level >= 10 },
    { id: 'combo20', name: 'Комбо 20', icon: '🔥', desc: 'Наберите комбо 20', check: () => STATE.maxCombo >= 20 },
    { id: 'cps8', name: 'Скорострел', icon: '⚡', desc: '8+ кликов/сек', check: () => STATE.currentCps >= 8 },
];

function checkAchievements() {
    for (const ach of ACHIEVEMENTS_DEF) {
        if (!STATE.achievements.includes(ach.id) && ach.check()) {
            STATE.achievements.push(ach.id);
            localStorage.setItem('cv_achievements', JSON.stringify(STATE.achievements));
            const modal = document.getElementById('achievement-modal');
            document.getElementById('ach-modal-icon').textContent = ach.icon;
            document.getElementById('ach-modal-title').textContent = ach.name;
            document.getElementById('ach-modal-desc').textContent = ach.desc;
            modal.style.display = 'flex';
            spawnConfetti('ach-confetti');
            showToast(`Достижение: ${ach.icon} ${ach.name}`, 'success');
            updateMiniAchievements();
        }
    }
}

function updateMiniAchievements() {
    const container = document.getElementById('mini-achievements');
    if (!container) return;
    container.innerHTML = '';
    STATE.achievements.slice(-5).forEach(achId => {
        const def = ACHIEVEMENTS_DEF.find(a => a.id === achId);
        if (def) container.innerHTML += `<div class="mini-ach">${def.icon} ${def.name}</div>`;
    });
}

// ============================================================
// ШТРАФ
// ============================================================
function activatePenalty() {
    if (STATE.penaltyActive) return;
    STATE.penaltyActive = true;
    const penaltyDuration = 20 - (STATE.upgrades.penalty_reduction_1 || 0) * 2;
    STATE.penaltyTimer = Math.max(5, penaltyDuration);
    STATE.energy = 0;

    document.getElementById('penalty-banner').style.display = 'flex';
    document.getElementById('click-canvas').classList.add('penalty-mode');

    if (!STATE.initialPenalty) {
        showToast('🚫 Перегрев! ' + Math.ceil(STATE.penaltyTimer) + ' сек', 'danger');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
    STATE.initialPenalty = false;
}

function updatePenaltyTimer() {
    if (!STATE.penaltyActive) return;
    STATE.penaltyTimer -= 0.1;
    const el = document.getElementById('penalty-timer');
    if (el) el.textContent = Math.ceil(STATE.penaltyTimer) + 'с';
    STATE.energy = 0;
    if (STATE.penaltyTimer <= 0) {
        STATE.penaltyActive = false;
        document.getElementById('penalty-banner').style.display = 'none';
        document.getElementById('click-canvas').classList.remove('penalty-mode');
        showToast('✅ Перезарядка завершена!', 'success');
    }
}

// ============================================================
// ЗВУКИ И ТОСТЫ
// ============================================================
function getAudioCtx() {
    if (!STATE.audioCtx) STATE.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (STATE.audioCtx.state === 'suspended') STATE.audioCtx.resume();
    return STATE.audioCtx;
}

function playClickSound() {
    try {
        const ctx = getAudioCtx(); const now = ctx.currentTime;
        const osc1 = ctx.createOscillator(); const gain1 = ctx.createGain();
        osc1.connect(gain1); gain1.connect(ctx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(800 + STATE.comboCount * 15, now);
        osc1.frequency.exponentialRampToValueAtTime(400, now + 0.06);
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc1.start(now); osc1.stop(now + 0.06);
    } catch(e) {}
}

function playBonusSound() {
    try {
        const ctx = getAudioCtx(); const now = ctx.currentTime;
        [523, 659, 784, 1047].forEach((freq, i) => {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now + i * 0.1);
            gain.gain.setValueAtTime(0.15, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
            osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.3);
        });
    } catch(e) {}
}

function playPenaltySound() {
    try {
        const ctx = getAudioCtx(); const now = ctx.currentTime;
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    } catch(e) {}
}

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', warning: '⚠️', danger: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, duration);
}

function spawnConfetti(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#7c5cfc', '#06d6a0', '#f72585', '#ffd700', '#ff6b6b', '#4ecdc4'];
    for (let i = 0; i < 30; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.top = -10 + 'px';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = Math.random() * 0.5 + 's';
        piece.style.animationDuration = (1.5 + Math.random()) + 's';
        piece.style.transform = `rotate(${Math.random() * 360}deg)`;
        container.appendChild(piece);
    }
}

// ============================================================
// МОДАЛКИ (СМЕНА НИКА)
// ============================================================
function showChatRules() { document.getElementById('rules-modal').style.display = 'flex'; }

function showProfileModal() {
    document.getElementById('profile-modal-nick').textContent = STATE.nickname;
    document.getElementById('new-nick-input').value = '';
    document.getElementById('nick-change-error').textContent = '';
    document.getElementById('profile-modal').style.display = 'flex';
}

function changeNickname() {
    const input = document.getElementById('new-nick-input');
    const nick = input.value.trim();
    const err = document.getElementById('nick-change-error');

    if (nick.length < 2) { err.textContent = '⚠️ Минимум 2 символа'; return; }
    if (nick.length > 15) { err.textContent = '⚠️ Максимум 15 символов'; return; }
    if (containsBadWords(nick)) { err.textContent = '🚫 Недопустимое имя'; return; }
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9_\- ]+$/.test(nick)) { err.textContent = '⚠️ Только буквы, цифры, _-'; return; }
    if (STATE.clicks < 10000) { err.textContent = '❌ Нужно минимум 10 000 кликов'; return; }

    STATE.clicks -= 10000;
    STATE.nickname = nick;
    localStorage.setItem('cv_nick', STATE.nickname);

    document.getElementById('header-nickname').textContent = STATE.nickname;
    document.getElementById('header-avatar').textContent = STATE.nickname.charAt(0).toUpperCase();
    document.getElementById('profile-modal-nick').textContent = STATE.nickname;

    saveLocal(); saveToFirebase(); updateUI();
    document.getElementById('profile-modal').style.display = 'none';
    showToast('✅ Никнейм изменён на «' + nick + '»', 'success');
}

function chatScrollUp() { document.getElementById('chat-messages').scrollBy({ top: -150, behavior: 'smooth' }); }
function chatScrollDown() { document.getElementById('chat-messages').scrollBy({ top: 150, behavior: 'smooth' }); }

// ============================================================
// ЗАПУСК ИГРЫ
// ============================================================
function register() {
    const nick = document.getElementById('nickname-input').value.trim();
    const err = document.getElementById('reg-error');

    if (nick.length < 2) { err.textContent = '⚠️ Минимум 2 символа'; return; }
    if (nick.length > 15) { err.textContent = '⚠️ Максимум 15 символов'; return; }
    if (containsBadWords(nick)) { err.textContent = '🚫 Недопустимое имя'; return; }

    document.getElementById('reg-btn').innerHTML = '<span class="btn-text">Подключение...</span>';
    if (!STATE.userId) STATE.userId = 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    STATE.nickname = nick;
    localStorage.setItem('cv_uid', STATE.userId);
    localStorage.setItem('cv_nick', STATE.nickname);

    db.ref('users/' + STATE.userId).set({
        nickname: STATE.nickname, clicks: STATE.clicks, level: STATE.level, lastSeen: Date.now()
    }).then(() => startGame()).catch(() => {
        err.textContent = '❌ Ошибка подключения';
        document.getElementById('reg-btn').innerHTML = '<span class="btn-text">Начать игру</span><span class="btn-icon">→</span>';
    });
}

function startGame() {
    document.getElementById('registration-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
    document.getElementById('header-nickname').textContent = STATE.nickname;
    document.getElementById('header-level-badge').textContent = 'Ур. ' + STATE.level;
    document.getElementById('streak-display').textContent = STATE.streak;
    document.getElementById('header-avatar').textContent = STATE.nickname.charAt(0).toUpperCase();

    drawLogo(document.getElementById('header-logo'));

    if (STATE.userId && STATE.nickname) {
        db.ref('users/' + STATE.userId).update({
            nickname: STATE.nickname, clicks: STATE.clicks, level: STATE.level, lastSeen: Date.now()
        });
    }

    updateUI(); drawClickButton(); updateAndDrawParticles(); setupClicker();
    updateMiniAchievements(); checkDailyStreak(); setupOnlineCounter();
    activatePenalty();

    // Главный цикл: +2 энергии в секунду
    setInterval(() => {
        if (STATE.penaltyActive) { updatePenaltyTimer(); updateUI(); return; }
        if (STATE.energy < STATE.maxEnergy) {
            STATE.energy = Math.min(STATE.maxEnergy, STATE.energy + 0.2); // 0.2 * 10 раз в сек = 2
        }
        updateUI();
    }, 100);

    setInterval(updateCPS, 200);
    setInterval(() => { saveToFirebase(); saveLocal(); }, 5000);
    setInterval(checkAchievements, 2000);

    listenLeaderboard();
    listenChat();
    renderShop();
    
    // ВАЖНОЕ ИСПРАВЛЕНИЕ: Отрисовываем Арену при старте игры!
    renderArenaLobby(); 
}

function saveLocal() {
    localStorage.setItem('cv_clicks', STATE.clicks);
    localStorage.setItem('cv_level', STATE.level);
    localStorage.setItem('cv_total', STATE.totalClicks);
    localStorage.setItem('cv_upgrades', JSON.stringify(STATE.upgrades));
}

function saveToFirebase() {
    if (!STATE.userId || !STATE.nickname) return;
    db.ref('users/' + STATE.userId).set({
        nickname: STATE.nickname, clicks: STATE.clicks, level: STATE.level, lastSeen: Date.now()
    }).catch(() => {});
}

// ============================================================
// КЛИКЕР
// ============================================================
function setupClicker() {
    const cvs = document.getElementById('click-canvas');
    const handleClick = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (STATE.penaltyActive) { playPenaltySound(); return; }

        if (STATE.energy < STATE.energyCost) { activatePenalty(); playPenaltySound(); return; }
        STATE.energy -= STATE.energyCost;
        if (STATE.energy <= 0) activatePenalty();

        let points = 1 + (STATE.upgrades.click_multiplier_1 || 0);
        if (STATE.upgrades.lucky_click_1 && Math.random() < (STATE.upgrades.lucky_click_1 * 0.05)) {
            points *= 2; showToast('🍀 Удачный клик x2!', 'success', 1500);
        }

        STATE.clicks += points;
        STATE.totalClicks += points;
        STATE.level = Math.floor(STATE.clicks / STATE.clicksPerLevel) + 1;
        STATE.cpsHistory.push(Date.now());
        
        updateCombo();

        STATE.btnScale = 0.88; setTimeout(() => STATE.btnScale = 1, 90);
        playClickSound();

        const touch = e.touches ? e.touches[0] : e;
        const rect = cvs.getBoundingClientRect();
        spawnParticles((touch.clientX - rect.left) / rect.width * (rect.width + 100) - 50, (touch.clientY - rect.top) / rect.height * (rect.height + 100) - 50, 8);

        const fb = document.createElement('div');
        fb.className = 'click-feedback'; fb.textContent = '+' + points;
        fb.style.left = (touch.clientX - 15) + 'px'; fb.style.top = (touch.clientY - 25) + 'px';
        document.body.appendChild(fb); setTimeout(() => fb.remove(), 700);

        updateUI();
    };
    cvs.addEventListener('mousedown', handleClick);
    cvs.addEventListener('touchstart', handleClick, { passive: false });
    cvs.addEventListener('contextmenu', e => e.preventDefault());
}

function updateCombo() {
    const now = Date.now();
    const comboTime = 500 * (1 + (STATE.upgrades.combo_boost_1 || 0) * 0.15);
    if (now - STATE.lastClickTime < comboTime) {
        STATE.comboCount++;
        if (STATE.comboCount > STATE.maxCombo) { STATE.maxCombo = STATE.comboCount; localStorage.setItem('cv_maxcombo', STATE.maxCombo); }
        if (STATE.comboCount >= 5 && STATE.comboCount % 5 === 0) {
            playComboSound(STATE.comboCount);
            removeComboIndicator();
            const el = document.createElement('div'); el.className = 'combo-display'; el.id = 'combo-indicator';
            el.textContent = `🔥 COMBO x${STATE.comboCount}`;
            document.getElementById('clicker-area').appendChild(el);
        }
    } else { STATE.comboCount = 1; }
    STATE.lastClickTime = now;
    clearTimeout(STATE.comboTimer);
    STATE.comboTimer = setTimeout(() => { STATE.comboCount = 0; removeComboIndicator(); }, 1500);
}

function removeComboIndicator() { const el = document.getElementById('combo-indicator'); if (el) el.remove(); }

function updateCPS() {
    const now = Date.now();
    STATE.cpsHistory = STATE.cpsHistory.filter(t => now - t < 1000);
    STATE.currentCps = STATE.cpsHistory.length;
    const el = document.getElementById('cps-display'); if (el) el.textContent = STATE.currentCps;
}

// ============================================================
// UI И РЕНДЕР
// ============================================================
function updateUI() {
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('clicks-display', STATE.clicks.toLocaleString('ru-RU'));
    setTxt('level-display', STATE.level);
    setTxt('header-level-badge', 'Ур. ' + STATE.level);
    setTxt('energy-text', Math.floor(STATE.energy) + ' / ' + STATE.maxEnergy);
    setTxt('level-progress-label', `${(STATE.clicks % STATE.clicksPerLevel).toLocaleString('ru-RU')} / ${STATE.clicksPerLevel.toLocaleString('ru-RU')}`);
    setTxt('shop-balance', STATE.clicks.toLocaleString('ru-RU'));

    const eBar = document.getElementById('energy-bar');
    if (eBar) {
        eBar.style.width = (STATE.energy / STATE.maxEnergy * 100) + '%';
        eBar.classList.remove('danger', 'penalty');
        if (STATE.penaltyActive) eBar.classList.add('penalty'); else if (STATE.energy < 20) eBar.classList.add('danger');
    }
    const lBar = document.getElementById('level-bar');
    if (lBar) lBar.style.width = ((STATE.clicks % STATE.clicksPerLevel) / STATE.clicksPerLevel * 100) + '%';
}

function drawClickButton() {
    const canvas = document.getElementById('click-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2; const r = canvas.width * 0.38 * STATE.btnScale;
    ctx.clearRect(0, 0, canvas.width, canvas.width);

    ctx.beginPath(); ctx.arc(cx, cx, r + 30, 0, Math.PI * 2);
    ctx.fillStyle = STATE.penaltyActive ? 'rgba(255, 71, 87, 0.15)' : `hsla(${(Date.now() / 30) % 360}, 70%, 60%, 0.08)`;
    ctx.fill();

    ctx.beginPath(); ctx.arc(cx, cx + 6, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();

    ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2);
    let grad = ctx.createRadialGradient(cx - r * 0.3, cx - r * 0.3, 0, cx, cx, r);
    if (STATE.penaltyActive) { grad.addColorStop(0, '#ff6b6b'); grad.addColorStop(1, '#c0392b'); } 
    else { grad.addColorStop(0, '#a78bfa'); grad.addColorStop(1, '#5a3ce0'); }
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath(); ctx.arc(cx - r * 0.15, cx - r * 0.2, r * 0.55, 0, Math.PI * 2);
    const hlGrad = ctx.createRadialGradient(cx - r * 0.15, cx - r * 0.3, 0, cx - r * 0.15, cx - r * 0.2, r * 0.55);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.2)'); hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad; ctx.fill();

    const energyPct = STATE.energy / STATE.maxEnergy;
    ctx.beginPath(); ctx.arc(cx, cx, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * energyPct);
    ctx.strokeStyle = STATE.penaltyActive ? '#ff4757' : energyPct > 0.3 ? '#06d6a0' : energyPct > 0.1 ? '#ffa502' : '#ff4757';
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();

    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (STATE.penaltyActive) {
        ctx.font = `800 ${canvas.width * 0.07}px 'Inter'`; ctx.fillText('ПЕРЕГРЕВ', cx, cx - 8);
        ctx.font = `900 ${canvas.width * 0.12}px 'Inter'`; ctx.fillText(Math.ceil(STATE.penaltyTimer) + 'с', cx, cx + 20);
    } else {
        ctx.font = `900 ${canvas.width * 0.13}px 'Inter'`; ctx.fillText('КЛИК', cx, cx);
    }
    requestAnimationFrame(drawClickButton);
}

// ============================================================
// ОНЛАЙН, ЛИДЕРЫ И ЧАТ
// ============================================================
function checkDailyStreak() {
    const today = new Date().toISOString().split('T')[0];
    if (STATE.lastLoginDate === today) return;
    if (STATE.lastLoginDate) {
        const diff = Math.floor((new Date(today) - new Date(STATE.lastLoginDate)) / 86400000);
        if (diff === 1) { STATE.streak++; showToast(`🔥 Серия: ${STATE.streak} дней!`, 'success'); }
        else if (diff > 1) { STATE.streak = 1; showToast('📅 Серия сброшена', 'warning'); }
    } else { STATE.streak = 1; }
    STATE.lastLoginDate = today; localStorage.setItem('cv_streak', STATE.streak); localStorage.setItem('cv_lastlogin', today);
    document.getElementById('streak-display').textContent = STATE.streak;
}

function setupOnlineCounter() {
    if (!STATE.userId) return;
    const onlineRef = db.ref('online/' + STATE.userId);
    db.ref('.info/connected').on('value', snap => {
        if (snap.val() === true) {
            onlineRef.set({ nickname: STATE.nickname, ts: firebase.database.ServerValue.TIMESTAMP });
            onlineRef.onDisconnect().remove();
        }
    });
    db.ref('online').on('value', snap => {
        STATE.onlineUsers = {}; snap.forEach(child => { STATE.onlineUsers[child.key] = true; });
        const el = document.getElementById('online-num'); if (el) el.textContent = Object.keys(STATE.onlineUsers).length;
    });
}

function listenLeaderboard() {
    db.ref('users').orderByChild('clicks').limitToLast(20).on('value', snap => {
        const list = document.getElementById('leaderboard-list');
        const users = []; snap.forEach(child => { const d = child.val(); if (d && d.nickname) users.push({ id: child.key, ...d }); });
        users.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
        const top = users.slice(0, 15);
        list.innerHTML = '';
        if (top.length === 0) { list.innerHTML = '<div class="lb-empty">Пока никого нет</div>'; return; }
        const countBadge = document.getElementById('lb-count'); if (countBadge) countBadge.textContent = top.length;

        top.forEach((u, i) => {
            const rank = i + 1; const isMe = u.id === STATE.userId; const isOnline = !!STATE.onlineUsers[u.id];
            let rc = 'rank-other'; if (rank === 1) rc = 'rank-1'; else if (rank === 2) rc = 'rank-2'; else if (rank === 3) rc = 'rank-3';
            const item = document.createElement('div'); item.className = `lb-item ${isMe ? 'is-me' : ''}`;
            item.innerHTML = `
                <div class="lb-rank ${rc}">${rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : rank}</div>
                <div class="lb-online-dot ${isOnline ? 'online' : 'offline'}"></div>
                <div class="lb-avatar">${(u.nickname || 'A').charAt(0).toUpperCase()}</div>
                <div class="lb-info">
                    <div class="lb-name">${escapeHtml(u.nickname)}</div>
                    <div class="lb-clicks">${(u.clicks || 0).toLocaleString('ru-RU')} кликов</div>
                </div>
                <div class="lb-level-badge">Ур. ${u.level || 1}</div>
            `;
            list.appendChild(item);
        });
    });
}

function listenChat() {
    if (STATE.chatInitialized) return; STATE.chatInitialized = true;
    db.ref('chat').limitToLast(50).on('child_added', snap => {
        const m = snap.val(); if (!m || !m.text) return;
        const container = document.getElementById('chat-messages'); const isMe = m.userId === STATE.userId;
        const msgEl = document.createElement('div'); msgEl.className = `chat-msg ${isMe ? 'my-msg' : ''}`;
        const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';

        let nameStyle = ''; if (m.chatColor) nameStyle = `style="color: hsl(${Math.abs(m.nickname.length * 100) % 360}, 80%, 65%)"`;
        msgEl.innerHTML = `
            <div class="chat-msg-header">
                <span class="chat-msg-name" ${nameStyle}>${m.vipBadge ? '⭐ ' : ''}${escapeHtml(m.nickname || 'Аноним')}</span>
                <span class="chat-msg-level">Ур.${m.level || 1}</span>
                <span class="chat-msg-time">${time}</span>
            </div>
            <div class="chat-msg-text">${escapeHtml(censorText(m.text.substring(0, 200)))}</div>
        `;
        container.appendChild(msgEl);
        if (container.scrollHeight - container.scrollTop - container.clientHeight < 100 || isMe) container.scrollTop = container.scrollHeight;
        if (!isMe && STATE.currentTab !== 'chat') {
            STATE.unseenMessages++; const badge = document.getElementById('chat-badge');
            if (badge) { badge.style.display = 'flex'; badge.textContent = STATE.unseenMessages > 9 ? '9+' : STATE.unseenMessages; }
        }
    });
}

function sendChat() {
    const input = document.getElementById('chat-input'); const text = input.value.trim();
    if (!text) return; if (text.length > 200) { showToast('Макс. 200 символов', 'warning'); return; }
    if (containsBadWords(text)) { showToast('🚫 Запрещённые слова', 'danger'); input.value = ''; return; }
    const now = Date.now(); if (!sendChat._last) sendChat._last = 0;
    if (now - sendChat._last < 1500) { showToast('⏳ Подождите', 'warning'); return; }
    sendChat._last = now;

    db.ref('chat').push({
        nickname: STATE.nickname, userId: STATE.userId, text: text, level: STATE.level,
        timestamp: firebase.database.ServerValue.TIMESTAMP, chatColor: (STATE.upgrades.chat_color_1 || 0) > 0, vipBadge: (STATE.upgrades.chat_badge_1 || 0) > 0
    });
    input.value = '';
}

// ============================================================
// МАГАЗИН И НАВИГАЦИЯ
// ============================================================
function renderShop() {
    const container = document.getElementById('shop-items'); if (!container) return;
    container.innerHTML = '';
    UPGRADES.forEach(item => {
        const currentLevel = STATE.upgrades[item.id] || 0; const isMax = currentLevel >= item.maxLevel;
        const cost = Math.floor(item.baseCost * Math.pow(1.5, currentLevel));
        const div = document.createElement('div'); div.className = `shop-item ${isMax ? 'max-level' : ''}`;
        div.innerHTML = `
            <div class="shop-item-header">
                <div class="shop-item-icon">${item.icon}</div>
                <div class="shop-item-info">
                    <div class="shop-item-name">${item.name}</div><div class="shop-item-level">Ур. ${currentLevel} / ${item.maxLevel}</div>
                </div>
            </div>
            <div class="shop-item-desc">${item.desc}</div>
            <div class="shop-item-footer">
                ${isMax ? '<div class="shop-item-max">⭐ МАКС</div>' : `<div class="shop-item-price">💎 ${cost.toLocaleString('ru-RU')}</div>
                       <button class="shop-item-buy" ${STATE.clicks < cost ? 'disabled' : ''} onclick="buyUpgrade('${item.id}')">Купить</button>`}
            </div>
        `;
        container.appendChild(div);
    });
}

function buyUpgrade(upgradeId) {
    const upgrade = UPGRADES.find(u => u.id === upgradeId); if (!upgrade) return;
    const currentLevel = STATE.upgrades[upgradeId] || 0;
    const cost = Math.floor(upgrade.baseCost * Math.pow(1.5, currentLevel));
    if (STATE.clicks < cost) { showToast('❌ Мало кликов', 'danger'); return; }
    STATE.clicks -= cost; STATE.upgrades[upgradeId] = currentLevel + 1;
    saveLocal(); saveToFirebase(); updateUI(); renderShop();
    showToast(`✅ ${upgrade.name} (Ур. ${STATE.upgrades[upgradeId]})`, 'success'); playBonusSound();
}

function switchTab(tabName, btnElement) {
    // Убираем жесткую привязку к экрану, чтобы на ПК тоже работало корректно
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active-tab'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active-tab');
    if (btnElement) btnElement.classList.add('active');
    STATE.currentTab = tabName;

    if (tabName === 'chat') {
        STATE.unseenMessages = 0; document.getElementById('chat-badge').style.display = 'none';
        setTimeout(() => { const c = document.getElementById('chat-messages'); c.scrollTop = c.scrollHeight; }, 50);
    }
    if (tabName === 'shop') renderShop();
    if (tabName === 'arena') renderArenaLobby();
}

// ============================================================
// АРЕНА (МУЛЬТИПЛЕЕР)
// ============================================================
function renderArenaLobby() {
    if (STATE.currentRoomId) { renderArenaRoom(); return; }
    STATE.arenaState = 'lobby';

    const content = document.getElementById('arena-content');
    content.innerHTML = `
        <div class="arena-top-bar">
            <button class="arena-btn" onclick="showCreateRoomModal()">➕ Создать комнату</button>
            <button class="arena-btn" onclick="renderArenaLobby()">🔄 Обновить</button>
        </div>
        <div class="arena-rooms-list" id="arena-rooms-list"><div class="arena-empty">Загрузка комнат...</div></div>
    `;

    if (STATE.arenaRoomsListener) db.ref('rooms').off('value', STATE.arenaRoomsListener);
    STATE.arenaRoomsListener = db.ref('rooms').on('value', snap => {
        const list = document.getElementById('arena-rooms-list'); if (!list) return;
        list.innerHTML = '';
        if (!snap.exists()) { list.innerHTML = '<div class="arena-empty">Нет активных комнат. Создайте первую!</div>'; return; }
        
        let hasRooms = false;
        snap.forEach(child => {
            const room = child.val(); if (!room || room.state === 'finished') return;
            hasRooms = true;
            const pCount = room.players ? Object.keys(room.players).length : 0;
            const isFull = pCount >= (room.maxPlayers || 2);
            
            const card = document.createElement('div'); card.className = 'arena-room-card';
            card.innerHTML = `
                <div class="arena-room-info">
                    <div class="arena-room-name">${escapeHtml(room.name || 'Комната')}</div>
                    <div class="arena-room-meta"><span>👥 ${pCount}/${room.maxPlayers || 2}</span><span>💎 ${(room.bet || 0).toLocaleString('ru-RU')}</span><span>${room.state === 'playing' ? '🎮 Играют' : '⏳ Ожидание'}</span></div>
                </div>
                <button class="arena-room-join" ${(isFull || room.state === 'playing') ? 'disabled' : ''} onclick="joinRoom('${child.key}')">${room.state === 'playing' ? 'Идёт' : isFull ? 'Полная' : 'Войти'}</button>
            `;
            list.appendChild(card);
        });
        if (!hasRooms) list.innerHTML = '<div class="arena-empty">Нет активных комнат. Создайте первую!</div>';
    });
}

function showCreateRoomModal() {
    document.getElementById('room-name-input').value = '';
    document.getElementById('room-bet-input').value = '100';
    document.getElementById('create-room-error').textContent = '';
    document.getElementById('create-room-modal').style.display = 'flex';
}

function createRoom() {
    const name = document.getElementById('room-name-input').value.trim() || 'Арена';
    const bet = parseInt(document.getElementById('room-bet-input').value) || 100;
    const maxP = parseInt(document.getElementById('room-max-input').value) || 2;
    const err = document.getElementById('create-room-error');

    if (name.length > 20) { err.textContent = '⚠️ Макс. 20 символов'; return; }
    if (containsBadWords(name)) { err.textContent = '🚫 Недопустимое название'; return; }
    if (bet < 10 || bet > 100000) { err.textContent = '⚠️ Ставка от 10 до 100 000'; return; }
    if (STATE.clicks < bet) { err.textContent = '❌ Мало кликов! Нужно ' + bet; return; }

    STATE.clicks -= bet; saveLocal(); saveToFirebase(); updateUI();

    const roomRef = db.ref('rooms').push();
    const roomId = roomRef.key;

    roomRef.set({
        name: name, bet: bet, maxPlayers: maxP, creatorId: STATE.userId, state: 'waiting', createdAt: firebase.database.ServerValue.TIMESTAMP,
        players: { [STATE.userId]: { nickname: STATE.nickname, userId: STATE.userId, status: 'waiting' } }
    }).then(() => {
        STATE.currentRoomId = roomId;
        document.getElementById('create-room-modal').style.display = 'none';
        showToast('✅ Комната создана!', 'success'); renderArenaRoom();
    }).catch(() => {
        STATE.clicks += bet; saveLocal(); saveToFirebase(); updateUI(); err.textContent = '❌ Ошибка создания';
    });
}

function joinRoom(roomId) {
    db.ref('rooms/' + roomId).once('value').then(snap => {
        const room = snap.val();
        if (!room) { showToast('❌ Комната не найдена', 'danger'); return; }
        if (room.state !== 'waiting') { showToast('❌ Игра уже началась', 'danger'); return; }
        if (Object.keys(room.players || {}).length >= (room.maxPlayers || 2)) { showToast('❌ Комната полная', 'danger'); return; }
        if (STATE.clicks < room.bet) { showToast('❌ Мало кликов!', 'danger'); return; }

        STATE.clicks -= room.bet; saveLocal(); saveToFirebase(); updateUI();
        db.ref('rooms/' + roomId + '/players/' + STATE.userId).set({
            nickname: STATE.nickname, userId: STATE.userId, status: 'waiting'
        }).then(() => {
            STATE.currentRoomId = roomId; showToast('✅ Вы вошли в комнату!', 'success'); renderArenaRoom();
        }).catch(() => {
            STATE.clicks += room.bet; saveLocal(); saveToFirebase(); updateUI(); showToast('❌ Ошибка входа', 'danger');
        });
    });
}

function renderArenaRoom() {
    STATE.arenaState = 'room';
    const content = document.getElementById('arena-content');
    if (STATE.arenaListener) db.ref('rooms/' + STATE.currentRoomId).off('value', STATE.arenaListener);

    STATE.arenaListener = db.ref('rooms/' + STATE.currentRoomId).on('value', snap => {
        const room = snap.val();
        if (!room) { STATE.currentRoomId = null; renderArenaLobby(); return; }

        const players = room.players || {}; const playerIds = Object.keys(players);
        const myData = players[STATE.userId];
        if (!myData && room.state !== 'finished') { STATE.currentRoomId = null; renderArenaLobby(); return; }

        if (room.state === 'finished') {
            const winnerId = Object.keys(players).find(pid => players[pid].status === 'winner');
            const totalPot = (room.bet || 0) * playerIds.length;
            const isWinner = winnerId === STATE.userId;
            content.innerHTML = `
                <div class="arena-room-screen">
                    <div class="arena-room-header"><button class="arena-back-btn" onclick="leaveRoom()">← Выйти</button><div class="arena-room-title">Игра окончена</div></div>
                    <div class="arena-game-area">
                        <div class="arena-hold-btn ${isWinner ? 'won' : 'lost'}">
                            <span>${isWinner ? '👑' : '😢'}</span><span class="arena-hold-sub">${isWinner ? 'Вы выиграли ' + totalPot : 'Вы проиграли'}</span>
                        </div>
                        <button class="arena-start-btn" onclick="leaveRoom()">Вернуться в лобби</button>
                    </div>
                </div>
            `;
            return;
        }

        let playersHTML = '';
        playerIds.forEach(pid => {
            const p = players[pid]; const isMe = pid === STATE.userId;
            const statusClass = p.status === 'holding' ? 'status-holding' : p.status === 'lost' ? 'status-lost' : 'status-waiting';
            const statusText = p.status === 'holding' ? '🟢 Держит' : p.status === 'lost' ? '❌ Отпустил' : '⏳ Ждёт';
            playersHTML += `<div class="arena-player-row ${isMe ? 'is-me' : ''} ${p.status === 'lost' ? 'eliminated' : ''}">
                <div class="arena-player-avatar">${(p.nickname || 'A').charAt(0).toUpperCase()}</div><div class="arena-player-name">${escapeHtml(p.nickname || 'Аноним')}</div>
                <div class="arena-player-status ${statusClass}">${statusText}</div></div>`;
        });

        let gameAreaHTML = '';
        if (room.state === 'waiting') {
            const canStart = room.creatorId === STATE.userId && playerIds.length >= 2;
            gameAreaHTML = `<div class="arena-game-area"><div class="arena-hold-btn waiting"><span>⏳</span><span class="arena-hold-sub">Ожидание</span></div>
                ${room.creatorId === STATE.userId ? `<button class="arena-start-btn" ${!canStart ? 'disabled' : ''} onclick="startArenaGame()">Начать игру</button>` : 'Ожидание хоста...'}</div>`;
        } else if (room.state === 'countdown') {
            const rem = Math.max(0, Math.ceil((room.countdownEnd - Date.now()) / 1000));
            gameAreaHTML = `<div class="arena-game-area"><div class="arena-timer">Начало через ${rem}...</div>
                <div class="arena-hold-btn ready"><span>🎯</span><span class="arena-hold-sub">Готовьтесь!</span></div></div>`;
            if (rem <= 0 && room.creatorId === STATE.userId) {
                db.ref('rooms/' + STATE.currentRoomId + '/state').set('playing');
                playerIds.forEach(pid => db.ref('rooms/' + STATE.currentRoomId + '/players/' + pid + '/status').set('holding'));
            }
        } else if (room.state === 'playing') {
            const st = myData ? myData.status : 'lost';
            gameAreaHTML = `<div class="arena-game-area">
                <div class="arena-hold-btn ${st === 'lost' ? 'lost' : 'holding'}" id="arena-hold-btn" ${st === 'holding' ? 'onmousedown="arenaHoldStart()" ontouchstart="arenaHoldStart()"' : ''}>
                    <span>${st === 'lost' ? '❌' : '🔵'}</span><span class="arena-hold-sub">${st === 'lost' ? 'Проиграл' : 'ДЕРЖИТЕ!'}</span>
                </div></div>`;
        }

        content.innerHTML = `<div class="arena-room-screen">
            <div class="arena-room-header"><button class="arena-back-btn" onclick="leaveRoom()">← Выйти</button><div class="arena-room-title">${escapeHtml(room.name)}</div><div class="arena-room-bet-info">💎 ${room.bet}</div></div>
            <div class="arena-players-list">${playersHTML}</div>${gameAreaHTML}
        </div>`;

        if (room.state === 'playing' && myData && myData.status === 'holding') setTimeout(setupHoldListeners, 50);
    });
}

function startArenaGame() {
    if (!STATE.currentRoomId) return;
    db.ref('rooms/' + STATE.currentRoomId).update({ state: 'countdown', countdownEnd: Date.now() + 3000 });
}

function setupHoldListeners() {
    const release = () => { arenaRelease(); };
    document.addEventListener('mouseup', release, { once: true });
    document.addEventListener('touchend', release, { once: true });
    window.addEventListener('blur', release, { once: true });
}

function arenaHoldStart() { STATE.isHolding = true; }

function arenaRelease() {
    if (!STATE.currentRoomId) return;
    db.ref('rooms/' + STATE.currentRoomId + '/players/' + STATE.userId + '/status').set('lost');
    setTimeout(() => checkArenaWinner(), 300);
}

function checkArenaWinner() {
    if (!STATE.currentRoomId) return;
    db.ref('rooms/' + STATE.currentRoomId).once('value').then(snap => {
        const room = snap.val(); if (!room || room.state !== 'playing') return;
        const players = room.players || {};
        const holding = Object.keys(players).filter(pid => players[pid].status === 'holding');

        if (holding.length <= 1) {
            const winnerId = holding.length === 1 ? holding[0] : null;
            const totalPot = (room.bet || 0) * Object.keys(players).length;

            const updates = { state: 'finished' };
            if (winnerId) updates['players/' + winnerId + '/status'] = 'winner';
            db.ref('rooms/' + STATE.currentRoomId).update(updates);

            if (winnerId) {
                db.ref('users/' + winnerId).once('value').then(usnap => {
                    const ud = usnap.val();
                    if (ud) db.ref('users/' + winnerId + '/clicks').set((ud.clicks || 0) + totalPot);
                });
                if (winnerId === STATE.userId) {
                    STATE.clicks += totalPot; saveLocal(); updateUI();
                    showToast(`👑 Вы выиграли ${totalPot} кликов!`, 'success', 5000); playBonusSound();
                }
            }
        }
    });
}

function leaveRoom() {
    if (STATE.arenaListener) { db.ref('rooms/' + STATE.currentRoomId).off('value', STATE.arenaListener); STATE.arenaListener = null; }
    if (STATE.currentRoomId) {
        db.ref('rooms/' + STATE.currentRoomId).once('value').then(snap => {
            const room = snap.val();
            if (room && room.state === 'waiting') {
                db.ref('rooms/' + STATE.currentRoomId + '/players/' + STATE.userId).remove();
                if (room.creatorId === STATE.userId) {
                    Object.keys(room.players || {}).forEach(pid => {
                        if (pid !== STATE.userId) {
                            db.ref('users/' + pid).once('value').then(usnap => { const ud = usnap.val(); if (ud) db.ref('users/' + pid + '/clicks').set((ud.clicks || 0) + room.bet); });
                        }
                    });
                    db.ref('rooms/' + STATE.currentRoomId).remove();
                }
                STATE.clicks += room.bet; saveLocal(); saveToFirebase(); updateUI();
            }
            STATE.currentRoomId = null; renderArenaLobby();
        });
    } else { STATE.currentRoomId = null; renderArenaLobby(); }
}

setInterval(() => {
    db.ref('rooms').once('value').then(snap => {
        snap.forEach(child => {
            const room = child.val();
            if (room && room.state === 'finished' && Date.now() - (room.createdAt || 0) > 300000) db.ref('rooms/' + child.key).remove();
        });
    });
}, 60000);

// ============================================================
// УТИЛИТЫ И ИНИЦИАЛИЗАЦИЯ
// ============================================================
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

function initRegBackground() { /* (Фон регистрации) */ }
function drawLogo(canvas) { /* (Рисование лого) */ }
function updateAndDrawParticles() { /* (Частицы) */ }

window.addEventListener('load', () => {
    setTimeout(() => {
        const ls = document.getElementById('loading-screen');
        ls.style.opacity = '0'; ls.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            ls.style.display = 'none';
            if (STATE.nickname && STATE.userId) startGame();
            else document.getElementById('registration-screen').style.display = 'flex';
        }, 500);
    }, 800);
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('reg-btn')?.addEventListener('click', register);
    document.getElementById('nickname-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') register(); });
    document.getElementById('chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
    document.getElementById('chat-send-btn')?.addEventListener('click', sendChat);
});

// Отключение зума на мобильных
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());
let lastTouchEnd = 0;
document.addEventListener('touchend', e => { const now = Date.now(); if (now - lastTouchEnd <= 300) e.preventDefault(); lastTouchEnd = now; }, false);

window.addEventListener('beforeunload', () => {
    saveLocal(); saveToFirebase();
    if (STATE.userId) db.ref('online/' + STATE.userId).remove();
});
