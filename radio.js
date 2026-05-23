/* ── Quran Radio — Shared Logic ── */
/* Expects window.RADIO_CONFIG to be defined before this script runs */

const STATIONS_URL = 'https://gist.githubusercontent.com/mohamedtaha991/043176db5b9fd099e25eb2be7b89c303/raw/stations.json';

const COUNTRY_ICONS = {
  // Arabic
  'مصر': '🇪🇬', 'المملكة العربية السعودية': '🇸🇦', 'الإمارات العربية المتحدة': '🇦🇪',
  'المغرب': '🇲🇦', 'الجزائر': '🇩🇿', 'فلسطين': '🇵🇸', 'الأردن': '🇯🇴',
  'الكويت': '🇰🇼', 'قطر': '🇶🇦', 'البحرين': '🇧🇭', 'عُمان': '🇴🇲',
  'تونس': '🇹🇳', 'ليبيا': '🇱🇾', 'إذاعات خاصة': '🎙',
  // English
  'Egypt': '🇪🇬', 'Saudi Arabia': '🇸🇦', 'UAE': '🇦🇪', 'Morocco': '🇲🇦',
  'Algeria': '🇩🇿', 'Palestine': '🇵🇸', 'Jordan': '🇯🇴', 'Kuwait': '🇰🇼',
  'Qatar': '🇶🇦', 'Bahrain': '🇧🇭', 'Oman': '🇴🇲', 'Tunisia': '🇹🇳',
  'Libya': '🇱🇾', 'Special Stations': '🎙',
};

function getIcon(s) {
  const c = s[RADIO_CONFIG.countryField] || s.country || s.En_country || '';
  return COUNTRY_ICONS[c] || '📡';
}

let stations    = [];
let current     = null;
let isPlaying   = false;
let activeFilter = 'all';

const cfg = window.RADIO_CONFIG;

const audio         = document.getElementById('audioPlayer');
const btnPlay       = document.getElementById('btnPlay');
const volSlider     = document.getElementById('volume');
const volIcon       = document.getElementById('volIcon');
const statusEl      = document.getElementById('statusText');
const nowName       = document.getElementById('nowName');
const nowCountry    = document.getElementById('nowCountry');
const avatar        = document.getElementById('avatar');
const liveLabel     = document.getElementById('liveLabel');
const liveLabelText = document.getElementById('liveLabelText');
const eqBars        = document.getElementById('eqBars');
const overlay       = document.getElementById('overlay');
const toastEl       = document.getElementById('toast');
const grid          = document.getElementById('grid');
const noResults     = document.getElementById('noResults');

function buildFilters() {
  const countries = ['all', ...new Set(stations.map(s => s.country))];
  const wrap = document.getElementById('filterBtns');
  wrap.innerHTML = '';
  countries.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (c === 'all' ? ' active' : '');
    btn.textContent = c === 'all' ? cfg.allLabel : c;
    btn.dataset.val = c;
    btn.onclick = () => {
      activeFilter = c;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.val === c));
      renderGrid();
    };
    wrap.appendChild(btn);
  });
}

function renderGrid() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  grid.innerHTML = '';
  let count = 0;
  stations.forEach(s => {
    const matchFilter = activeFilter === 'all' || s.country === activeFilter;
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.country.toLowerCase().includes(q);
    if (!matchFilter || !matchSearch) return;
    count++;
    const card = document.createElement('div');
    card.className = 'station-card' + (current && current.id === s.id ? ' active' : '');
    card.innerHTML = `
      <div class="card-icon">${s.icon}</div>
      <div class="card-body">
        <div class="card-name">${s.name}</div>
        <div class="card-country"><span class="country-badge">${s.country}</span></div>
      </div>
      <div class="card-action">${current && current.id === s.id && isPlaying ? '⏸' : '▶'}</div>
    `;
    card.onclick = () => selectStation(s);
    grid.appendChild(card);
  });
  noResults.classList.toggle('show', count === 0);
}

function selectStation(s) {
  if (current && current.id === s.id) { togglePlay(); return; }
  current = s;
  btnPlay.disabled = false;
  updateNowPlaying();
  startStream();
}

let hlsInstance = null;

function startStream() {
  showOverlay(true);
  audio.volume = parseFloat(volSlider.value);

  // Destroy any previous HLS instance
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }

  const isHLS = current.url.includes('.m3u8');

  if (isHLS && typeof Hls !== 'undefined' && Hls.isSupported()) {
    hlsInstance = new Hls();
    hlsInstance.loadSource(current.url);
    hlsInstance.attachMedia(audio);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      audio.play()
        .then(() => { showOverlay(false); setPlaying(true); })
        .catch(err => { showOverlay(false); showToast(cfg.connectErrorMsg); console.error(err); });
    });
    hlsInstance.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) { showOverlay(false); setPlaying(false); showToast(cfg.streamErrorMsg); }
    });
  } else {
    // Native playback (MP3 / AAC) or Safari native HLS
    audio.src = current.url;
    audio.load();
    audio.play()
      .then(() => { showOverlay(false); setPlaying(true); })
      .catch(err => { showOverlay(false); showToast(cfg.connectErrorMsg); console.error(err); });
  }
}

function togglePlay() {
  if (!current) return;
  if (isPlaying) { audio.pause(); setPlaying(false); }
  else startStream();
}

function setPlaying(val) {
  isPlaying = val;
  btnPlay.textContent  = val ? '⏸' : '▶';
  statusEl.textContent = val ? cfg.liveMsg : cfg.stoppedMsg;
  avatar.classList.toggle('playing', val);
  eqBars.classList.toggle('active', val);
  liveLabel.classList.toggle('idle', !val);
  liveLabelText.textContent = val ? cfg.nowPlayingMsg : cfg.stoppedLabelMsg;
  renderGrid();
}

function updateNowPlaying() {
  nowName.textContent    = current.name;
  nowCountry.textContent = current.country;
  avatar.innerHTML       = current.icon;
  liveLabel.classList.remove('idle');
  liveLabelText.textContent = cfg.connectingMsg;
}

function showOverlay(val) { overlay.classList.toggle('show', val); }

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3200);
}

volSlider.addEventListener('input', () => {
  const v = parseFloat(volSlider.value);
  audio.volume = v;
  volIcon.textContent = v === 0 ? '🔇' : v < 0.5 ? '🔉' : '🔊';
});

btnPlay.addEventListener('click', togglePlay);
audio.addEventListener('error',   () => { showOverlay(false); setPlaying(false); showToast(cfg.streamErrorMsg); });
audio.addEventListener('waiting', () => { statusEl.textContent = cfg.bufferingMsg; });
audio.addEventListener('playing', () => { statusEl.textContent = cfg.liveMsg; });
document.getElementById('search').addEventListener('input', renderGrid);

// ── Init ──
async function init() {
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:60px 20px;font-size:15px;">${cfg.loadingMsg}</div>`;
  try {
    const res = await fetch(STATIONS_URL);
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    stations = data.map(s => ({
      id:      s.id,
      name:    s[cfg.nameField]    || s.name,
      country: s[cfg.countryField] || s.country,
      url:     s.stream_url,
      icon:    getIcon(s),
    }));
  } catch (e) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#f87171;padding:60px 20px;font-size:15px;">${cfg.errorMsg}</div>`;
    console.error(e);
    return;
  }
  buildFilters();
  renderGrid();
}

init();
