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
const DEFAULT_SCHEDULES = [
  {
    id: "fpc-sched-101",
    title: "Weekend Morning Family Padel & Fun Sparring",
    date: "2026-11-07",
    time: "07:00 - 09:00 WIB",
    venue: "Kemang Padel Club",
    court: "Court 1 & 2 (Panoramic)",
    level: "Family Fun",
    maxPlayers: 8,
    fee: 125000,
    reclubUrl: "https://reclub.co",
    notes: "Sesi santai keluarga, termasuk coaching tips bagi pemula & anak-anak. Fresh balls Bullpadel included.",
    players: [
      { name: "Dimas Joko", level: "Intermediate", phone: "081288991122" },
      { name: "Sarah Amalia", level: "Beginner", phone: "081399882233" },
      { name: "Rian Pratama", level: "Intermediate", phone: "081512345678" },
      { name: "Citra Kirana", level: "Family Fun", phone: "081298765432" },
      { name: "Budi Santoso", level: "Beginner", phone: "081765432109" }
    ]
  },
  {
    id: "fpc-sched-102",
    title: "Beginner Clinic & Rally Fundamentals",
    date: "2026-11-08",
    time: "16:00 - 18:00 WIB",
    venue: "Cilandak Padel Arena",
    court: "Court 3",
    level: "Beginner",
    maxPlayers: 4,
    fee: 150000,
    reclubUrl: "https://reclub.co",
    notes: "Dipandu oleh Coach FPC bersertifikat. Fokus pada teknik pegangan raket, posisi dinding kaca (cristal), dan serve.",
    players: [
      { name: "Kevin Sanjaya", level: "Beginner", phone: "081122334455" },
      { name: "Nadia Utami", level: "Beginner", phone: "081233445566" }
    ]
  },
  {
    id: "fpc-sched-103",
    title: "Intermediate Competitive Sparring Night",
    date: "2026-11-10",
    time: "19:00 - 21:00 WIB",
    venue: "BSD Padel Center",
    court: "Court 1",
    level: "Intermediate",
    maxPlayers: 4,
    fee: 140000,
    reclubUrl: "https://reclub.co",
    notes: "Match kompetitif ramah FPC. Format Americano / Mini Tournament dengan sistem rotasi poin.",
    players: [
      { name: "Ardiansyah", level: "Intermediate", phone: "081311223344" },
      { name: "Fajar Alfian", level: "Intermediate", phone: "081422334455" },
      { name: "Hendra Setiawan", level: "Intermediate", phone: "081533445566" }
    ]
  }
];

// STATE
let schedules = [];
let currentFilter = 'all';
let currentSearchQuery = '';
let activeBookingSession = null;
let currentBookingData = null;
let timerInterval = null;

// GITHUB CLOUD DATABASE CONFIG & STATE
let ghConfig = {
  repo: '',
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

function handleGithubConfigSubmit(e) {
  e.preventDefault();
  const repo = document.getElementById('ghRepo').value.trim();
  const branch = document.getElementById('ghBranch').value.trim() || 'main';
  const path = document.getElementById('ghPath').value.trim() || 'data/schedules.json';
  const token = document.getElementById('ghToken').value.trim();

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
    } else {
      // Fallback: try raw github user content (fast CDN)
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

  // Filter & Search
  let filtered = schedules.filter(session => {
    const matchFilter = (currentFilter === 'all') || (session.level.toLowerCase().includes(currentFilter.toLowerCase()));
    const q = currentSearchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      session.title.toLowerCase().includes(q) || 
      session.venue.toLowerCase().includes(q) ||
      session.date.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: #fff; border-radius: 16px; border: 1px dashed var(--fpc-border);">
        <i data-lucide="calendar-x" style="width: 48px; height: 48px; color: var(--fpc-gold); margin-bottom: 0.75rem;"></i>
        <h3 style="color: var(--fpc-forest-dark);">Belum Ada Jadwal Yang Sesuai</h3>
        <p class="text-muted" style="margin-top: 0.35rem;">Coba ubah kata kunci pencarian atau buat jadwal baru melalui tombol Input Jadwal.</p>
        <button class="btn btn-gold btn-sm mt-3" onclick="openAdminModal()">
          <i data-lucide="plus-circle"></i> Buat Jadwal Baru
        </button>
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

    // Format currency
    const formattedFee = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.fee);

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
          <button class="btn-xs btn-glass" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;" onclick="deleteSchedule('${item.id}')" title="Hapus Jadwal (Admin)">
            <i data-lucide="trash-2"></i>
          </button>
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

          ${item.notes ? `
            <p class="text-xs text-muted" style="background: #f8faf9; padding: 0.6rem; border-radius: 8px; border-left: 3px solid var(--fpc-gold);">
              <i data-lucide="info" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle;"></i> ${escapeHtml(item.notes)}
            </p>
          ` : ''}

          <!-- Slot Status -->
          <div class="slot-progress-wrap">
            <div class="slot-status-row">
              <span class="${isFull ? 'text-danger font-bold' : 'text-forest font-bold'}">
                ${isFull ? '❌ Slot Penuh' : `✅ Tersisa ${slotsRemaining} Slot`}
              </span>
              <span class="text-muted text-xs">${filledCount} / ${item.maxPlayers} Pemain</span>
            </div>
            <div class="slot-bar-bg">
              <div class="slot-bar-fill" style="width: ${fillPercent}%;"></div>
            </div>

            <!-- Avatars of players -->
            ${filledCount > 0 ? `
              <div class="players-preview-row">
                <span class="text-xs text-muted">Pemain gabung:</span>
                <div class="avatar-stack">${avatarsHtml}</div>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="schedule-card-footer">
          <div class="fee-display">
            <span class="fee-label">Biaya per Orang</span>
            <span class="fee-val">${formattedFee}</span>
          </div>
          
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            ${item.reclubUrl ? `
              <a href="${item.reclubUrl}" target="_blank" class="reclub-badge-link" title="Buka di Reclub App">
                <i data-lucide="external-link" style="width: 14px; height: 14px;"></i> Reclub
              </a>
            ` : ''}
            
            <button class="btn btn-gold btn-sm" ${isFull ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} onclick="openJoinModal('${item.id}')">
              ${isFull ? 'Penuh' : '<i data-lucide="user-plus"></i> Join Sesi'}
            </button>
          </div>
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

// ADMIN MODAL & ADD SCHEDULE
function openAdminModal() {
  document.getElementById('adminModal')?.classList.add('active');
  initLucide();
}

function handleScheduleSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('schedTitle').value.trim();
  const date = document.getElementById('schedDate').value;
  const time = document.getElementById('schedTime').value.trim();
  const venue = document.getElementById('schedVenue').value.trim();
  const court = document.getElementById('schedCourt').value.trim();
  const level = document.getElementById('schedLevel').value;
  const maxPlayers = parseInt(document.getElementById('schedMaxPlayers').value, 10) || 4;
  const fee = parseInt(document.getElementById('schedFee').value, 10) || 0;
  const reclubUrl = document.getElementById('schedReclubUrl').value.trim() || 'https://reclub.co';
  const notes = document.getElementById('schedNotes').value.trim();

  const newSchedule = {
    id: 'fpc-sched-' + Date.now(),
    title,
    date,
    time,
    venue,
    court,
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
    reclubBtn.href = activeBookingSession.reclubUrl || 'https://reclub.co';
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

function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
