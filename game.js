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

    // Энергия строго зафиксирована (без улучшений)
    energy: 100,
    maxEnergy: 100,
    energyCost: 1,
    energyRegen: 2, // Восстанавливается по 2 в секунду
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

    // Состояние Арены
    currentRoomId: null,
    arenaListener: null,
    arenaRoomsListener: null,
    arenaState: 'lobby', // lobby | room
    isHolding: false,
    
    onlineUsers: {}
};

// ============================================================
// УЛУЧШЕНИЯ (Без бустеров энергии, цены x10, единый список)
// ============================================================
const UPGRADES = [
    {
        id: 'click_multiplier_1',
        name: 'Мощность клика',
        icon: '💪',
        desc: '+1 очко за каждый клик',
        baseCost: 15000,
        maxLevel: 10
    },
    {
        id: 'auto_clicker_1',
        name: 'Авто-шахтёр',
        icon: '🤖',
        desc: 'Пассивно +1 клик/сек (без траты энергии)',
        baseCost: 40000,
        maxLevel: 10
    },
    {
        id: 'crit_chance_1',
        name: 'Критический удар',
        icon: '⚡',
        desc: '3% шанс ударить на x5 очков',
        baseCost: 60000,
        maxLevel: 5
    },
    {
        id: 'combo_boost_1',
        name: 'Мастер комбо',
        icon: '🔥',
        desc: '+15% времени на удержание комбо',
        baseCost: 25000,
        maxLevel: 5
    },
    {
        id: 'lucky_click_1',
        name: 'Удачливость',
        icon: '🍀',
        desc: '5% шанс получить x2 за клик',
        baseCost: 50000,
        maxLevel: 5
    },
    {
        id: 'penalty_reduction_1',
        name: 'Охлаждение',
        icon: '❄️',
        desc: '-2 сек. времени перегрева',
        baseCost: 30000,
        maxLevel: 5
    },
    {
        id: 'chat_color_1',
        name: 'Цветной никнейм',
        icon: '🎨',
        desc: 'Уникальный цвет в чате',
        baseCost: 100000,
        maxLevel: 1
    },
    {
        id: 'chat_badge_1',
        name: 'VIP бейдж',
        icon: '⭐',
        desc: 'Звёздочка рядом с ником',
        baseCost: 250000,
        maxLevel: 1
    }
];

// Инициализация уровней улучшений
if (!STATE.upgrades || Object.keys(STATE.upgrades).length === 0) {
    STATE.upgrades = {};
}
UPGRADES.forEach(upg => {
    if (STATE.upgrades[upg.id] === undefined) {
        STATE.upgrades[upg.id] = 0;
    }
});

// ============================================================
// ФИЛЬТР МАТОВ
// ============================================================
const BAD_WORDS_PATTERNS = [
    /[хx][уy][йиеёяюijею]/gi,
    /[пp][иieё][зз3][дd][аеёоуыэюяaeiouy]/gi,
    /[бb6][лl][яьъ]/gi,
    /[еёe][бb6][аaоoуyлlиiтtнnсsкk]/gi,
    /[сsc][уyu][кkч][аaiи]/gi,
    /[дd][еeёo][рrб][ьъ]?[мm][оo]/gi,
    /[мm][уyu][дd][аaоoиiлlкk]/gi,
    /[гg][оo][вv][нnh][оo]/gi,
    /[жzj][оo][пp][аaуyыe]/gi,
    /[пp][иieё][дd][оoаaеeёо][рr]/gi,
    /[шш][лl][юуy][хx]/gi,
    /[тt][вv][аa][рr][ьъ]/gi,
    /[дd][аa][уyu][нnh]/gi,
    /[лl][оo][хx]/gi,
    /[дd][еe][бb6][иi][лl]/gi,
    /[иi][дd][иi][оo][тt]/gi,
    /fuck/gi,
    /shit/gi,
    /bitch/gi,
    /ass\s*hole/gi,
    /dick/gi,
    /cunt/gi,
    /nigger/gi,
    /whore/gi,
    /bastard/gi,
    /damn/gi,
];

const BAD_WORDS_EXACT = [
    'хуй', 'хуя', 'хуе', 'хуи', 'хую', 'пизда', 'пизде', 'пизду', 'пиздец',
    'блять', 'бля', 'блядь', 'блядина', 'ебать', 'ебал', 'ебло', 'ебан',
    'сука', 'суки', 'сучка', 'сучара', 'мудак', 'мудила', 'мразь', 'мрази',
    'гандон', 'гнида', 'падла', 'ублюдок', 'уебок', 'уебан', 'залупа',
    'даун', 'дебил', 'дебилы', 'лох', 'лохи', 'шлюха', 'шалава',
    'говно', 'говна', 'жопа', 'жопу', 'пидор', 'пидар', 'пидорас',
    'нахуй', 'нахуя', 'похуй', 'похуя', 'охуеть', 'заебал', 'заебись',
    'ёбаный', 'ебаный', 'ёбаная', 'пиздато', 'хуйня', 'пиздёж',
];

function containsBadWords(text) {
    const lower = text.toLowerCase().trim();
    const stripped = lower.replace(/[\s\-_.*!@#$%^&()0-9]/g, '');

    const words = lower.split(/\s+/);
    for (const word of words) {
        const cleanWord = word.replace(/[^а-яёa-z]/gi, '');
        if (BAD_WORDS_EXACT.includes(cleanWord)) return true;
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
        const regex = new RegExp(word, 'gi');
        result = result.replace(regex, '🤬');
    }
    return result;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    { id: 'shopper1', name: 'Первая покупка', icon: '🛒', desc: 'Купите улучшение', check: () => {
        return Object.values(STATE.upgrades).some(level => level > 0);
    }},
];

function checkAchievements() {
    for (const ach of ACHIEVEMENTS_DEF) {
        if (!STATE.achievements.includes(ach.id) && ach.check()) {
            STATE.achievements.push(ach.id);
            localStorage.setItem('cv_achievements', JSON.stringify(STATE.achievements));
            showAchievementModal(ach);
            updateMiniAchievements();
        }
    }
}

function showAchievementModal(ach) {
    const modal = document.getElementById('achievement-modal');
    document.getElementById('ach-modal-icon').textContent = ach.icon;
    document.getElementById('ach-modal-title').textContent = ach.name;
    document.getElementById('ach-modal-desc').textContent = ach.desc;
    modal.style.display = 'flex';
    spawnConfetti('ach-confetti');
    showToast(`Достижение: ${ach.icon} ${ach.name}`, 'success');
}

function updateMiniAchievements() {
    const container = document.getElementById('mini-achievements');
    if (!container) return;
    container.innerHTML = '';
    const recent = STATE.achievements.slice(-5);
    for (const achId of recent) {
        const def = ACHIEVEMENTS_DEF.find(a => a.id === achId);
        if (def) {
            container.innerHTML += `<div class="mini-ach">${def.icon} ${def.name}</div>`;
        }
    }
}

// ============================================================
// ШТРАФ (антиавтокликер)
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
        showToast('🚫 Перегрев! ' + Math.ceil(STATE.penaltyTimer) + ' сек перезарядка', 'danger');
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
        endPenalty();
    }
}

function endPenalty() {
    STATE.penaltyActive = false;
    STATE.energy = 0;
    document.getElementById('penalty-banner').style.display = 'none';
    document.getElementById('click-canvas').classList.remove('penalty-mode');

    showToast('✅ Перезарядка завершена!', 'success');
}

// ============================================================
// ЗВУКИ (Web Audio API)
// ============================================================
function getAudioCtx() {
    if (!STATE.audioCtx) {
        STATE.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (STATE.audioCtx.state === 'suspended') STATE.audioCtx.resume();
    return STATE.audioCtx;
}

function playClickSound() {
    try {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(800 + STATE.comboCount * 15, now);
        osc1.frequency.exponentialRampToValueAtTime(400, now + 0.06);
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc1.start(now);
        osc1.stop(now + 0.06);
    } catch(e) {}
}

function playBonusSound() {
    try {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            gain.gain.setValueAtTime(0.15, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        });
    } catch(e) {}
}

function playPenaltySound() {
    try {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } catch(e) {}
}

function playComboSound(combo) {
    try {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;
        const baseFreq = 400 + combo * 10;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.08);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
    } catch(e) {}
}

// ============================================================
// ТОСТ-УВЕДОМЛЕНИЯ И ВСПЛЫВАЮЩИЙ ТЕКСТ
// ============================================================
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', warning: '⚠️', danger: '❌', info: 'ℹ️' };
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Новая функция для отображения текста поверх кликера (Крит, Удача, Комбо)
function spawnFloatingEvent(text, color) {
    const container = document.getElementById('floating-events-container');
    if (!container) return;
    
    const el = document.createElement('div');
    el.className = 'floating-event';
    el.textContent = text;
    el.style.color = color;
    
    container.appendChild(el);

    // Удаляем элемент после завершения анимации
    setTimeout(() => {
        el.remove();
    }, 1200);
}

// ============================================================
// КОНФЕТТИ
// ============================================================
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
// МОДАЛКИ (СМЕНА НИКА) И ПРАВИЛА
// ============================================================
function showChatRules() {
    document.getElementById('rules-modal').style.display = 'flex';
}

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

    saveLocal();
    saveToFirebase();
    updateUI();

    document.getElementById('profile-modal').style.display = 'none';
    showToast('✅ Никнейм изменён на «' + nick + '»', 'success');
}

// ============================================================
// СКРОЛЛ ЧАТА
// ============================================================
function chatScrollUp() {
    const c = document.getElementById('chat-messages');
    c.scrollBy({ top: -150, behavior: 'smooth' });
}

function chatScrollDown() {
    const c = document.getElementById('chat-messages');
    c.scrollBy({ top: 150, behavior: 'smooth' });
}

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
            type: Math.random() > 0.7 ? 'star' : 'circle',
        });
    }
}

function updateAndDrawParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width + 100;
    canvas.height = rect.height + 100;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = STATE.particles.length - 1; i >= 0; i--) {
        const p = STATE.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= p.decay;

        if (p.life <= 0) {
            STATE.particles.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;

        const cx = p.x + 50;
        const cy = p.y + 50;

        if (p.type === 'star') {
            drawStar(ctx, cx, cy, p.size);
        } else {
            ctx.beginPath();
            ctx.arc(cx, cy, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    requestAnimationFrame(updateAndDrawParticles);
}

function drawStar(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const method = i === 0 ? 'moveTo' : 'lineTo';
        ctx[method](x + r * Math.cos(angle), y + r * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fill();
}

// ============================================================
// РИСОВАНИЕ КНОПКИ (КЛИКЕРА)
// ============================================================
function drawClickButton() {
    const canvas = document.getElementById('click-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const cx = w / 2;
    const baseR = w * 0.38;
    const r = baseR * STATE.btnScale;

    ctx.clearRect(0, 0, w, w);

    const glowColor = STATE.penaltyActive
        ? 'rgba(255, 71, 87, 0.15)'
        : `hsla(${(Date.now() / 30) % 360}, 70%, 60%, 0.08)`;
    ctx.beginPath();
    ctx.arc(cx, cx, r + 30, 0, Math.PI * 2);
    ctx.fillStyle = glowColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cx + 6, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);

    let grad;
    if (STATE.penaltyActive) {
        grad = ctx.createRadialGradient(cx - r * 0.3, cx - r * 0.3, 0, cx, cx, r);
        grad.addColorStop(0, '#ff6b6b');
        grad.addColorStop(1, '#c0392b');
    } else {
        grad = ctx.createRadialGradient(cx - r * 0.3, cx - r * 0.3, 0, cx, cx, r);
        grad.addColorStop(0, '#a78bfa');
        grad.addColorStop(1, '#5a3ce0');
    }

    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx - r * 0.15, cx - r * 0.2, r * 0.55, 0, Math.PI * 2);
    const hlGrad = ctx.createRadialGradient(cx - r * 0.15, cx - r * 0.3, 0, cx - r * 0.15, cx - r * 0.2, r * 0.55);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad;
    ctx.fill();

    const energyPct = STATE.energy / STATE.maxEnergy;
    ctx.beginPath();
    ctx.arc(cx, cx, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * energyPct);
    ctx.strokeStyle = STATE.penaltyActive
        ? '#ff4757'
        : energyPct > 0.3
            ? '#06d6a0'
            : energyPct > 0.1
                ? '#ffa502'
                : '#ff4757';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (STATE.penaltyActive) {
        ctx.font = `800 ${w * 0.07}px 'Inter'`;
        ctx.fillText('ПЕРЕГРЕВ', cx, cx - 8);
        ctx.font = `900 ${w * 0.12}px 'Inter'`;
        ctx.fillText(Math.ceil(STATE.penaltyTimer) + 'с', cx, cx + 20);
    } else {
        ctx.font = `900 ${w * 0.13}px 'Inter'`;
        ctx.fillText('КЛИК', cx, cx);
    }

    requestAnimationFrame(drawClickButton);
}

// ============================================================
// РЕГИСТРАЦИЯ И ЗАПУСК
// ============================================================
function register() {
    const input = document.getElementById('nickname-input');
    const nick = input.value.trim();
    const err = document.getElementById('reg-error');

    if (nick.length < 2) { err.textContent = '⚠️ Минимум 2 символа'; return; }
    if (nick.length > 15) { err.textContent = '⚠️ Максимум 15 символов'; return; }
    if (containsBadWords(nick)) { err.textContent = '🚫 Недопустимое имя'; return; }
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9_\- ]+$/.test(nick)) { err.textContent = '⚠️ Только буквы, цифры, _-'; return; }

    document.getElementById('reg-btn').innerHTML = '<span class="btn-text">Подключение...</span>';

    if (!STATE.userId) {
        STATE.userId = 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }
    STATE.nickname = nick;

    localStorage.setItem('cv_uid', STATE.userId);
    localStorage.setItem('cv_nick', STATE.nickname);

    db.ref('users/' + STATE.userId).set({
        nickname: STATE.nickname,
        clicks: STATE.clicks,
        level: STATE.level,
        lastSeen: Date.now()
    }).then(() => {
        startGame();
    }).catch(error => {
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
            nickname: STATE.nickname,
            clicks: STATE.clicks,
            level: STATE.level,
            lastSeen: Date.now()
        });
    }

    updateUI();
    drawClickButton();
    updateAndDrawParticles();
    setupClicker();
    updateMiniAchievements();
    checkDailyStreak();
    setupOnlineCounter();

    // Начальный перегрев (охлаждение при входе)
    activatePenalty();

    // ПАССИВНЫЙ АВТО-ШАХТЕР (Автокликер)
    setInterval(() => {
        if (STATE.upgrades.auto_clicker_1 > 0) {
            const autoPoints = STATE.upgrades.auto_clicker_1;
            STATE.clicks += autoPoints;
            STATE.totalClicks += autoPoints;
            updateUI();
        }
    }, 1000);

    // Главный цикл: энергия +2 в секунду (0.2 каждые 100мс), максимум 100
    setInterval(() => {
        if (STATE.penaltyActive) {
            updatePenaltyTimer();
            updateUI();
            return;
        }

        if (STATE.energy < STATE.maxEnergy) {
            STATE.energy = Math.min(STATE.maxEnergy, STATE.energy + 0.2);
        }

        updateUI();
    }, 100);

    setInterval(updateCPS, 200);

    setInterval(() => {
        saveToFirebase();
        saveLocal();
    }, 5000);

    setInterval(checkAchievements, 2000);

    listenLeaderboard();
    listenChat();
    renderShop();
    
    // Отрисовка арены при загрузке
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
        nickname: STATE.nickname,
        clicks: STATE.clicks,
        level: STATE.level,
        lastSeen: Date.now()
    }).catch(error => console.error(error));
}

// ============================================================
// КЛИКЕР
// ============================================================
function setupClicker() {
    const cvs = document.getElementById('click-canvas');

    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (STATE.penaltyActive) {
            playPenaltySound();
            return;
        }

        if (STATE.energy < STATE.energyCost) {
            activatePenalty();
            playPenaltySound();
            return;
        }

        STATE.energy -= STATE.energyCost;

        if (STATE.energy <= 0) {
            activatePenalty();
        }

        let basePoints = 1;
        
        if (STATE.upgrades.click_multiplier_1) {
            basePoints += STATE.upgrades.click_multiplier_1;
        }

        // Шанс крита
        let isCrit = false;
        if (STATE.upgrades.crit_chance_1) {
            const critChance = STATE.upgrades.crit_chance_1 * 0.03; // 3% шанс за уровень
            if (Math.random() < critChance) {
                basePoints *= 5; // Урон x5
                isCrit = true;
                spawnFloatingEvent('⚡ КРИТ x5', 'var(--accent-tertiary)');
            }
        }

        // Шанс удачи (только если не прокнул крит)
        let isLucky = false;
        if (!isCrit && STATE.upgrades.lucky_click_1) {
            const luckyChance = STATE.upgrades.lucky_click_1 * 0.05; // 5% шанс за уровень
            if (Math.random() < luckyChance) {
                basePoints *= 2;
                isLucky = true;
                spawnFloatingEvent('🍀 x2', 'var(--accent-gold)');
            }
        }

        const points = Math.round(basePoints * STATE.multiplier);
        
        STATE.clicks += points;
        STATE.totalClicks += points;
        STATE.level = Math.floor(STATE.clicks / STATE.clicksPerLevel) + 1;

        STATE.cpsHistory.push(Date.now());

        updateCombo();

        STATE.btnScale = 0.88;
        setTimeout(() => STATE.btnScale = 1, 90);

        playClickSound();

        const touch = e.touches ? e.touches[0] : e;
        const canvasRect = cvs.getBoundingClientRect();
        const localX = touch.clientX - canvasRect.left;
        const localY = touch.clientY - canvasRect.top;
        
        spawnParticles(
            (localX / canvasRect.width) * (canvasRect.width + 100) - 50,
            (localY / canvasRect.height) * (canvasRect.height + 100) - 50,
            isCrit ? 15 : 8
        );

        const fb = document.createElement('div');
        fb.className = 'click-feedback';
        fb.textContent = '+' + points;
        fb.style.left = (touch.clientX - 15) + 'px';
        fb.style.top = (touch.clientY - 25) + 'px';
        
        // Визуальное изменение цифр при Крите/Удаче
        if (isCrit) {
            fb.style.color = 'var(--accent-tertiary)';
            fb.style.fontSize = '38px';
        } else if (isLucky) {
            fb.style.color = 'var(--accent-gold)';
            fb.style.fontSize = '32px';
        }

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
}

function updateCombo() {
    const now = Date.now();
    const comboTime = 500 * (1 + (STATE.upgrades.combo_boost_1 || 0) * 0.15);
    const timeSinceLast = now - STATE.lastClickTime;

    if (timeSinceLast < comboTime) {
        STATE.comboCount++;
        if (STATE.comboCount > STATE.maxCombo) {
            STATE.maxCombo = STATE.comboCount;
            localStorage.setItem('cv_maxcombo', STATE.maxCombo);
        }

        if (STATE.comboCount >= 5 && STATE.comboCount % 5 === 0) {
            playComboSound(STATE.comboCount);
            spawnFloatingEvent(`🔥 COMBO x${STATE.comboCount}`, 'var(--accent-tertiary)');
        }
    } else {
        STATE.comboCount = 1;
    }

    STATE.lastClickTime = now;
}

// ============================================================
// ОБНОВЛЕНИЕ UI
// ============================================================
function updateUI() {
    const clicksEl = document.getElementById('clicks-display');
    if (clicksEl) clicksEl.textContent = STATE.clicks.toLocaleString('ru-RU');

    const levelEl = document.getElementById('level-display');
    if (levelEl) levelEl.textContent = STATE.level;

    const headerLevel = document.getElementById('header-level-badge');
    if (headerLevel) headerLevel.textContent = 'Ур. ' + STATE.level;

    const energyText = document.getElementById('energy-text');
    const energyBar = document.getElementById('energy-bar');
    if (energyText) energyText.textContent = Math.floor(STATE.energy) + ' / ' + STATE.maxEnergy;
    if (energyBar) {
        energyBar.style.width = (STATE.energy / STATE.maxEnergy * 100) + '%';
        
        energyBar.classList.remove('danger', 'penalty');
        if (STATE.penaltyActive) {
            energyBar.classList.add('penalty');
        } else if (STATE.energy < 20) {
            energyBar.classList.add('danger');
        }
    }

    const progress = STATE.clicks % STATE.clicksPerLevel;
    const progressLabel = document.getElementById('level-progress-label');
    const levelBar = document.getElementById('level-bar');
    if (progressLabel) progressLabel.textContent = `${progress.toLocaleString('ru-RU')} / ${STATE.clicksPerLevel.toLocaleString('ru-RU')}`;
    if (levelBar) levelBar.style.width = (progress / STATE.clicksPerLevel * 100) + '%';

    const shopBalance = document.getElementById('shop-balance');
    if (shopBalance) shopBalance.textContent = STATE.clicks.toLocaleString('ru-RU');
}

// ============================================================
// СТРИК ДНЕЙ
// ============================================================
function checkDailyStreak() {
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = STATE.lastLoginDate;

    if (lastLogin === today) return;

    if (lastLogin) {
        const last = new Date(lastLogin);
        const todayDate = new Date(today);
        const diff = Math.floor((todayDate - last) / (1000 * 60 * 60 * 24));

        if (diff === 1) {
            STATE.streak++;
            showToast(`🔥 Серия: ${STATE.streak} дней подряд!`, 'success');
        } else if (diff > 1) {
            STATE.streak = 1;
            showToast('📅 Серия сброшена. Заходите каждый день!', 'warning');
        }
    } else {
        STATE.streak = 1;
    }

    STATE.lastLoginDate = today;
    localStorage.setItem('cv_streak', STATE.streak);
    localStorage.setItem('cv_lastlogin', today);

    const el = document.getElementById('streak-display');
    if (el) el.textContent = STATE.streak;
}

// ============================================================
// ОНЛАЙН СЧЕТЧИК
// ============================================================
function setupOnlineCounter() {
    if (!STATE.userId) return;

    const onlineRef = db.ref('online/' + STATE.userId);
    const connRef = db.ref('.info/connected');

    connRef.on('value', snap => {
        if (snap.val() === true) {
            onlineRef.set({ nickname: STATE.nickname, ts: firebase.database.ServerValue.TIMESTAMP });
            onlineRef.onDisconnect().remove();
        }
    });

    db.ref('online').on('value', snap => {
        STATE.onlineUsers = {};
        snap.forEach(child => {
            STATE.onlineUsers[child.key] = true;
        });
        const el = document.getElementById('online-num');
        if (el) el.textContent = Object.keys(STATE.onlineUsers).length;
    });
}

// ============================================================
// ТАБЛИЦА ЛИДЕРОВ (с онлайн-статусом)
// ============================================================
function listenLeaderboard() {
    db.ref('users').orderByChild('clicks').limitToLast(20).on('value', snap => {
        const list = document.getElementById('leaderboard-list');
        const users = [];

        snap.forEach(child => {
            const userData = child.val();
            if (userData && userData.nickname) {
                users.push({ id: child.key, ...userData });
            }
        });

        users.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
        const top = users.slice(0, 15);

        list.innerHTML = '';

        if (top.length === 0) {
            list.innerHTML = '<div class="lb-empty">Пока никого нет. Будьте первым!</div>';
            return;
        }

        const countBadge = document.getElementById('lb-count');
        if (countBadge) countBadge.textContent = top.length;

        top.forEach((u, i) => {
            const rank = i + 1;
            const isMe = u.id === STATE.userId;
            const isOnline = !!STATE.onlineUsers[u.id];

            let rc = 'rank-other';
            if (rank === 1) rc = 'rank-1';
            else if (rank === 2) rc = 'rank-2';
            else if (rank === 3) rc = 'rank-3';

            const nickname = u.nickname || 'Аноним';
            const initial = nickname.charAt(0).toUpperCase();
            const clicks = (u.clicks || 0).toLocaleString('ru-RU');
            const level = u.level || 1;

            const item = document.createElement('div');
            item.className = `lb-item ${isMe ? 'is-me' : ''}`;
            item.innerHTML = `
                <div class="lb-rank ${rc}">${rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}</div>
                <div class="lb-online-dot ${isOnline ? 'online' : 'offline'}"></div>
                <div class="lb-avatar">${initial}</div>
                <div class="lb-info">
                    <div class="lb-name">${escapeHtml(nickname)}</div>
                    <div class="lb-clicks">${clicks} кликов</div>
                </div>
                <div class="lb-level-badge">Ур. ${level}</div>
            `;
            list.appendChild(item);
        });
    });
}

// ============================================================
// ЧАТ
// ============================================================
function listenChat() {
    if (STATE.chatInitialized) return;
    STATE.chatInitialized = true;

    db.ref('chat').limitToLast(50).on('child_added', snap => {
        const m = snap.val();
        if (!m || !m.text) return;

        const container = document.getElementById('chat-messages');
        const isMe = m.userId === STATE.userId;

        const msgEl = document.createElement('div');
        msgEl.className = `chat-msg ${isMe ? 'my-msg' : ''}`;

        const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';

        // Цветной ник
        let nameStyle = '';
        if (m.chatColor) {
            let hash = 0;
            const str = m.nickname || '';
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = Math.abs(hash) % 360;
            nameStyle = `style="color: hsl(${hue}, 80%, 65%)"`;
        }

        let badge = '';
        if (m.vipBadge) badge = '⭐ ';

        msgEl.innerHTML = `
            <div class="chat-msg-header">
                <span class="chat-msg-name" ${nameStyle}>${badge}${escapeHtml(m.nickname || 'Аноним')}</span>
                <span class="chat-msg-level">Ур.${m.level || 1}</span>
                <span class="chat-msg-time">${time}</span>
            </div>
            <div class="chat-msg-text">${escapeHtml(censorText(m.text.substring(0, 200)))}</div>
        `;

        container.appendChild(msgEl);

        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isAtBottom || isMe) {
            container.scrollTop = container.scrollHeight;
        }

        if (!isMe && STATE.currentTab !== 'chat') {
            STATE.unseenMessages++;
            const b = document.getElementById('chat-badge');
            if (b) {
                b.style.display = 'flex';
                b.textContent = STATE.unseenMessages > 9 ? '9+' : STATE.unseenMessages;
            }
        }
    });
}

function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    if (text.length > 200) {
        showToast('Сообщение слишком длинное (макс. 200)', 'warning');
        return;
    }

    if (containsBadWords(text)) {
        showToast('🚫 Сообщение содержит запрещённые слова', 'danger');
        input.value = '';
        return;
    }

    const now = Date.now();
    if (!sendChat._lastSend) sendChat._lastSend = 0;
    if (now - sendChat._lastSend < 1500) {
        showToast('⏳ Подождите перед следующим сообщением', 'warning');
        return;
    }
    sendChat._lastSend = now;

    db.ref('chat').push({
        nickname: STATE.nickname,
        userId: STATE.userId,
        text: text,
        level: STATE.level,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        chatColor: (STATE.upgrades.chat_color_1 || 0) > 0,
        vipBadge: (STATE.upgrades.chat_badge_1 || 0) > 0
    });

    input.value = '';
}

// ============================================================
// МАГАЗИН (Единый список, без энергии)
// ============================================================
function renderShop() {
    const container = document.getElementById('shop-items');
    if (!container) return;
    
    container.innerHTML = '';
    
    UPGRADES.forEach(item => {
        const currentLevel = STATE.upgrades[item.id] || 0;
        const isMaxLevel = currentLevel >= item.maxLevel;
        const cost = Math.floor(item.baseCost * Math.pow(1.5, currentLevel));
        const canAfford = STATE.clicks >= cost;
        
        const div = document.createElement('div');
        div.className = `shop-item ${isMaxLevel ? 'max-level' : ''}`;
        
        div.innerHTML = `
            <div class="shop-item-header">
                <div class="shop-item-icon">${item.icon}</div>
                <div class="shop-item-info">
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-level">Уровень: ${currentLevel} / ${item.maxLevel}</div>
                </div>
            </div>
            <div class="shop-item-desc">${item.desc}</div>
            <div class="shop-item-footer">
                ${isMaxLevel 
                    ? '<div class="shop-item-max">⭐ МАКС</div>'
                    : `
                        <div class="shop-item-price">💎 ${cost.toLocaleString('ru-RU')}</div>
                        <button class="shop-item-buy" ${!canAfford ? 'disabled' : ''} onclick="buyUpgrade('${item.id}')">
                            ${canAfford ? 'Купить' : 'Недостаточно'}
                        </button>
                    `
                }
            </div>
        `;
        
        container.appendChild(div);
    });
}

function buyUpgrade(upgradeId) {
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return;
    
    const currentLevel = STATE.upgrades[upgradeId] || 0;
    if (currentLevel >= upgrade.maxLevel) {
        showToast('⚠️ Достигнут максимальный уровень', 'warning');
        return;
    }
    
    const cost = Math.floor(upgrade.baseCost * Math.pow(1.5, currentLevel));
    
    if (STATE.clicks < cost) {
        showToast('❌ Недостаточно кликов', 'danger');
        return;
    }
    
    STATE.clicks -= cost;
    STATE.upgrades[upgradeId] = currentLevel + 1;
    
    saveLocal();
    saveToFirebase();
    
    updateUI();
    renderShop();
    
    showToast(`✅ Куплено: ${upgrade.name} (Ур. ${STATE.upgrades[upgradeId]})`, 'success');
    playBonusSound();
}

// ============================================================
// АРЕНА (МУЛЬТИПЛЕЕР С УДЕРЖАНИЕМ)
// ============================================================
function renderArenaLobby() {
    if (STATE.currentRoomId) {
        renderArenaRoom();
        return;
    }
    
    STATE.arenaState = 'lobby';

    const content = document.getElementById('arena-content');
    content.innerHTML = `
        <div class="arena-top-bar">
            <button class="arena-btn" onclick="document.getElementById('create-room-modal').style.display='flex'">➕ Создать комнату</button>
            <button class="arena-btn" onclick="renderArenaLobby()">🔄 Обновить</button>
        </div>
        <div class="arena-rooms-list" id="arena-rooms-list">
            <div class="arena-empty">Загрузка комнат...</div>
        </div>
    `;

    if (STATE.arenaRoomsListener) db.ref('rooms').off('value', STATE.arenaRoomsListener);
    STATE.arenaRoomsListener = db.ref('rooms').on('value', snap => {
        const list = document.getElementById('arena-rooms-list');
        if (!list) return;
        
        list.innerHTML = '';

        if (!snap.exists()) {
            list.innerHTML = '<div class="arena-empty">Нет активных комнат. Создайте первую!</div>';
            return;
        }

        let hasRooms = false;
        snap.forEach(child => {
            const room = child.val();
            if (!room || room.state === 'finished') return;
            hasRooms = true;
            
            const playerCount = room.players ? Object.keys(room.players).length : 0;
            const isFull = playerCount >= (room.maxPlayers || 2);
            const isPlaying = room.state === 'playing';

            const card = document.createElement('div');
            card.className = 'arena-room-card';
            card.innerHTML = `
                <div class="arena-room-info">
                    <div class="arena-room-name">${escapeHtml(room.name || 'Комната')}</div>
                    <div class="arena-room-meta">
                        <span>👥 ${playerCount}/${room.maxPlayers || 2}</span>
                        <span>💎 ${(room.bet || 0).toLocaleString('ru-RU')}</span>
                        <span>${isPlaying ? '🎮 Играют' : '⏳ Ожидание'}</span>
                    </div>
                </div>
                <button class="arena-room-join" ${(isFull || isPlaying) ? 'disabled' : ''} onclick="joinRoom('${child.key}')">
                    ${isPlaying ? 'Идёт' : isFull ? 'Полная' : 'Войти'}
                </button>
            `;
            list.appendChild(card);
        });

        if (!hasRooms) {
            list.innerHTML = '<div class="arena-empty">Нет активных комнат. Создайте первую!</div>';
        }
    });
}

function createRoom() {
    const name = document.getElementById('room-name-input').value.trim() || 'Арена';
    const bet = parseInt(document.getElementById('room-bet-input').value) || 100;
    const maxP = parseInt(document.getElementById('room-max-input').value) || 2;
    const err = document.getElementById('create-room-error');

    if (name.length > 20) { err.textContent = '⚠️ Макс. 20 символов'; return; }
    if (containsBadWords(name)) { err.textContent = '🚫 Недопустимое название'; return; }
    if (bet < 10) { err.textContent = '⚠️ Мин. ставка 10'; return; }
    if (bet > 100000) { err.textContent = '⚠️ Макс. ставка 100 000'; return; }
    if (STATE.clicks < bet) { err.textContent = '❌ Мало кликов! Нужно ' + bet; return; }
    if (maxP < 2 || maxP > 5) { err.textContent = '⚠️ От 2 до 5 игроков'; return; }

    // Снимаем ставку с баланса
    STATE.clicks -= bet;
    saveLocal();
    saveToFirebase();
    updateUI();

    const roomRef = db.ref('rooms').push();
    const roomId = roomRef.key;
    
    roomRef.set({
        name: name,
        bet: bet,
        maxPlayers: maxP,
        creatorId: STATE.userId,
        state: 'waiting',
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        players: {
            [STATE.userId]: {
                nickname: STATE.nickname,
                userId: STATE.userId,
                status: 'waiting'
            }
        }
    }).then(() => {
        STATE.currentRoomId = roomId;
        document.getElementById('create-room-modal').style.display = 'none';
        showToast('✅ Комната создана!', 'success');
        renderArenaRoom();
    }).catch(() => {
        STATE.clicks += bet;
        saveLocal(); updateUI();
        err.textContent = '❌ Ошибка создания';
    });
}

function joinRoom(roomId) {
    db.ref('rooms/' + roomId).once('value').then(snap => {
        const room = snap.val();
        if (!room) { showToast('❌ Комната не найдена', 'danger'); return; }
        if (room.state !== 'waiting') { showToast('❌ Игра уже началась', 'danger'); return; }
        const playerCount = room.players ? Object.keys(room.players).length : 0;
        if (playerCount >= (room.maxPlayers || 2)) { showToast('❌ Комната полная', 'danger'); return; }
        if (STATE.clicks < room.bet) { showToast('❌ Мало кликов! Нужно ' + room.bet, 'danger'); return; }

        STATE.clicks -= room.bet;
        saveLocal(); saveToFirebase(); updateUI();

        db.ref('rooms/' + roomId + '/players/' + STATE.userId).set({
            nickname: STATE.nickname,
            userId: STATE.userId,
            status: 'waiting'
        }).then(() => {
            STATE.currentRoomId = roomId;
            showToast('✅ Вы вошли в комнату!', 'success');
            renderArenaRoom();
        }).catch(() => {
            STATE.clicks += room.bet;
            saveLocal(); saveToFirebase(); updateUI();
            showToast('❌ Ошибка входа', 'danger');
        });
    });
}

function renderArenaRoom() {
    STATE.arenaState = 'room';
    const content = document.getElementById('arena-content');
    content.innerHTML = '<div class="arena-empty">Загрузка комнаты...</div>';

    if (STATE.arenaListener) db.ref('rooms/' + STATE.currentRoomId).off('value', STATE.arenaListener);

    STATE.arenaListener = db.ref('rooms/' + STATE.currentRoomId).on('value', snap => {
        const room = snap.val();
        if (!room) {
            STATE.currentRoomId = null;
            renderArenaLobby();
            return;
        }

        const players = room.players || {};
        const playerIds = Object.keys(players);
        const playerCount = playerIds.length;
        const isCreator = room.creatorId === STATE.userId;
        const myData = players[STATE.userId];

        if (!myData && room.state !== 'finished') {
            STATE.currentRoomId = null;
            renderArenaLobby();
            return;
        }

        // Если игра закончилась - показываем финальный экран
        if (room.state === 'finished') {
            const winner = Object.entries(players).find(([_, p]) => p.status === 'winner');
            const totalPot = (room.bet || 0) * playerCount;
            const isWinner = winner && winner[0] === STATE.userId;

            let playersHTML = '';
            Object.entries(players).forEach(([pid, p]) => {
                const isMe = pid === STATE.userId;
                const isW = p.status === 'winner';
                playersHTML += `
                    <div class="arena-player-row ${isMe ? 'is-me' : ''} ${!isW ? 'eliminated' : ''}">
                        <div class="arena-player-avatar">${(p.nickname || 'A').charAt(0).toUpperCase()}</div>
                        <div class="arena-player-name">${escapeHtml(p.nickname || 'Аноним')}</div>
                        <div class="arena-player-status ${isW ? 'status-winner' : 'status-lost'}">${isW ? '👑 Победитель' : '❌ Проиграл'}</div>
                    </div>
                `;
            });

            content.innerHTML = `
                <div class="arena-room-screen">
                    <div class="arena-room-header">
                        <button class="arena-back-btn" onclick="leaveRoom()">← Назад</button>
                        <div class="arena-room-title">Игра окончена</div>
                    </div>
                    <div class="arena-players-list">${playersHTML}</div>
                    <div class="arena-game-area">
                        <div class="arena-hold-btn ${isWinner ? 'won' : 'lost'}">
                            <span>${isWinner ? '👑' : '😢'}</span>
                            <span class="arena-hold-sub">${isWinner ? 'Вы выиграли ' + totalPot + ' кликов!' : 'Вы проиграли'}</span>
                        </div>
                        <button class="arena-start-btn" onclick="leaveRoom()">Вернуться в лобби</button>
                    </div>
                </div>
            `;
            return;
        }

        let playersHTML = '';
        playerIds.forEach(pid => {
            const p = players[pid];
            const isMe = pid === STATE.userId;
            const statusClass = p.status === 'holding' ? 'status-holding' :
                                p.status === 'lost' ? 'status-lost' :
                                p.status === 'winner' ? 'status-winner' : 'status-waiting';
            const statusText = p.status === 'holding' ? '🟢 Держит' :
                               p.status === 'lost' ? '❌ Отпустил' :
                               p.status === 'winner' ? '👑 Победитель' : '⏳ Ждёт';

            playersHTML += `
                <div class="arena-player-row ${isMe ? 'is-me' : ''} ${p.status === 'lost' ? 'eliminated' : ''}">
                    <div class="arena-player-avatar">${(p.nickname || 'A').charAt(0).toUpperCase()}</div>
                    <div class="arena-player-name">${escapeHtml(p.nickname || 'Аноним')}</div>
                    <div class="arena-player-status ${statusClass}">${statusText}</div>
                </div>
            `;
        });

        let gameAreaHTML = '';

        if (room.state === 'waiting') {
            const canStart = isCreator && playerCount >= 2;
            gameAreaHTML = `
                <div class="arena-game-area">
                    <div class="arena-hold-btn waiting">
                        <span>⏳</span>
                        <span class="arena-hold-sub">Ожидание игроков</span>
                    </div>
                    ${isCreator ? `<button class="arena-start-btn" ${!canStart ? 'disabled' : ''} onclick="db.ref('rooms/${STATE.currentRoomId}/state').set('countdown'); db.ref('rooms/${STATE.currentRoomId}/countdownEnd').set(Date.now() + 3000);">
                        ${canStart ? '🎮 Начать игру!' : '👥 Нужно минимум 2 игрока'}
                    </button>` : '<div style="color:var(--text-muted);font-size:13px;">Ожидание хоста...</div>'}
                </div>
            `;
        } else if (room.state === 'countdown') {
            const remaining = room.countdownEnd ? Math.max(0, Math.ceil((room.countdownEnd - Date.now()) / 1000)) : 3;
            gameAreaHTML = `
                <div class="arena-game-area">
                    <div class="arena-timer">Начало через ${remaining}...</div>
                    <div class="arena-hold-btn ready">
                        <span>🎯</span>
                        <span class="arena-hold-sub">Приготовьтесь!</span>
                    </div>
                </div>
            `;
            if (remaining <= 0 && isCreator) {
                db.ref('rooms/' + STATE.currentRoomId + '/state').set('playing');
                playerIds.forEach(pid => {
                    db.ref('rooms/' + STATE.currentRoomId + '/players/' + pid + '/status').set('holding');
                });
            }
        } else if (room.state === 'playing') {
            const myStatus = myData ? myData.status : 'lost';
            let btnClass = 'holding';
            let btnContent = '<span>🔵</span><span class="arena-hold-sub">ДЕРЖИТЕ!</span>';

            if (myStatus === 'lost') {
                btnClass = 'lost';
                btnContent = '<span>❌</span><span class="arena-hold-sub">Вы проиграли</span>';
            }

            if (!STATE.isHolding && myStatus === 'holding') {
                db.ref(`rooms/${STATE.currentRoomId}/players/${STATE.userId}/status`).set('lost');
                setTimeout(checkArenaWinner, 300);
            }

            gameAreaHTML = `
                <div class="arena-game-area">
                    <div class="arena-hold-btn ${btnClass}" id="arena-hold-btn">
                        ${btnContent}
                    </div>
                    ${myStatus === 'holding' ? '<div style="color:var(--accent-secondary);font-size:13px;font-weight:700;">Нажмите и не отпускайте!</div>' : ''}
                </div>
            `;
        }

        content.innerHTML = `
            <div class="arena-room-screen">
                <div class="arena-room-header">
                    <button class="arena-back-btn" onclick="leaveRoom()">← Выйти</button>
                    <div class="arena-room-title">${escapeHtml(room.name || 'Комната')}</div>
                    <div class="arena-room-bet-info">💎 ${(room.bet || 0).toLocaleString('ru-RU')}</div>
                </div>
                <div class="arena-players-list">${playersHTML}</div>
                ${gameAreaHTML}
            </div>
        `;

        if (room.state === 'countdown' || room.state === 'playing') {
            setTimeout(setupHoldListeners, 50);
        }
    });
}

function setupHoldListeners() {
    const btn = document.getElementById('arena-hold-btn');
    if (!btn) return;

    const startHold = (e) => {
        if (e) e.preventDefault();
        if (STATE.isHolding || !STATE.currentRoomId) return;
        STATE.isHolding = true;
        btn.classList.add('holding');
        db.ref(`rooms/${STATE.currentRoomId}/players/${STATE.userId}/status`).set('holding');
    };

    const stopHold = (e) => {
        if (!STATE.isHolding) return;
        STATE.isHolding = false;
        if (btn) btn.classList.remove('holding');
        if (STATE.currentRoomId) {
            db.ref(`rooms/${STATE.currentRoomId}/players/${STATE.userId}/status`).set('lost');
            setTimeout(checkArenaWinner, 300);
        }
    };

    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('touchstart', startHold, { passive: false });
    document.addEventListener('mouseup', stopHold);
    document.addEventListener('touchend', stopHold);
    window.addEventListener('blur', stopHold);
}

function checkArenaWinner() {
    if (!STATE.currentRoomId) return;
    db.ref('rooms/' + STATE.currentRoomId).once('value').then(snap => {
        const room = snap.val();
        if (!room || room.state !== 'playing') return;

        const players = room.players || {};
        const holdingIds = Object.keys(players).filter(pid => players[pid].status === 'holding');

        if (holdingIds.length <= 1) {
            const winnerId = holdingIds.length === 1 ? holdingIds[0] : null;
            const totalPot = (room.bet || 0) * Object.keys(players).length;

            const updates = { state: 'finished' };
            if (winnerId) {
                updates['players/' + winnerId + '/status'] = 'winner';
            }
            db.ref('rooms/' + STATE.currentRoomId).update(updates);

            if (winnerId) {
                db.ref('users/' + winnerId).once('value').then(usnap => {
                    const userData = usnap.val();
                    if (userData) {
                        db.ref('users/' + winnerId + '/clicks').set((userData.clicks || 0) + totalPot);
                    }
                });

                if (winnerId === STATE.userId) {
                    STATE.clicks += totalPot;
                    saveLocal();
                    updateUI();
                    showToast(`👑 Вы выиграли ${totalPot.toLocaleString('ru-RU')} кликов!`, 'success', 5000);
                    playBonusSound();
                }
            }
        }
    });
}

function leaveRoom() {
    if (STATE.arenaListener) {
        db.ref('rooms/' + STATE.currentRoomId).off('value', STATE.arenaListener);
        STATE.arenaListener = null;
    }

    if (STATE.currentRoomId) {
        db.ref('rooms/' + STATE.currentRoomId).once('value').then(snap => {
            const room = snap.val();
            if (room && room.state === 'waiting') {
                db.ref('rooms/' + STATE.currentRoomId + '/players/' + STATE.userId).remove();

                if (room.creatorId === STATE.userId) {
                    Object.entries(room.players || {}).forEach(([pid, p]) => {
                        if (pid !== STATE.userId) {
                            db.ref('users/' + pid).once('value').then(usnap => {
                                const ud = usnap.val();
                                if (ud) db.ref('users/' + pid + '/clicks').set((ud.clicks || 0) + (room.bet || 0));
                            });
                        }
                    });
                    db.ref('rooms/' + STATE.currentRoomId).remove();
                }
                STATE.clicks += (room.bet || 0);
                saveLocal(); saveToFirebase(); updateUI();
            }
            
            STATE.currentRoomId = null;
            STATE.isHolding = false;
            renderArenaLobby();
        });
    } else {
        STATE.currentRoomId = null;
        renderArenaLobby();
    }
}

setInterval(() => {
    db.ref('rooms').once('value').then(snap => {
        snap.forEach(child => {
            const room = child.val();
            if (room && room.state === 'finished' && room.createdAt && Date.now() - room.createdAt > 300000) {
                db.ref('rooms/' + child.key).remove();
            }
        });
    });
}, 60000);

// ============================================================
// НАВИГАЦИЯ (ВКЛАДКИ)
// ============================================================
function switchTab(tabName, btnElement) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active-tab'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById('tab-' + tabName).classList.add('active-tab');
    if (btnElement) btnElement.classList.add('active');

    STATE.currentTab = tabName;

    if (tabName === 'chat') {
        STATE.unseenMessages = 0;
        const b = document.getElementById('chat-badge');
        if (b) b.style.display = 'none';
        setTimeout(() => {
            const c = document.getElementById('chat-messages');
            c.scrollTop = c.scrollHeight;
        }, 50);
    }

    if (tabName === 'shop') {
        renderShop();
    }

    if (tabName === 'arena') {
        renderArenaLobby();
    }
}

// ============================================================
// РЕГИСТРАЦИОННЫЙ ФОН И ЛОГОТИП
// ============================================================
function initRegBackground() {
    const canvas = document.getElementById('reg-bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const bgParticles = [];
    for (let i = 0; i < 80; i++) {
        bgParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 2 + 0.5,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            alpha: Math.random() * 0.5 + 0.1,
            color: Math.random() > 0.5 ? '#7c5cfc' : '#06d6a0',
        });
    }

    function animate() {
        ctx.fillStyle = 'rgba(6, 6, 20, 0.08)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (const p of bgParticles) {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();
        }

        ctx.globalAlpha = 0.05;
        ctx.strokeStyle = '#7c5cfc';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < bgParticles.length; i++) {
            for (let j = i + 1; j < bgParticles.length; j++) {
                const dx = bgParticles[i].x - bgParticles[j].x;
                const dy = bgParticles[i].y - bgParticles[j].y;
                if (Math.abs(dx) < 100 && Math.abs(dy) < 100) {
                    ctx.beginPath();
                    ctx.moveTo(bgParticles[i].x, bgParticles[i].y);
                    ctx.lineTo(bgParticles[j].x, bgParticles[j].y);
                    ctx.stroke();
                }
            }
        }

        ctx.globalAlpha = 1;
        requestAnimationFrame(animate);
    }

    animate();
}

function drawLogo(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const cx = w / 2;
    const r = w * 0.38;

    ctx.clearRect(0, 0, w, w);

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (Math.PI / 3) * i;
        ctx.lineTo(cx + r * Math.cos(a), cx + r * Math.sin(a));
    }
    ctx.closePath();

    const g = ctx.createLinearGradient(0, 0, w, w);
    g.addColorStop(0, '#7c5cfc');
    g.addColorStop(0.5, '#a78bfa');
    g.addColorStop(1, '#06d6a0');
    ctx.fillStyle = g;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (Math.PI / 3) * i;
        ctx.lineTo(cx + r * 0.6 * Math.cos(a), cx + r * 0.6 * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ И СОБЫТИЯ
// ============================================================
window.addEventListener('load', () => {
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            loadingScreen.style.display = 'none';

            if (STATE.nickname && STATE.userId) {
                startGame();
            } else {
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
    if (nickInput) {
        nickInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') register();
        });
    }

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') sendChat();
        });
    }

    const chatSendBtn = document.getElementById('chat-send-btn');
    if (chatSendBtn) chatSendBtn.addEventListener('click', sendChat);
});

// Отключение зума на мобильных (touch-action отключен только для нужных элементов в CSS)
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());

let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

window.addEventListener('beforeunload', () => {
    saveLocal();
    saveToFirebase();
    if (STATE.userId) {
        db.ref('online/' + STATE.userId).remove();
    }
});
