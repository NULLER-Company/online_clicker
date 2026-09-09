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
    energyRegen: 3.5,
    clicksPerLevel: 1000,

    multiplier: 1,
    noEnergyCost: false,
    bonusActive: false,
    bonusType: null,
    bonusTimer: 0,

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
    btnHue: 0,

    particles: [],

    achievements: JSON.parse(localStorage.getItem('cv_achievements') || '[]'),

    audioCtx: null,

    chatInitialized: false,
    currentTab: 'clicker',
    unseenMessages: 0,

    lastMilestone: parseInt(localStorage.getItem('cv_lastmilestone')) || 0,

    upgrades: JSON.parse(localStorage.getItem('cv_upgrades') || '{}'),
    currentShopCategory: 'energy'
};

// ============================================================
// УЛУЧШЕНИЯ
// ============================================================
const UPGRADES = {
    energy: [
        {
            id: 'max_energy_1',
            name: 'Энергоёмкость I',
            icon: '🔋',
            desc: '+20 к максимальной энергии',
            baseCost: 500,
            maxLevel: 10,
            effect: (level) => ({ maxEnergy: 20 * level })
        },
        {
            id: 'energy_regen_1',
            name: 'Регенерация I',
            icon: '⚡',
            desc: '+0.5 энергии в секунду',
            baseCost: 1000,
            maxLevel: 10,
            effect: (level) => ({ energyRegen: 0.5 * level })
        },
        {
            id: 'energy_cost_1',
            name: 'Эффективность I',
            icon: '💡',
            desc: '-10% стоимость клика',
            baseCost: 2000,
            maxLevel: 5,
            effect: (level) => ({ energyCostMultiplier: 1 - (0.1 * level) })
        },
        {
            id: 'penalty_reduction_1',
            name: 'Охлаждение I',
            icon: '❄️',
            desc: '-2 сек. времени перегрева',
            baseCost: 3000,
            maxLevel: 5,
            effect: (level) => ({ penaltyReduction: 2 * level })
        }
    ],
    profile: [
        {
            id: 'click_multiplier_1',
            name: 'Мощность клика I',
            icon: '💪',
            desc: '+10% очков за клик',
            baseCost: 1500,
            maxLevel: 10,
            effect: (level) => ({ clickPower: 0.1 * level })
        },
        {
            id: 'combo_boost_1',
            name: 'Мастер комбо I',
            icon: '🔥',
            desc: '+15% время на комбо',
            baseCost: 2500,
            maxLevel: 5,
            effect: (level) => ({ comboTime: 0.15 * level })
        },
        {
            id: 'lucky_click_1',
            name: 'Удачливость I',
            icon: '🍀',
            desc: '5% шанс x2 клика',
            baseCost: 5000,
            maxLevel: 5,
            effect: (level) => ({ luckyChance: 0.05 * level })
        }
    ],
    chat: [
        {
            id: 'chat_color_1',
            name: 'Цветной никнейм',
            icon: '🎨',
            desc: 'Уникальный цвет в чате',
            baseCost: 10000,
            maxLevel: 1,
            effect: (level) => ({ chatColor: true })
        },
        {
            id: 'chat_badge_1',
            name: 'VIP бейдж',
            icon: '⭐',
            desc: 'VIP статус в чате',
            baseCost: 25000,
            maxLevel: 1,
            effect: (level) => ({ vipBadge: true })
        },
        {
            id: 'chat_emoji_1',
            name: 'Больше эмодзи',
            icon: '😎',
            desc: '+50 символов в чат',
            baseCost: 15000,
            maxLevel: 1,
            effect: (level) => ({ chatLength: 50 })
        }
    ]
};

// Инициализация улучшений
if (!STATE.upgrades || Object.keys(STATE.upgrades).length === 0) {
    STATE.upgrades = {};
    Object.keys(UPGRADES).forEach(cat => {
        UPGRADES[cat].forEach(upg => {
            STATE.upgrades[upg.id] = 0;
        });
    });
}

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

// ============================================================
// ДОСТИЖЕНИЯ
// ============================================================
const ACHIEVEMENTS_DEF = [
    { id: 'click100', name: 'Новичок', icon: '🐣', desc: '100 кликов', check: () => STATE.clicks >= 100 },
    { id: 'click500', name: 'Начинающий', icon: '👆', desc: '500 кликов', check: () => STATE.clicks >= 500 },
    { id: 'click1000', name: 'Кликер', icon: '✊', desc: '1 000 кликов', check: () => STATE.clicks >= 1000 },
    { id: 'click5000', name: 'Профи', icon: '💪', desc: '5 000 кликов', check: () => STATE.clicks >= 5000 },
    { id: 'click10000', name: 'Мастер', icon: '🏅', desc: '10 000 кликов', check: () => STATE.clicks >= 10000 },
    { id: 'click50000', name: 'Легенда', icon: '🏆', desc: '50 000 кликов', check: () => STATE.clicks >= 50000 },
    { id: 'click100000', name: 'Бог кликера', icon: '👑', desc: '100 000 кликов', check: () => STATE.clicks >= 100000 },
    { id: 'level5', name: 'Ур. 5', icon: '⭐', desc: 'Достигните 5 уровня', check: () => STATE.level >= 5 },
    { id: 'level10', name: 'Ур. 10', icon: '🌟', desc: 'Достигните 10 уровня', check: () => STATE.level >= 10 },
    { id: 'level25', name: 'Ур. 25', icon: '💫', desc: 'Достигните 25 уровня', check: () => STATE.level >= 25 },
    { id: 'combo20', name: 'Комбо 20', icon: '🔥', desc: 'Наберите комбо 20', check: () => STATE.maxCombo >= 20 },
    { id: 'combo50', name: 'Комбо 50', icon: '🔥', desc: 'Наберите комбо 50', check: () => STATE.maxCombo >= 50 },
    { id: 'cps8', name: 'Скорострел', icon: '⚡', desc: '8+ кликов/сек', check: () => STATE.currentCps >= 8 },
    { id: 'streak3', name: '3 дня подряд', icon: '📅', desc: 'Заходите 3 дня', check: () => STATE.streak >= 3 },
    { id: 'streak7', name: 'Неделя!', icon: '🗓️', desc: 'Заходите 7 дней', check: () => STATE.streak >= 7 },
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
// БОНУСЫ (каждые 1000 кликов)
// ============================================================
const BONUS_TYPES = [
    {
        type: 'x2',
        icon: '✖️2',
        title: 'Двойные клики!',
        desc: 'x2 очков за каждый клик на 20 секунд!',
        color: '#06d6a0',
        duration: 20,
    },
    {
        type: 'noenergy',
        icon: '⚡',
        title: 'Бесконечная энергия!',
        desc: 'Клики не тратят энергию 20 секунд!',
        color: '#ffd700',
        duration: 20,
    },
    {
        type: 'x3',
        icon: '✖️3',
        title: 'ТРОЙНЫЕ клики!',
        desc: 'x3 очков за каждый клик на 15 секунд!',
        color: '#f72585',
        duration: 15,
    },
    {
        type: 'energyregen',
        icon: '🔋',
        title: 'Быстрая зарядка!',
        desc: 'Энергия восполняется в 5 раз быстрее на 25 секунд!',
        color: '#2ed573',
        duration: 25,
    },
];

function checkMilestone() {
    const currentMilestone = Math.floor(STATE.clicks / STATE.clicksPerLevel);
    if (currentMilestone > STATE.lastMilestone && currentMilestone > 0) {
        STATE.lastMilestone = currentMilestone;
        localStorage.setItem('cv_lastmilestone', STATE.lastMilestone);
        triggerRandomBonus();
    }
}

function triggerRandomBonus() {
    if (STATE.bonusActive || STATE.penaltyActive) return;

    const bonus = BONUS_TYPES[Math.floor(Math.random() * BONUS_TYPES.length)];

    const modal = document.getElementById('bonus-modal');
    document.getElementById('bonus-modal-icon').textContent = bonus.icon;
    document.getElementById('bonus-modal-title').textContent = bonus.title;
    document.getElementById('bonus-modal-desc').textContent = bonus.desc;
    modal.style.display = 'flex';
    spawnConfetti('modal-confetti');

    STATE.bonusActive = true;
    STATE.bonusType = bonus.type;
    STATE.bonusTimer = bonus.duration;

    if (bonus.type === 'x2') {
        STATE.multiplier = 2;
    } else if (bonus.type === 'x3') {
        STATE.multiplier = 3;
    } else if (bonus.type === 'noenergy') {
        STATE.noEnergyCost = true;
    } else if (bonus.type === 'energyregen') {
        STATE.energyRegen = calculateEnergyRegen() * 5;
    }

    const banner = document.getElementById('bonus-banner');
    const bannerIcon = document.getElementById('bonus-banner-icon');
    const bannerText = document.getElementById('bonus-banner-text');
    bannerIcon.textContent = bonus.icon;
    bannerText.textContent = bonus.title;
    banner.style.display = 'flex';

    if (bonus.type === 'x2' || bonus.type === 'x3') {
        const md = document.getElementById('multiplier-display');
        document.getElementById('multiplier-value').textContent = STATE.multiplier;
        md.style.display = 'block';
    }
}

function updateBonusTimer() {
    if (!STATE.bonusActive) return;

    STATE.bonusTimer -= 0.1;
    const timerEl = document.getElementById('bonus-banner-timer');
    if (timerEl) timerEl.textContent = Math.ceil(STATE.bonusTimer) + 'с';

    if (STATE.bonusTimer <= 0) {
        endBonus();
    }
}

function endBonus() {
    STATE.bonusActive = false;
    STATE.multiplier = 1;
    STATE.noEnergyCost = false;
    STATE.energyRegen = calculateEnergyRegen();
    STATE.bonusType = null;

    document.getElementById('bonus-banner').style.display = 'none';
    document.getElementById('multiplier-display').style.display = 'none';

    showToast('Бонус закончился', 'info');
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

    if (STATE.bonusActive) endBonus();

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
// ЗВУКИ
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

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1200 + STATE.comboCount * 20, now);
        osc2.frequency.exponentialRampToValueAtTime(300, now + 0.04);
        gain2.gain.setValueAtTime(0.08, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc2.start(now);
        osc2.stop(now + 0.04);
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
// ТОСТ-УВЕДОМЛЕНИЯ
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
// ПРАВИЛА ЧАТА
// ============================================================
function showChatRules() {
    document.getElementById('rules-modal').style.display = 'flex';
}

// ============================================================
// МОДАЛКА БОНУСА
// ============================================================
function closeBonusModal() {
    document.getElementById('bonus-modal').style.display = 'none';
    playBonusSound();
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
// РИСОВАНИЕ КНОПКИ
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
    } else if (STATE.bonusActive) {
        const hue = (Date.now() / 10) % 360;
        grad = ctx.createRadialGradient(cx - r * 0.3, cx - r * 0.3, 0, cx, cx, r);
        grad.addColorStop(0, `hsl(${hue}, 80%, 70%)`);
        grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 80%, 45%)`);
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
// CPS (клики в секунду)
// ============================================================
function updateCPS() {
    const now = Date.now();
    STATE.cpsHistory = STATE.cpsHistory.filter(t => now - t < 1000);
    STATE.currentCps = STATE.cpsHistory.length;
    const el = document.getElementById('cps-display');
    if (el) el.textContent = STATE.currentCps;
}

// ============================================================
// КОМБО
// ============================================================
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
            showComboIndicator();
        }
    } else {
        STATE.comboCount = 1;
    }

    STATE.lastClickTime = now;

    clearTimeout(STATE.comboTimer);
    STATE.comboTimer = setTimeout(() => {
        STATE.comboCount = 0;
        removeComboIndicator();
    }, 1500);
}

function showComboIndicator() {
    removeComboIndicator();
    const area = document.getElementById('clicker-area');
    const el = document.createElement('div');
    el.className = 'combo-display';
    el.textContent = `🔥 COMBO x${STATE.comboCount}`;
    el.id = 'combo-indicator';
    area.appendChild(el);
}

function removeComboIndicator() {
    const el = document.getElementById('combo-indicator');
    if (el) el.remove();
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
            onlineRef.set(true);
            onlineRef.onDisconnect().remove();
        }
    });

    db.ref('online').on('value', snap => {
        const count = snap.numChildren();
        const el = document.getElementById('online-num');
        if (el) el.textContent = count;
    });
}

// ============================================================
// ЛОГОТИП
// ============================================================
function drawLogo(canvas) {
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
// НАВИГАЦИЯ (МОБИЛЬНАЯ)
// ============================================================
function switchTab(tabName, btnElement) {
    if (window.innerWidth > 900) return;

    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active-tab'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById('tab-' + tabName).classList.add('active-tab');
    btnElement.classList.add('active');

    STATE.currentTab = tabName;

    if (tabName === 'chat') {
        STATE.unseenMessages = 0;
        document.getElementById('chat-badge').style.display = 'none';
        setTimeout(() => {
            const c = document.getElementById('chat-messages');
            c.scrollTop = c.scrollHeight;
        }, 50);
    }

    if (tabName === 'shop') {
        renderShop();
    }
}

// ============================================================
// РЕГИСТРАЦИЯ (ИСПРАВЛЕНО!)
// ============================================================
function register() {
    const input = document.getElementById('nickname-input');
    const nick = input.value.trim();
    const err = document.getElementById('reg-error');

    if (nick.length < 2) {
        err.textContent = '⚠️ Минимум 2 символа';
        input.style.borderColor = 'var(--danger)';
        return;
    }

    if (nick.length > 15) {
        err.textContent = '⚠️ Максимум 15 символов';
        return;
    }

    if (containsBadWords(nick)) {
        err.textContent = '🚫 Никнейм содержит недопустимые слова';
        input.style.borderColor = 'var(--danger)';
        return;
    }

    if (!/^[a-zA-Zа-яА-ЯёЁ0-9_\- ]+$/.test(nick)) {
        err.textContent = '⚠️ Только буквы, цифры и _-';
        return;
    }

    document.getElementById('reg-btn').innerHTML = '<span class="btn-text">Подключение...</span>';

    if (!STATE.userId) {
        STATE.userId = 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }
    STATE.nickname = nick;

    localStorage.setItem('cv_uid', STATE.userId);
    localStorage.setItem('cv_nick', STATE.nickname);

    // Сохраняем в Firebase СРАЗУ при регистрации
    db.ref('users/' + STATE.userId).set({
        nickname: STATE.nickname,
        clicks: STATE.clicks,
        level: STATE.level,
        lastSeen: Date.now()
    }).then(() => {
        console.log('✅ Пользователь сохранён в Firebase');
        startGame();
    }).catch(error => {
        console.error('❌ Ошибка сохранения:', error);
        err.textContent = '❌ Ошибка подключения к серверу';
        document.getElementById('reg-btn').innerHTML = '<span class="btn-text">Начать игру</span><span class="btn-icon">→</span>';
    });
}

// ============================================================
// ЗАПУСК ИГРЫ (ИСПРАВЛЕНО!)
// ============================================================
function startGame() {
    document.getElementById('registration-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
    document.getElementById('header-nickname').textContent = STATE.nickname;
    document.getElementById('header-level-badge').textContent = 'Ур. ' + STATE.level;
    document.getElementById('streak-display').textContent = STATE.streak;

    const avatar = document.getElementById('header-avatar');
    avatar.textContent = STATE.nickname.charAt(0).toUpperCase();

    drawLogo(document.getElementById('header-logo'));
    
    // ВАЖНО: Сохраняем данные в Firebase при запуске
    if (STATE.userId && STATE.nickname) {
        db.ref('users/' + STATE.userId).update({
            nickname: STATE.nickname,
            clicks: STATE.clicks,
            level: STATE.level,
            lastSeen: Date.now()
        }).then(() => {
            console.log('✅ Данные обновлены в Firebase при запуске');
        }).catch(error => {
            console.error('❌ Ошибка обновления:', error);
        });
    }
    
    // Применяем улучшения
    applyUpgrades();
    
    updateUI();
    drawClickButton();
    updateAndDrawParticles();
    setupClicker();
    updateMiniAchievements();

    checkDailyStreak();

    setupOnlineCounter();

    // Начальный перегрев на 20 секунд
    activatePenalty();

    setInterval(() => {
        if (STATE.penaltyActive) {
            updatePenaltyTimer();
            updateUI();
            return;
        }

        if (STATE.energy < STATE.maxEnergy) {
            STATE.energy = Math.min(STATE.maxEnergy, STATE.energy + STATE.energyRegen * 0.1);
        }

        if (STATE.bonusActive) {
            updateBonusTimer();
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
}

function saveLocal() {
    localStorage.setItem('cv_clicks', STATE.clicks);
    localStorage.setItem('cv_level', STATE.level);
    localStorage.setItem('cv_total', STATE.totalClicks);
    localStorage.setItem('cv_upgrades', JSON.stringify(STATE.upgrades));
}

// ИСПРАВЛЕНО: используем set вместо update для гарантии всех полей
function saveToFirebase() {
    if (!STATE.userId || !STATE.nickname) {
        console.warn('⚠️ Нет userId или nickname для сохранения');
        return;
    }
    db.ref('users/' + STATE.userId).set({
        nickname: STATE.nickname,
        clicks: STATE.clicks,
        level: STATE.level,
        lastSeen: Date.now()
    }).catch(error => {
        console.error('❌ Ошибка сохранения:', error);
    });
}

// ============================================================
// КЛИК
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

        const cost = STATE.energyCost * (STATE.upgrades.energy_cost_1 ? (1 - STATE.upgrades.energy_cost_1 * 0.1) : 1);

        if (STATE.energy < cost && !STATE.noEnergyCost) {
            activatePenalty();
            playPenaltySound();
            return;
        }

        if (!STATE.noEnergyCost) {
            STATE.energy -= cost;
        }

        if (STATE.energy <= 0 && !STATE.noEnergyCost) {
            activatePenalty();
        }

        let basePoints = 1;
        
        if (STATE.upgrades.click_multiplier_1) {
            basePoints *= (1 + STATE.upgrades.click_multiplier_1 * 0.1);
        }

        if (STATE.upgrades.lucky_click_1) {
            const luckyChance = STATE.upgrades.lucky_click_1 * 0.05;
            if (Math.random() < luckyChance) {
                basePoints *= 2;
                showToast('🍀 Удачный клик x2!', 'success', 1500);
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
        
        const particleCount = STATE.multiplier > 1 ? 15 : 8;
        spawnParticles(
            (localX / canvasRect.width) * (canvasRect.width + 100) - 50,
            (localY / canvasRect.height) * (canvasRect.height + 100) - 50,
            particleCount
        );

        const fb = document.createElement('div');
        fb.className = 'click-feedback';
        fb.textContent = '+' + points;
        fb.style.left = (touch.clientX - 15) + 'px';
        fb.style.top = (touch.clientY - 25) + 'px';
        if (STATE.multiplier > 1) {
            fb.style.color = '#06d6a0';
            fb.style.fontSize = '34px';
        }
        document.body.appendChild(fb);
        setTimeout(() => fb.remove(), 700);

        checkMilestone();

        updateUI();
    };

    cvs.addEventListener('mousedown', handleClick);
    cvs.addEventListener('touchstart', handleClick, { passive: false });

    cvs.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    cvs.addEventListener('contextmenu', e => e.preventDefault());
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
// ТАБЛИЦА ЛИДЕРОВ (ИСПРАВЛЕНО!)
// ============================================================
function listenLeaderboard() {
    db.ref('users').orderByChild('clicks').limitToLast(20).on('value', snap => {
        const list = document.getElementById('leaderboard-list');
        const users = [];

        snap.forEach(child => {
            const userData = child.val();
            // ВАЖНО: Фильтруем пользователей без никнейма
            if (userData && userData.nickname) {
                users.push({ id: child.key, ...userData });
            }
        });

        console.log('📊 Загружено пользователей:', users.length);

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
                <div class="lb-avatar">${initial}</div>
                <div class="lb-info">
                    <div class="lb-name">${escapeHtml(nickname)}</div>
                    <div class="lb-clicks">${clicks} кликов</div>
                </div>
                <div class="lb-level-badge">Ур. ${level}</div>
            `;
            list.appendChild(item);
        });
    }, error => {
        console.error('❌ Ошибка чтения таблицы лидеров:', error);
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

        const maxLength = 200 + (STATE.upgrades.chat_emoji_1 ? 50 : 0);

        msgEl.innerHTML = `
            <div class="chat-msg-header">
                <span class="chat-msg-name">${escapeHtml(m.nickname || 'Аноним')}</span>
                <span class="chat-msg-level">Ур.${m.level || 1}</span>
                <span class="chat-msg-time">${time}</span>
            </div>
            <div class="chat-msg-text">${escapeHtml(censorText(m.text.substring(0, maxLength)))}</div>
        `;

        container.appendChild(msgEl);

        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isAtBottom || isMe) {
            container.scrollTop = container.scrollHeight;
        }

        if (!isMe && STATE.currentTab !== 'chat') {
            STATE.unseenMessages++;
            const badge = document.getElementById('chat-badge');
            if (badge) {
                badge.style.display = 'flex';
                badge.textContent = STATE.unseenMessages > 9 ? '9+' : STATE.unseenMessages;
            }
        }
    });
}

function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const maxLength = 200 + (STATE.upgrades.chat_emoji_1 ? 50 : 0);

    if (text.length > maxLength) {
        showToast('Сообщение слишком длинное (макс. ' + maxLength + ')', 'warning');
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
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    input.value = '';
}

// ============================================================
// МАГАЗИН
// ============================================================
function switchShopCategory(category, btn) {
    STATE.currentShopCategory = category;
    
    document.querySelectorAll('.shop-category-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    renderShop();
}

function calculateMaxEnergy() {
    let base = 100;
    if (STATE.upgrades.max_energy_1) {
        base += STATE.upgrades.max_energy_1 * 20;
    }
    return base;
}

function calculateEnergyRegen() {
    let base = 3.5;
    if (STATE.upgrades.energy_regen_1) {
        base += STATE.upgrades.energy_regen_1 * 0.5;
    }
    return base;
}

function applyUpgrades() {
    STATE.maxEnergy = calculateMaxEnergy();
    STATE.energyRegen = calculateEnergyRegen();
}

function renderShop() {
    const container = document.getElementById('shop-items');
    if (!container) return;
    
    container.innerHTML = '';
    
    const items = UPGRADES[STATE.currentShopCategory] || [];
    
    items.forEach(item => {
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
    let upgrade = null;
    for (const cat in UPGRADES) {
        const found = UPGRADES[cat].find(u => u.id === upgradeId);
        if (found) {
            upgrade = found;
            break;
        }
    }
    
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
    
    applyUpgrades();
    
    saveLocal();
    saveToFirebase();
    
    updateUI();
    renderShop();
    
    showToast(`✅ Куплено: ${upgrade.name} (Ур. ${STATE.upgrades[upgradeId]})`, 'success');
    playBonusSound();
}

// ============================================================
// УТИЛИТЫ
// ============================================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// РЕГИСТРАЦИОННЫЙ ФОН
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

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
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