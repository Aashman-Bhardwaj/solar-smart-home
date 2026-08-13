// ========== SOLAR SMART HOME - GLOBAL APP ENGINE ==========
const APP = {
  DB_KEY: 'solarSmartHomeDB',
  SESSION_KEY: 'solarSession',
  ADMIN_PASS: 'Solarsmarthome',
  PANEL_OUTPUT_DEFAULT: 0.4,
  SUNLIGHT_HOURS_DEFAULT: 5,
  TARIFF_RATE: 8,
  CO2_PER_KWH: 0.82,
  PANEL_COST_ANNUAL: 3500,

  init() {
    this.loadDB();
    this.seedLeaderboard();
    this.updateNav();
    this.initParticles();
  },

  loadDB() {
    const raw = localStorage.getItem(this.DB_KEY);
    this.db = raw ? JSON.parse(raw) : { users: [], calculations: [], sessions: [] };
  },

  saveDB() { localStorage.setItem(this.DB_KEY, JSON.stringify(this.db)); },

  getSession() {
    const s = localStorage.getItem(this.SESSION_KEY);
    return s ? JSON.parse(s) : null;
  },

  // ---- AUTH ----
  register(username, password, name) {
    this.loadDB();
    if (this.db.users.find(u => u.username === username)) return { error: 'Username already exists!' };
    if (username.length < 3) return { error: 'Username must be 3+ characters' };
    if (password.length < 4) return { error: 'Password must be 4+ characters' };
    const user = {
      id: 'USH-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2,4).toUpperCase(),
      username, password, name: name || username,
      country: 'IN', panels: 0, totalCurrentGenerated: 0,
      registeredAt: new Date().toISOString(), lastLogin: null, loginCount: 0
    };
    this.db.users.push(user);
    this.saveDB();
    this.addToLeaderboard(user);
    return { success: true, user };
  },

  login(username, password) {
    this.loadDB();
    const user = this.db.users.find(u => u.username === username && u.password === password);
    if (!user) return { error: 'Invalid username or password!' };
    user.lastLogin = new Date().toISOString();
    user.loginCount++;
    this.db.sessions.push({ userId: user.id, loginAt: new Date().toISOString(), userAgent: navigator.userAgent });
    this.saveDB();
    localStorage.setItem(this.SESSION_KEY, JSON.stringify({ userId: user.id, username: user.username, name: user.name }));
    this.updateNav();
    this.addToLeaderboard(user);
    return { success: true, user };
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    this.updateNav();
    window.location.href = 'login.html';
  },

  requireAuth() {
    const s = this.getSession();
    if (!s) { window.location.href = 'login.html'; return null; }
    return s;
  },

  getUser(id) {
    this.loadDB();
    return this.db.users.find(u => u.id === id);
  },

  // ---- CALCULATOR ----
  calculate(dailyKWh, panelOutput, sunlightHours) {
    panelOutput = panelOutput || this.PANEL_OUTPUT_DEFAULT;
    sunlightHours = sunlightHours || this.SUNLIGHT_HOURS_DEFAULT;
    const panelsNeeded = Math.ceil(dailyKWh / (panelOutput * sunlightHours));
    const annualConsumption = dailyKWh * 365;
    const annualCost = annualConsumption * this.TARIFF_RATE;
    const annualSolarCost = panelsNeeded * this.PANEL_COST_ANNUAL;
    const annualSavings = annualCost - annualSolarCost;
    const co2Reduction = annualConsumption * this.CO2_PER_KWH;
    const currentGenerated = (panelsNeeded * panelOutput * 1000) / 230;
    return { panelsNeeded, dailyKWh, panelOutput, sunlightHours, annualConsumption, annualCost, annualSolarCost, annualSavings, co2Reduction, currentGenerated, tariff: this.TARIFF_RATE };
  },

  saveCalculation(result) {
    this.loadDB();
    const session = this.getSession();
    if (!session) return;
    const entry = { ...result, userId: session.userId, username: session.username, timestamp: new Date().toISOString() };
    this.db.calculations.push(entry);
    const user = this.db.users.find(u => u.id === session.userId);
    if (user) { user.panels = result.panelsNeeded; user.totalCurrentGenerated += result.currentGenerated; }
    this.saveDB();
    this.updateLeaderboardUser(session.userId, result.currentGenerated);
  },

  getHistory(userId) {
    this.loadDB();
    return this.db.calculations.filter(c => c.userId === userId).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  getAllCalculations() {
    this.loadDB();
    return this.db.calculations.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  // ---- LEADERBOARD ----
  seedLeaderboard() {
    if (localStorage.getItem('solarLeaderboard')) return;
    const seeds = [
      {name:'Rajesh Kumar',username:'rajesh_solar',country:'IN',flag:'🇮🇳',current:47.2,panels:12},
      {name:'Yuki Tanaka',username:'yuki_sun',country:'JP',flag:'🇯🇵',current:52.8,panels:14},
      {name:'Hans Müller',username:'hans_power',country:'DE',flag:'🇩🇪',current:38.5,panels:10},
      {name:'Sarah Johnson',username:'solar_sarah',country:'US',flag:'🇺🇸',current:61.3,panels:16},
      {name:'Emily Chen',username:'emily_green',country:'AU',flag:'🇦🇺',current:44.1,panels:11},
      {name:'Carlos Silva',username:'carlos_sol',country:'BR',flag:'🇧🇷',current:33.7,panels:9},
      {name:'James Smith',username:'james_uk',country:'GB',flag:'🇬🇧',current:29.4,panels:8},
      {name:'Aisha Mbeki',username:'aisha_sun',country:'ZA',flag:'🇿🇦',current:25.8,panels:7},
      {name:'Wei Zhang',username:'wei_solar',country:'CN',flag:'🇨🇳',current:55.6,panels:15},
      {name:'Ahmed Al-Rashid',username:'ahmed_pv',country:'AE',flag:'🇦🇪',current:41.2,panels:11},
      {name:'Priya Sharma',username:'priya_panel',country:'IN',flag:'🇮🇳',current:36.9,panels:10},
      {name:'Liam O\'Brien',username:'liam_solar',country:'IE',flag:'🇮🇪',current:22.1,panels:6},
      {name:'Sofia Rossi',username:'sofia_italia',country:'IT',flag:'🇮🇹',current:31.5,panels:8},
      {name:'Pierre Dupont',username:'pierre_sol',country:'FR',flag:'🇫🇷',current:28.3,panels:7},
      {name:'Kim Soo-jin',username:'kim_solar',country:'KR',flag:'🇰🇷',current:48.7,panels:13},
      {name:'Ana García',username:'ana_luz',country:'ES',flag:'🇪🇸',current:39.4,panels:10},
      {name:'Mohammed Ali',username:'mohammed_sun',country:'EG',flag:'🇪🇬',current:19.6,panels:5},
      {name:'Lisa Bergström',username:'lisa_sol',country:'SE',flag:'🇸🇪',current:26.2,panels:7},
      {name:'Tom Nguyen',username:'tom_solar',country:'VN',flag:'🇻🇳',current:34.8,panels:9},
      {name:'Olga Petrov',username:'olga_sun',country:'RU',flag:'🇷🇺',current:21.3,panels:6},
    ];
    const lb = seeds.map((s,i) => ({
      ...s, id: 'SEED-' + (i+1).toString().padStart(3,'0'),
      rank: i+1, status: i < 5 ? 'online' : (Math.random() > 0.5 ? 'online' : 'offline'),
      isBot: false
    }));
    localStorage.setItem('solarLeaderboard', JSON.stringify(lb));
  },

  getLeaderboard() {
    return JSON.parse(localStorage.getItem('solarLeaderboard') || '[]');
  },

  addToLeaderboard(user) {
    let lb = this.getLeaderboard();
    const existing = lb.find(e => e.id === user.id);
    if (existing) { existing.status = 'online'; existing.lastSeen = new Date().toISOString(); }
    else {
      const flags = {IN:'🇮🇳',US:'🇺🇸',GB:'🇬🇧',DE:'🇩🇪',JP:'🇯🇵',AU:'🇦🇺',BR:'🇧🇷',CN:'🇨🇳'};
      lb.push({
        id: user.id, name: user.name, username: user.username, country: user.country||'IN',
        flag: flags[user.country] || '🌍', current: user.totalCurrentGenerated || 0,
        panels: user.panels || 0, status: 'online', isBot: false, lastSeen: new Date().toISOString()
      });
    }
    lb.sort((a,b) => b.current - a.current);
    lb.forEach((e,i) => e.rank = i+1);
    localStorage.setItem('solarLeaderboard', JSON.stringify(lb));
  },

  updateLeaderboardUser(userId, currentAdd) {
    let lb = this.getLeaderboard();
    const entry = lb.find(e => e.id === userId);
    if (entry) { entry.current += currentAdd; entry.lastSeen = new Date().toISOString(); }
    lb.sort((a,b) => b.current - a.current);
    lb.forEach((e,i) => e.rank = i+1);
    localStorage.setItem('solarLeaderboard', JSON.stringify(lb));
  },

  addBotToLeaderboard() {
    let lb = this.getLeaderboard();
    const bots = ['Googlebot','Bingbot','Slurp','DuckDuckBot','Baiduspider','YandexBot','facebot','ia_archiver','AhrefsBot','SemrushBot'];
    const bot = bots[Math.floor(Math.random()*bots.length)];
    const id = 'BOT-' + Date.now().toString(36).toUpperCase();
    lb.push({
      id, name: bot, username: bot.toLowerCase().replace(/ /g,'_'), country: 'XX', flag: '🤖',
      current: Math.random()*5, panels: 0, status: 'crawling', isBot: true,
      lastSeen: new Date().toISOString()
    });
    localStorage.setItem('solarLeaderboard', JSON.stringify(lb));
  },

  // ---- PREDICTION ----
  predictVoltage(panels, hours) {
    const predictions = [];
    for (let h = 0; h < (hours||48); h++) {
      const time = new Date(); time.setHours(time.getHours() + h);
      const hourOfDay = time.getHours();
      let sunlight = 0;
      if (hourOfDay >= 6 && hourOfDay <= 18) {
        sunlight = Math.sin((hourOfDay - 6) / 12 * Math.PI);
      }
      const baseVoltage = 230;
      const solarVoltage = panels * 0.4 * sunlight * (0.9 + Math.random() * 0.2);
      const totalVoltage = baseVoltage + solarVoltage;
      const current = (panels * 0.4 * sunlight * 1000) / Math.max(totalVoltage, 1);
      const isLimitBreak = totalVoltage > 260;
      predictions.push({
        time: time.toLocaleString(), hour: hourOfDay, voltage: totalVoltage.toFixed(1),
        current: current.toFixed(2), sunlight: (sunlight*100).toFixed(0), isLimitBreak
      });
    }
    return predictions;
  },

  // ---- UI HELPERS ----
  updateNav() {
    const session = this.getSession();
    const authLinks = document.querySelectorAll('.auth-link');
    const userLinks = document.querySelectorAll('.user-link');
    const usernameEls = document.querySelectorAll('.nav-username');
    authLinks.forEach(el => el.classList.toggle('hidden', !!session));
    userLinks.forEach(el => el.classList.toggle('hidden', !session));
    usernameEls.forEach(el => { if(session) el.textContent = session.username; });
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === currentPage);
    });
  },

  toast(msg, type='info') {
    const c = document.querySelector('.toast-container') || (() => {
      const d = document.createElement('div'); d.className='toast-container'; document.body.appendChild(d); return d;
    })();
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `${type==='success'?'✅':type==='error'?'❌':'⚡'} ${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.style.animation='slideOut .4s ease forwards'; setTimeout(()=>t.remove(),400); }, 3500);
  },

  animateCounter(el, target, duration=2000, suffix='') {
    let start = 0; const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { start = target; clearInterval(timer); }
      el.textContent = (Number.isInteger(target) ? Math.floor(start) : start.toFixed(1)) + suffix;
    }, 16);
  },

  initParticles() {
    if (document.querySelector('.particles-canvas')) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'particles-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.4';
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');
    let w, h, particles = [];
    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    for (let i = 0; i < 50; i++) {
      particles.push({ x: Math.random()*w, y: Math.random()*h, r: Math.random()*2+0.5, dx: (Math.random()-.5)*.3, dy: (Math.random()-.5)*.3, o: Math.random()*.5+.1 });
    }
    function draw() {
      ctx.clearRect(0,0,w,h);
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if(p.x<0)p.x=w; if(p.x>w)p.x=0; if(p.y<0)p.y=h; if(p.y>h)p.y=0;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle = `rgba(245,158,11,${p.o})`; ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  },

  confetti() {
    const c = document.createElement('canvas');
    c.className = 'confetti'; document.body.appendChild(c);
    const ctx = c.getContext('2d');
    c.width = window.innerWidth; c.height = window.innerHeight;
    const pieces = Array.from({length:150}, () => ({
      x: Math.random()*c.width, y: Math.random()*c.height-c.height,
      r: Math.random()*8+4, dx: (Math.random()-.5)*4, dy: Math.random()*3+2,
      color: ['#f59e0b','#fbbf24','#10b981','#ef4444','#fff'][Math.floor(Math.random()*5)],
      rot: Math.random()*360, dr: (Math.random()-.5)*10
    }));
    let frames = 0;
    function animate() {
      ctx.clearRect(0,0,c.width,c.height);
      pieces.forEach(p => {
        p.x += p.dx; p.y += p.dy; p.rot += p.dr; p.dy += 0.05;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
        ctx.fillStyle = p.color; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*0.6);
        ctx.restore();
      });
      frames++;
      if(frames < 180) requestAnimationFrame(animate); else c.remove();
    }
    animate();
  },

  mobileToggle() {
    document.querySelector('.nav-links')?.classList.toggle('open');
  }
};

document.addEventListener('DOMContentLoaded', () => APP.init());