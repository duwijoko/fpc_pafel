/* ===================================================================
   FPC - FAMILY PADEL COMMUNITY
   Application Core Logic & Dynamic State Management
   Features:
   - Dynamic Schedule Management (CRUD in LocalStorage)
   - Player Booking Flow & Slot Tracking
   - Reclub Deep Link & Ecosystem Sync
   - QRIS / Payment Gateway Integration Simulation
   - Automated Digital E-Ticket & WhatsApp Share
   - Jersey Theme Switcher (Forest Emerald vs Crisp White)
   - Multi-device responsive controls
   =================================================================== */

// DEFAULT SEED DATA
// DEFAULT SEED DATA (JADWAL AKTIF RESMI FPC)
const DEFAULT_SCHEDULES = [
  {
    id: "fpc-sched-suncourt",
    title: "BEGINNER ++ UPPER BEGINNER MENS ONLY",
    date: "2026-11-14",
    time: "19:00 - 21:00 WIB",
    venue: "SUNCOURT PADEL",
    court: "TBI (To Be Inform)",
    courtCountDuration: "",
    level: "Intermediate",
    maxPlayers: 8,
    fee: "85.000",
    reclubUrl: "https://reclub.co/clubs/@family-padel-community",
    notes: "Winner Get Prize, Free mineral water Fresh Ball",
    players: []
  },
  {
    id: "fpc-sched-cibubur",
    title: "| SABTU SORE SANTAI | 📸 FG | BEGINNER FRIENDLY |",
    date: "2026-11-21",
    time: "16:00 - 18:00 WIB",
    venue: "Padel Place Cibubur",
    court: "Will be inform on Reclub",
    courtCountDuration: "3C2H",
    level: "Beginner",
    maxPlayers: 24,
    fee: "99.000",
    reclubUrl: "https://reclub.co/id/m/7LUHXX",
    notes: "Bring your own racket or rent on-site Winner 1 2 3 Gets Prize Free Mineral Water Free Snack",
    players: []
  }
];

// STATE
let schedules = [];
let currentFilter = 'all';
let currentSearchQuery = '';
let activeBookingSession = null;
let currentBookingData = null;
let timerInterval = null;
let showPastSchedules = false;

// KEAMANAN KRIPTOGRAFI PIN (SHA-256 SATU ARAH - ZERO PLAINTEXT PASSWORD)
// Hash resmi terenkripsi (tidak dapat dibaca/didekripsi balik oleh siapapun)
const DEFAULT_PIN_HASH = '877160891292d0773c67dcc913b2c239546027813b4b1571ee322f1b752ca842';

async function hashPin(pin) {
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// GITHUB CLOUD DATABASE CONFIG & STATE
let ghConfig = {
  repo: 'duwijoko/fpc_pafel',
  branch: 'main',
  path: 'data/schedules.json',
  token: '',
  sha: null
};

// INIT
document.addEventListener('DOMContentLoaded', () => {
  initGithubConfig();
  initStorage();
  initTheme();
  initAdminState();
  initLucide();
  renderSchedules();
  setupMobileDrawer();

  // Try fetching latest schedules from GitHub or local file
  fetchSchedulesFromGithub(false);

  // Set default date input in admin modal to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  const dateInput = document.getElementById('schedDate');
  if (dateInput) {
    dateInput.value = dateStr;
    dateInput.min = new Date().toISOString().split('T')[0];
  }
});

function initLucide() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

// STORAGE MANAGEMENT
function initStorage() {
  const saved = localStorage.getItem('fpc_schedules');
  if (saved) {
    try {
      schedules = JSON.parse(saved);

      // Otomatis bersihkan jika browser pengunjung menyimpan cache data demo lama
      const hasOldDemo = schedules.some(s => 
        s.id === 'fpc-sched-101' || 
        s.id === 'fpc-sched-102' || 
        s.id === 'fpc-sched-103' || 
        s.venue === 'Kemang Padel Club'
      );

      if (hasOldDemo) {
        schedules = JSON.parse(JSON.stringify(DEFAULT_SCHEDULES));
      } else {
        // Auto-correct any schedule that was saved with 99 instead of 99.000
        schedules.forEach(s => {
          if (s.fee === 99 || s.fee === '99') {
            s.fee = '99.000';
          }
        });
      }
      saveSchedules();
    } catch (e) {
      schedules = DEFAULT_SCHEDULES;
      saveSchedules();
    }
  } else {
    schedules = DEFAULT_SCHEDULES;
    saveSchedules();
  }
}

function saveSchedules() {
  localStorage.setItem('fpc_schedules', JSON.stringify(schedules));
}

// ===================================================================
// ADMIN AUTHENTICATION GATE (PENGURUS FPC ONLY)
// ===================================================================

function isAdmin() {
  return sessionStorage.getItem('fpc_admin_logged_in') === 'true';
}

function initAdminState() {
  updateAdminUI();
}

function updateAdminUI() {
  const loggedIn = isAdmin();
  const visitorBar = document.getElementById('visitorBarView');
  const adminBar = document.getElementById('adminBarView');
  const topBarBtn = document.getElementById('topBarAdminBtn');
  const mobileLabel = document.getElementById('mobileAdminLabel');

  if (visitorBar) visitorBar.style.display = loggedIn ? 'none' : 'flex';
  if (adminBar) adminBar.style.display = loggedIn ? 'flex' : 'none';
  if (topBarBtn) {
    topBarBtn.innerHTML = loggedIn 
      ? '<i data-lucide="unlock" style="width: 11px; height: 11px; display: inline-block; vertical-align: middle;"></i> Pengurus Aktif' 
      : '<i data-lucide="lock" style="width: 11px; height: 11px; display: inline-block; vertical-align: middle;"></i> Akses Admin';
  }
  if (mobileLabel) {
    mobileLabel.innerText = loggedIn ? 'Keluar Mode Pengurus' : 'Akses Pengurus FPC';
  }

  initLucide();
}

function openAdminAuthModal() {
  if (isAdmin()) {
    openAdminModal();
    return;
  }
  const modal = document.getElementById('adminAuthModal');
  const pinInput = document.getElementById('adminPinInput');
  if (pinInput) pinInput.value = '';
  modal?.classList.add('active');
  setTimeout(() => pinInput?.focus(), 150);
  initLucide();
}

function toggleAdminAuthModal() {
  if (isAdmin()) {
    if (confirm("Keluar dari Mode Pengurus / Admin FPC?")) {
      logoutAdmin();
    }
  } else {
    openAdminAuthModal();
  }
}

async function handleAdminAuthSubmit(e) {
  e.preventDefault();
  const pinInput = document.getElementById('adminPinInput');
  const enteredPin = (pinInput ? pinInput.value : '').trim();
  if (!enteredPin) return;

  const enteredHash = await hashPin(enteredPin);
  const activeHash = localStorage.getItem('fpc_admin_pin_hash') || DEFAULT_PIN_HASH;

  if (enteredHash === activeHash) {
    sessionStorage.setItem('fpc_admin_logged_in', 'true');
    updateAdminUI();
    renderSchedules();
    closeModal('adminAuthModal');
    showToast("🔓 Berhasil masuk sebagai Pengurus FPC! Tombol 'Buat Jadwal' aktif.", "success");
  } else {
    showToast("PIN Pengurus salah! Silakan periksa kembali.", "error");
    if (pinInput) {
      pinInput.value = '';
      pinInput.focus();
    }
  }
}

async function changeAdminPin() {
  const currentPin = prompt("Masukkan PIN Pengurus saat ini:");
  if (!currentPin) return;

  const currentHash = await hashPin(currentPin.trim());
  const activeHash = localStorage.getItem('fpc_admin_pin_hash') || DEFAULT_PIN_HASH;

  if (currentHash !== activeHash) {
    showToast("PIN saat ini salah!", "error");
    return;
  }

  const newPin = prompt("Masukkan PIN Pengurus baru (minimal 4 karakter / angka):");
  if (!newPin) return;

  if (newPin.trim().length < 4) {
    showToast("PIN baru terlalu pendek! Minimal 4 karakter.", "error");
    return;
  }

  const newHash = await hashPin(newPin.trim());
  localStorage.setItem('fpc_admin_pin_hash', newHash);
  localStorage.removeItem('fpc_admin_pin'); // Hapus data lama plaintext
  showToast("✅ PIN Pengurus berhasil diubah & diamankan dengan enkripsi SHA-256!", "success");
}

function logoutAdmin() {
  sessionStorage.removeItem('fpc_admin_logged_in');
  updateAdminUI();
  renderSchedules();
  showToast("Anda telah kembali ke tampilan Pengunjung biasa.", "info");
}

function resetSampleData() {
  if (confirm("Reset jadwal ke data contoh awal FPC?")) {
    schedules = JSON.parse(JSON.stringify(DEFAULT_SCHEDULES));
    saveSchedules();
    renderSchedules();
    showToast("Data contoh jadwal FPC berhasil di-reset!", "success");
  }
}

// ===================================================================
// GITHUB-AS-A-DATABASE INTEGRATION MODULE
// ===================================================================

function initGithubConfig() {
  const saved = localStorage.getItem('fpc_github_config');
  if (saved) {
    try {
      ghConfig = { ...ghConfig, ...JSON.parse(saved) };
    } catch (e) {
      console.warn("Error parsing github config:", e);
    }
  }

  // Populate config form if fields exist
  const repoInput = document.getElementById('ghRepo');
  const branchInput = document.getElementById('ghBranch');
  const pathInput = document.getElementById('ghPath');
  const tokenInput = document.getElementById('ghToken');

  if (repoInput && ghConfig.repo) repoInput.value = ghConfig.repo;
  if (branchInput && ghConfig.branch) branchInput.value = ghConfig.branch;
  if (pathInput && ghConfig.path) pathInput.value = ghConfig.path;
  if (tokenInput && ghConfig.token) tokenInput.value = ghConfig.token;

  updateGithubSyncStatusUI();
}

function saveGithubConfig() {
  localStorage.setItem('fpc_github_config', JSON.stringify(ghConfig));
  updateGithubSyncStatusUI();
}

function updateGithubSyncStatusUI(status = null, message = null) {
  const badgeLabel = document.getElementById('syncStatusLabel');
  const statusDot = document.getElementById('ghStatusDot');
  const statusText = document.getElementById('ghStatusText');

  if (status === 'syncing') {
    if (badgeLabel) badgeLabel.innerText = 'GitHub: Menyinkronkan...';
    if (statusDot) { statusDot.className = 'status-indicator-dot syncing'; }
    if (statusText) statusText.innerText = message || 'Sedang menghubungkan ke GitHub...';
    return;
  }

  if (ghConfig.repo) {
    if (badgeLabel) badgeLabel.innerHTML = `🟢 Cloud: ${escapeHtml(ghConfig.repo)}`;
    if (statusDot) { statusDot.className = 'status-indicator-dot online'; }
    if (statusText) {
      statusText.innerHTML = `Terhubung ke <strong>${escapeHtml(ghConfig.repo)}</strong> (${escapeHtml(ghConfig.branch)}). ${ghConfig.token ? 'Mode Admin (Bisa Update Langsung)' : 'Mode Publik (Read-Only)'}`;
    }
  } else {
    if (badgeLabel) badgeLabel.innerText = 'GitHub Sync: Belum Diset';
    if (statusDot) { statusDot.className = 'status-indicator-dot'; }
    if (statusText) statusText.innerText = 'Belum terhubung ke repository GitHub (Mode Penyimpanan Lokal).';
  }
}

function openGithubModal() {
  initGithubConfig();
  document.getElementById('githubModal')?.classList.add('active');
  initLucide();
}

function cleanRepoName(rawRepo) {
  if (!rawRepo) return '';
  return rawRepo
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
}

function handleGithubConfigSubmit(e) {
  e.preventDefault();
  const rawRepo = document.getElementById('ghRepo').value.trim();
  const repo = cleanRepoName(rawRepo);
  const branch = document.getElementById('ghBranch').value.trim() || 'main';
  const path = document.getElementById('ghPath').value.trim() || 'data/schedules.json';
  const token = document.getElementById('ghToken').value.trim();

  // Update input text with clean repo format
  document.getElementById('ghRepo').value = repo;

  ghConfig.repo = repo;
  ghConfig.branch = branch;
  ghConfig.path = path;
  ghConfig.token = token;

  saveGithubConfig();
  showToast("Pengaturan GitHub berhasil disimpan!", "success");
  fetchSchedulesFromGithub(true);
}

// FETCH SCHEDULES FROM GITHUB REPO
async function fetchSchedulesFromGithub(isManual = false) {
  if (!ghConfig.repo) {
    if (isManual) {
      showToast("Silakan masukkan nama repository GitHub terlebih dahulu.", "error");
    }
    return;
  }

  // Auto clean repo name
  ghConfig.repo = cleanRepoName(ghConfig.repo);

  updateGithubSyncStatusUI('syncing', `Mengambil jadwal terbaru dari GitHub ${ghConfig.repo}...`);

  try {
    // Attempt via GitHub Contents API first (to get file SHA)
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (ghConfig.token) {
      headers['Authorization'] = `token ${ghConfig.token}`;
    }

    const apiUrl = `https://api.github.com/repos/${ghConfig.repo}/contents/${ghConfig.path}?ref=${ghConfig.branch}&t=${Date.now()}`;
    const response = await fetch(apiUrl, { headers });

    if (response.ok) {
      const data = await response.json();
      ghConfig.sha = data.sha; // Save SHA for future commits

      // Decode base64 content
      const decodedContent = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
      const parsedSchedules = JSON.parse(decodedContent);

      if (Array.isArray(parsedSchedules)) {
        schedules = parsedSchedules;
        saveSchedules();
        renderSchedules();
        updateGithubSyncStatusUI('online');
        if (isManual) showToast(`Berhasil menarik ${schedules.length} jadwal dari GitHub!`, "success");
        return;
      }
    } else if (response.status === 404 && ghConfig.token) {
      // File data/schedules.json belum ada di GitHub, inisialisasi otomatis!
      console.log("File data/schedules.json belum ada di repo. Menginisialisasi otomatis ke GitHub...");
      await commitSchedulesToGithub("Inisialisasi database jadwal FPC data/schedules.json");
      if (isManual) showToast("🎉 File database jadwal berhasil dibuat otomatis di GitHub Anda!", "success");
      return;
    } else {
      // Fallback 1: try raw github user content (fast CDN)
      try {
        const rawUrl = `https://raw.githubusercontent.com/${ghConfig.repo}/${ghConfig.branch}/${ghConfig.path}?t=${Date.now()}`;
        const rawResp = await fetch(rawUrl);
        if (rawResp.ok) {
          const rawJson = await rawResp.json();
          if (Array.isArray(rawJson)) {
            schedules = rawJson;
            saveSchedules();
            renderSchedules();
            updateGithubSyncStatusUI('online');
            if (isManual) showToast(`Berhasil memuat ${schedules.length} jadwal dari GitHub Raw!`, "success");
            return;
          }
        }
      } catch (rawErr) {
        console.warn("Raw github fetch error:", rawErr);
      }

      // Fallback 2: try relative domain path (e.g. https://fpc.web.id/data/schedules.json)
      try {
        const relativeUrl = `./${ghConfig.path}?t=${Date.now()}`;
        const relResp = await fetch(relativeUrl);
        if (relResp.ok) {
          const relJson = await relResp.json();
          if (Array.isArray(relJson)) {
            schedules = relJson;
            saveSchedules();
            renderSchedules();
            updateGithubSyncStatusUI('online');
            if (isManual) showToast(`Berhasil memuat ${schedules.length} jadwal dari web server!`, "success");
            return;
          }
        }
      } catch (relErr) {
        console.warn("Relative path fetch error:", relErr);
      }

      throw new Error(`Status ${response.status}: ${response.statusText}`);
    }
  } catch (err) {
    console.error("Gagal sinkronisasi dengan GitHub:", err);
    updateGithubSyncStatusUI();
    if (isManual) {
      showToast(`Gagal membaca data dari GitHub: ${err.message}`, "error");
    }
  }
}

// COMMIT UPDATES DIRECTLY TO GITHUB REPOSITORY
async function commitSchedulesToGithub(commitMessage = "Update jadwal mabar FPC via Website") {
  ghConfig.repo = cleanRepoName(ghConfig.repo);

  if (!ghConfig.repo) {
    saveSchedules();
    renderSchedules();
    showToast("Jadwal tersimpan di penyimpanan lokal.", "success");
    return;
  }

  if (!ghConfig.token) {
    saveSchedules();
    renderSchedules();
    showToast("Jadwal tersimpan lokal. Masukkan GitHub Token di menu 'GitHub Sync' agar otomatis ter-commit ke Cloud GitHub.", "info");
    return;
  }

  updateGithubSyncStatusUI('syncing', 'Mengirim commit perubahan ke GitHub...');

  try {
    const jsonStr = JSON.stringify(schedules, null, 2);
    // Safe UTF-8 Base64 encoding
    const contentBase64 = btoa(unescape(encodeURIComponent(jsonStr)));

    // Prepare body
    const bodyPayload = {
      message: commitMessage,
      content: contentBase64,
      branch: ghConfig.branch
    };

    if (ghConfig.sha) {
      bodyPayload.sha = ghConfig.sha;
    } else {
      // Fetch latest SHA first to prevent conflicts
      const checkResp = await fetch(`https://api.github.com/repos/${ghConfig.repo}/contents/${ghConfig.path}?ref=${ghConfig.branch}`, {
        headers: {
          'Authorization': `token ${ghConfig.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (checkResp.ok) {
        const checkData = await checkResp.json();
        bodyPayload.sha = checkData.sha;
      }
    }

    const putResp = await fetch(`https://api.github.com/repos/${ghConfig.repo}/contents/${ghConfig.path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${ghConfig.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(bodyPayload)
    });

    if (putResp.ok) {
      const putData = await putResp.json();
      ghConfig.sha = putData.content?.sha;
      saveGithubConfig();
      saveSchedules();
      renderSchedules();
      updateGithubSyncStatusUI('online');
      showToast("🚀 Jadwal berhasil di-update & di-commit langsung ke GitHub Cloud!", "success");
    } else {
      const errData = await putResp.json();
      throw new Error(errData.message || 'Gagal commit ke GitHub');
    }
  } catch (err) {
    console.error("Gagal commit ke GitHub:", err);
    saveSchedules();
    renderSchedules();
    updateGithubSyncStatusUI('online');
    showToast(`Tersimpan lokal, namun gagal commit ke GitHub: ${err.message}`, "error");
  }
}

// THEME SWITCHER (Forest Emerald Home vs Crisp White Away)
function initTheme() {
  const savedTheme = localStorage.getItem('fpc_theme') || 'theme-forest';
  applyTheme(savedTheme);

  document.getElementById('btnThemeForest')?.addEventListener('click', () => applyTheme('theme-forest'));
  document.getElementById('btnThemeWhite')?.addEventListener('click', () => applyTheme('theme-white'));
}

function applyTheme(themeName) {
  document.body.classList.remove('theme-forest', 'theme-white');
  document.body.classList.add(themeName);
  localStorage.setItem('fpc_theme', themeName);

  const btnForest = document.getElementById('btnThemeForest');
  const btnWhite = document.getElementById('btnThemeWhite');
  if (btnForest && btnWhite) {
    if (themeName === 'theme-forest') {
      btnForest.classList.add('active');
      btnWhite.classList.remove('active');
    } else {
      btnWhite.classList.add('active');
      btnForest.classList.remove('active');
    }
  }
}

// MOBILE DRAWER
function setupMobileDrawer() {
  const toggleBtn = document.getElementById('menuToggle');
  const drawer = document.getElementById('mobileDrawer');
  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', () => {
      drawer.classList.toggle('open');
    });
  }
}

function closeDrawer() {
  document.getElementById('mobileDrawer')?.classList.remove('open');
}

// RENDER SCHEDULES
function renderSchedules() {
  const container = document.getElementById('scheduleCardsContainer');
  if (!container) return;

  // Tanggal hari ini lokal (YYYY-MM-DD)
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Filter & Search (Otomatis sembunyikan jadwal yang tanggalnya sudah lewat)
  let filtered = schedules.filter(session => {
    // Pengecekan tanggal kedaluwarsa
    if (!showPastSchedules && session.date && session.date < todayStr) {
      return false; // Otomatis sembunyikan jika tanggal sesi sudah lewat
    }

    const matchFilter = (currentFilter === 'all') || (session.level.toLowerCase().includes(currentFilter.toLowerCase()));
    const q = currentSearchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      session.title.toLowerCase().includes(q) || 
      session.venue.toLowerCase().includes(q) ||
      session.date.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  // Urutkan jadwal secara kronologis: tanggal paling dekat muncul di depan (Ascending)
  filtered.sort((a, b) => {
    const dateA = new Date(a.date).getTime() || 0;
    const dateB = new Date(b.date).getTime() || 0;
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    // Jika tanggal sama, urutkan berdasarkan jam mulai
    return (a.time || '').localeCompare(b.time || '');
  });

  if (filtered.length === 0) {
    const hasPast = schedules.some(s => s.date && s.date < todayStr);
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 1.5rem; background: #fff; border-radius: 16px; border: 1px dashed var(--fpc-border); box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
        <i data-lucide="calendar-clock" style="width: 52px; height: 52px; color: var(--fpc-gold); margin-bottom: 1rem;"></i>
        <h3 style="color: var(--fpc-forest-dark); font-size: 1.35rem;">Belum Ada Jadwal Sesi Mendatang</h3>
        <p class="text-muted" style="margin-top: 0.5rem; max-width: 520px; margin-left: auto; margin-right: auto; line-height: 1.6; font-size: 0.95rem;">
          Semua sesi mabar terdekat telah selesai atau sedang dalam persiapan oleh Pengurus FPC. Silakan pantau terus jadwal sesi baru dan gabung klub FPC di aplikasi Reclub!
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; margin-top: 1.5rem;">
          <a href="https://reclub.co/clubs/@family-padel-community" target="_blank" rel="noopener noreferrer" class="btn btn-gold btn-sm">
            <i data-lucide="external-link"></i> Buka Klub FPC di Reclub
          </a>
          ${isAdmin() ? `
            <button class="btn btn-forest btn-sm" onclick="openAdminModal()">
              <i data-lucide="plus-circle"></i> + Buat Jadwal Baru (Admin)
            </button>
            ${hasPast ? `
              <button class="btn btn-outline btn-sm" onclick="togglePastSchedules()">
                <i data-lucide="history"></i> ${showPastSchedules ? 'Sembunyikan Sesi Lalu' : 'Lihat Riwayat Sesi Lalu'}
              </button>
            ` : ''}
          ` : ''}
        </div>
      </div>
    `;
    initLucide();
    return;
  }

  // Generate cards
  container.innerHTML = filtered.map(item => {
    const filledCount = item.players ? item.players.length : 0;
    const isFull = filledCount >= item.maxPlayers;
    const slotsRemaining = item.maxPlayers - filledCount;
    const fillPercent = Math.min(100, Math.round((filledCount / item.maxPlayers) * 100));

    // Badge styling
    let badgeClass = 'level-all';
    if (item.level.toLowerCase().includes('beginner')) badgeClass = 'level-beginner';
    else if (item.level.toLowerCase().includes('intermediate')) badgeClass = 'level-intermediate';
    else if (item.level.toLowerCase().includes('family')) badgeClass = 'level-family';

    // Format Indonesian Date
    const formattedDate = formatDateIndo(item.date);

    // Format currency / free text fee
    const formattedFee = formatFeeDisplay(item.fee);

    // Avatar initials list
    const avatarsHtml = (item.players || []).map((p, idx) => {
      const initials = getInitials(p.name);
      return `<div class="avatar-chip ${idx % 2 === 1 ? 'gold-chip' : ''}" title="${escapeHtml(p.name)} (${p.level})">${initials}</div>`;
    }).join('');

    return `
      <div class="schedule-card" id="card-${item.id}">
        <div class="schedule-card-header">
          <div>
            <span class="schedule-meta-badge ${badgeClass}">${item.level}</span>
            <h3 style="font-size: 1.15rem; color: #fff; margin-top: 0.5rem;">${escapeHtml(item.title)}</h3>
          </div>
          ${isAdmin() ? `
            <button class="btn-xs btn-glass" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;" onclick="deleteSchedule('${item.id}')" title="Hapus Jadwal (Khusus Admin)">
              <i data-lucide="trash-2"></i>
            </button>
          ` : ''}
        </div>

        <div class="schedule-card-body">
          <div class="session-info-line">
            <i data-lucide="calendar"></i>
            <span><strong>${formattedDate}</strong></span>
          </div>
          <div class="session-info-line">
            <i data-lucide="clock"></i>
            <span>${escapeHtml(item.time)}</span>
          </div>
          <div class="session-info-line">
            <i data-lucide="map-pin"></i>
            <span><strong>${escapeHtml(item.venue)}</strong> &bull; ${escapeHtml(item.court || 'Court Arena')}</span>
          </div>
          ${item.courtCountDuration ? `
            <div class="session-info-line">
              <i data-lucide="layout-grid"></i>
              <span><strong>Jumlah Lapangan & Durasi:</strong> ${escapeHtml(item.courtCountDuration)}</span>
            </div>
          ` : ''}

          ${item.notes ? `
            <p class="text-xs text-muted" style="background: #f8faf9; padding: 0.6rem; border-radius: 8px; border-left: 3px solid var(--fpc-gold);">
              <i data-lucide="info" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle;"></i> ${escapeHtml(item.notes)}
            </p>
          ` : ''}

          <!-- Informasi Slot Reclub -->
          <div class="reclub-slot-notice">
            <i data-lucide="flame" class="notice-flame-icon"></i>
            <span>Slot Terbatas, Segera Join Reclub Sekarang</span>
          </div>
        </div>

        <div class="schedule-card-footer">
          <div class="fee-display">
            <span class="fee-label">Biaya per Orang</span>
            <span class="fee-val">${formattedFee}</span>
          </div>
          
          <a href="${escapeHtml(item.reclubUrl || 'https://reclub.co/clubs/@family-padel-community')}" target="_blank" rel="noopener noreferrer" class="btn btn-gold btn-sm" style="text-decoration: none;">
            <i data-lucide="external-link"></i> Join Sesi di Reclub
          </a>
        </div>
      </div>
    `;
  }).join('');

  initLucide();
}

// FILTER & SEARCH
function filterSchedules(category, element) {
  currentFilter = category;
  document.querySelectorAll('.filter-pill').forEach(el => el.classList.remove('active'));
  if (element) element.classList.add('active');
  renderSchedules();
}

function searchSchedules(val) {
  currentSearchQuery = val;
  renderSchedules();
}

function togglePastSchedules() {
  showPastSchedules = !showPastSchedules;
  renderSchedules();
  showToast(showPastSchedules ? "Menampilkan seluruh riwayat sesi (termasuk yang telah lewat)." : "Hanya menampilkan sesi mabar aktif mendatang.", "info");
}

// ADMIN MODAL & ADD SCHEDULE
function openAdminModal() {
  if (!isAdmin()) {
    openAdminAuthModal();
    return;
  }
  document.getElementById('adminModal')?.classList.add('active');
  initLucide();
}

// QUICK TIME PRESET PICKER
function setTimePreset(start, end) {
  const startEl = document.getElementById('schedStartTime');
  const endEl = document.getElementById('schedEndTime');
  if (startEl && endEl) {
    startEl.value = start;
    endEl.value = end;
  }
  document.querySelectorAll('.preset-tag').forEach(tag => {
    if (tag.innerText.includes(`${start}-${end}`)) {
      tag.classList.add('active');
    } else {
      tag.classList.remove('active');
    }
  });
}

function handleScheduleSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('schedTitle').value.trim();
  const date = document.getElementById('schedDate').value;

  // Read structured time inputs
  const startTime = document.getElementById('schedStartTime')?.value || '19:00';
  const endTime = document.getElementById('schedEndTime')?.value || '21:00';

  if (startTime === endTime) {
    showToast("Jam mulai dan jam selesai tidak boleh sama!", "error");
    return;
  }

  const time = `${startTime} - ${endTime} WIB`;
  const venue = document.getElementById('schedVenue').value.trim();
  const court = document.getElementById('schedCourt').value.trim();
  const courtCountDuration = document.getElementById('schedCourtCountDuration')?.value.trim() || '';
  const level = document.getElementById('schedLevel').value;
  const maxPlayers = parseInt(document.getElementById('schedMaxPlayers').value, 10) || 4;
  const fee = document.getElementById('schedFee').value.trim() || '0';
  const reclubUrl = document.getElementById('schedReclubUrl').value.trim() || 'https://reclub.co/clubs/@family-padel-community';
  const notes = document.getElementById('schedNotes').value.trim();

  const newSchedule = {
    id: 'fpc-sched-' + Date.now(),
    title,
    date,
    time,
    venue,
    court,
    courtCountDuration,
    level,
    maxPlayers,
    fee,
    reclubUrl,
    notes,
    players: []
  };

  schedules.unshift(newSchedule);
  closeModal('adminModal');

  // Commit to GitHub Cloud if configured, or save locally
  commitSchedulesToGithub(`Tambah jadwal FPC: ${title} (${date})`);

  // Reset Form
  document.getElementById('formAddSchedule').reset();
  const sTime = document.getElementById('schedStartTime');
  const eTime = document.getElementById('schedEndTime');
  if (sTime) sTime.value = '19:00';
  if (eTime) eTime.value = '21:00';
}

function deleteSchedule(id) {
  const target = schedules.find(s => s.id === id);
  const targetTitle = target ? target.title : 'Sesi Padel';

  if (confirm(`Apakah Anda yakin ingin menghapus jadwal "${targetTitle}"?`)) {
    schedules = schedules.filter(s => s.id !== id);
    commitSchedulesToGithub(`Hapus jadwal FPC: ${targetTitle}`);
  }
}

// JOIN MODAL FLOW
function openJoinModal(scheduleId) {
  activeBookingSession = schedules.find(s => s.id === scheduleId);
  if (!activeBookingSession) return;

  if (activeBookingSession.players && activeBookingSession.players.length >= activeBookingSession.maxPlayers) {
    showToast("Maaf, slot untuk sesi ini sudah terisi penuh!", "error");
    return;
  }

  // Populate brief box
  const briefBox = document.getElementById('joinBriefBox');
  const formattedFee = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(activeBookingSession.fee);
  
  briefBox.innerHTML = `
    <div>
      <h4 style="font-size: 0.95rem; color: var(--fpc-forest);">${escapeHtml(activeBookingSession.title)}</h4>
      <p class="text-xs text-muted" style="margin-top: 0.2rem;">
        <i data-lucide="map-pin" style="width: 12px; height: 12px;"></i> ${escapeHtml(activeBookingSession.venue)} (${escapeHtml(activeBookingSession.court)}) &bull; <strong>${formatDateIndo(activeBookingSession.date)}</strong>
      </p>
    </div>
    <div style="text-align: right;">
      <span class="text-xs text-muted">Biaya Slot:</span>
      <div style="font-weight: 800; color: var(--fpc-gold-dark);">${formattedFee}</div>
    </div>
  `;

  // Set direct Reclub link if available
  const reclubBtn = document.getElementById('btnDirectReclubLink');
  if (reclubBtn) {
    reclubBtn.href = activeBookingSession.reclubUrl || 'https://reclub.co/clubs/@family-padel-community';
  }

  // Set price in step 2
  const payTotal = document.getElementById('payTotalAmount');
  if (payTotal) payTotal.innerText = formattedFee;

  goToStep(1);
  document.getElementById('joinModal')?.classList.add('active');
  initLucide();
}

function goToStep(stepNum) {
  document.getElementById('joinStep1').style.display = stepNum === 1 ? 'block' : 'none';
  document.getElementById('joinStep2').style.display = stepNum === 2 ? 'block' : 'none';
  document.getElementById('joinStep3').style.display = stepNum === 3 ? 'block' : 'none';

  // Indicators
  const s1 = document.getElementById('step1Indicator');
  const s2 = document.getElementById('step2Indicator');
  const s3 = document.getElementById('step3Indicator');

  s1.classList.remove('active');
  s2.classList.remove('active');
  s3.classList.remove('active');

  if (stepNum >= 1) s1.classList.add('active');
  if (stepNum >= 2) s2.classList.add('active');
  if (stepNum >= 3) s3.classList.add('active');

  initLucide();
}

function goToPaymentStep(e) {
  e.preventDefault();

  const playerName = document.getElementById('joinPlayerName').value.trim();
  const playerWa = document.getElementById('joinPlayerWa').value.trim();
  const playerLevel = document.getElementById('joinPlayerLevel').value;
  const reclubUser = document.getElementById('joinReclubUsername').value.trim();
  const notes = document.getElementById('joinPlayerNotes').value.trim();

  currentBookingData = {
    name: playerName,
    phone: playerWa,
    level: playerLevel,
    reclubUser,
    notes,
    bookingCode: 'FPC-' + Math.floor(10000 + Math.random() * 90000),
    paymentMethod: 'QRIS Instan'
  };

  startPaymentTimer();
  goToStep(2);
}

function selectPaymentMethod(method, el) {
  document.querySelectorAll('.payment-option').forEach(opt => {
    opt.classList.remove('selected');
    opt.querySelector('.radio-circle')?.classList.remove('checked');
  });

  el.classList.add('selected');
  el.querySelector('.radio-circle')?.classList.add('checked');

  if (currentBookingData) {
    if (method === 'qris') currentBookingData.paymentMethod = 'QRIS Instan';
    else if (method === 'bca') currentBookingData.paymentMethod = 'Bank BCA (Virtual Account)';
    else currentBookingData.paymentMethod = 'Bayar di Lapangan (Cash)';
  }
}

function startPaymentTimer() {
  if (timerInterval) clearInterval(timerInterval);
  let totalSeconds = 15 * 60; // 15 mins
  const timerEl = document.getElementById('payTimer');

  timerInterval = setInterval(() => {
    totalSeconds--;
    if (totalSeconds <= 0) {
      clearInterval(timerInterval);
      if (timerEl) timerEl.innerText = '00:00 (Kadaluarsa)';
      return;
    }
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (timerEl) {
      timerEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

function confirmPaymentAndFinish() {
  if (!activeBookingSession || !currentBookingData) return;

  // Add player to session in state
  if (!activeBookingSession.players) activeBookingSession.players = [];
  activeBookingSession.players.push({
    name: currentBookingData.name,
    level: currentBookingData.level,
    phone: currentBookingData.phone,
    reclubUser: currentBookingData.reclubUser
  });

  saveSchedules();
  renderSchedules();

  // Populate digital ticket
  document.getElementById('ticketSessionName').innerText = activeBookingSession.title;
  document.getElementById('ticketPlayerName').innerText = currentBookingData.name;
  document.getElementById('ticketPlayerLevel').innerText = currentBookingData.level;
  document.getElementById('ticketDateTime').innerText = `${formatDateIndo(activeBookingSession.date)} &bull; ${activeBookingSession.time}`;
  document.getElementById('ticketVenue').innerText = `${activeBookingSession.venue} (${activeBookingSession.court || 'Court 1'})`;
  document.getElementById('ticketBookingCode').innerText = currentBookingData.bookingCode;

  if (timerInterval) clearInterval(timerInterval);

  goToStep(3);
  showToast("Selamat! Slot kamu berhasil dikonfirmasi.", "success");
}

function shareTicketToWhatsApp() {
  if (!activeBookingSession || !currentBookingData) return;

  const msg = 
`*TIKET RESMI JADWAL FAMILY PADEL COMMUNITY (FPC)* 🎾
================================
✅ *Status:* Terkonfirmasi
🔖 *Kode Booking:* ${currentBookingData.bookingCode}
👤 *Nama Pemain:* ${currentBookingData.name} (${currentBookingData.level})
📅 *Jadwal:* ${formatDateIndo(activeBookingSession.date)}
⏰ *Waktu:* ${activeBookingSession.time}
📍 *Venue:* ${activeBookingSession.venue} - ${activeBookingSession.court}
💳 *Metode Pembayaran:* ${currentBookingData.paymentMethod}

*Catatan Lapangan:*
Harap datang 15 menit sebelum sesi dimulai menggunakan jersey FPC (Forest Green atau Pinstripe White).
Sampai jumpa di lapangan! 🏸🏆`;

  const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
}

// MODAL UTILS
function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
  if (timerInterval) clearInterval(timerInterval);
}

function handleBackdropClick(e, modalId) {
  if (e.target.id === modalId) {
    closeModal(modalId);
  }
}

// TOAST NOTIFICATIONS
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" style="width: 18px; height: 18px; color: ${type === 'success' ? '#10b981' : '#ef4444'};"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  initLucide();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// HELPERS
function formatDateIndo(dateStr) {
  if (!dateStr) return '';
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const dayName = days[d.getDay()];
  const dayNum = d.getDate();
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();

  return `${dayName}, ${dayNum} ${monthName} ${year}`;
}

function getInitials(name) {
  if (!name) return 'FP';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatFeeDisplay(fee) {
  if (fee === undefined || fee === null || fee === '') return 'Gratis';
  let str = String(fee).trim();

  // If already contains "Rp"
  if (/^rp/i.test(str)) {
    return str;
  }

  // If user entered Indonesian dot format (e.g. "99.000", "85.000")
  if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
    return `Rp ${str}`;
  }

  // If purely numeric digits like 99000 or "99000"
  if (/^\d+$/.test(str)) {
    let num = parseInt(str, 10);
    // Auto-fix if someone accidentally saved 99 instead of 99.000
    if (num > 0 && num < 1000) {
      num = num * 1000;
    }
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  }

  return str;
}

function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
