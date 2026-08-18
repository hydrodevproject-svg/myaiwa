/* ==========================================================================
   MYAIWA - AIWA RAGIN JAJE (FULL COMPLETE APP LOGIC - 100% UNTRUNCATED)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { auth, db, firebaseConfig } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  getAuth 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  limit 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// INSTANCE AUTH SEKUNDER UNTUK RECRUITMENT
const secondaryApp = initializeApp(firebaseConfig, "SecondaryAuthHandler");
const secondaryAuth = getAuth(secondaryApp);

// DOM ELEMENTS
const formLogin = document.getElementById("form-login");
const sectionLogin = document.getElementById("section-login");
const sectionDashboard = document.getElementById("section-dashboard");
const mainHeader = document.getElementById("main-header");
const bottomNav = document.getElementById("bottom-nav");

// CACHE & RUNTIME STATES
let itUsersCache = [];
let allEmployeesCache = [];
let rawAuditLogsCache = [];
let careerPathListCache = [];
let leaderboardReportCache = [];
let adminAttendanceCache = [];
let currentPayslipCache = null;
let cropperInstance = null;
let currentCropType = "";
let userGPSLocation = null;
let maplibreMap = null;
let userMarker = null;

let selectedDisbursementType = "cash";
let qrCodeInstance = null;
let qrCodeKasbonInstance = null;
let html5QrScanner = null;
let activePickerContext = "shift";

let currentMonthITWfaCount = 0;
let qrCountdownInterval = null;

let currentActiveTab = "beranda";
let isHRSubpageOpen = false;
let isITSubpageOpen = false;
let lastBackPressTime = 0;
let pendingLeaveType = "Sakit";
let pendingEmployeeRequestType = "Kasbon";

// KOORDINAT TOKO AIWA RAGIN JAJE
const MERCHANT_LOCATION = {
  lat: -8.568346, 
  lng: 116.530922, 
  maxRadiusMeters: 100 
};

// ROLE LABEL DISPLAY MAPPER
const ROLE_DISPLAY_NAMES = {
  staff: "Staff Outlet",
  admin: "Staff Admin",
  logistik: "Staff Logistik",
  it: "Staff It",
  gm: "gm"
};

// PRESET DEFAULT TUNJANGAN JABATAN
const CAREER_ALLOWANCE_PRESETS = {
  Junior: 0,
  Middle: 150000,
  Senior: 350000,
  Lead: 750000
};

// TEMPLATE SOP KERJA TOKO BAHAN KUE (AIWA RAGIN JAJE)
const ROLE_DEFAULT_SOP = {
  staff: [
    "Cek kebersihan etalase, rak display, dan wadah repack bahan kue",
    "Periksa ketersediaan stok display & request restock ke logistik jika menipis",
    "Pastikan label harga & tanggal kedaluwarsa (EXP) tertera jelas pada kemasan",
    "Rekapitulasi total transaksi kasir dan serah terima kas/QRIS saat pergantian shift"
  ],
  logistik: [
    "Pemeriksaan fisik & tanggal kedaluwarsa bahan baku yang masuk dari supplier",
    "Penataan stok gudang dengan metode FIFO (First In, First Out) & FEFO (First Expired, First Out)",
    "Pengecekan suhu & kelembapan ruang simpan (mentega, cokelat, ragi/yeast, & dairy)",
    "Distribusi cepat bahan kue ke area etalase outlet sesuai form kebutuhan staf kasir"
  ],
  admin: [
    "Verifikasi pencocokan nota penjualan fisik/QRIS dengan rekapan kasir outlet",
    "Input faktur pembelian barang masuk dari supplier & jadwalkan jatuh tempo nota",
    "Pemeriksaan berkas pengajuan staf (kasbon, izin, lembur) untuk validasi GM",
    "Rekapitulasi laporan margin harian & mutasi stok keluar-masuk sistem"
  ],
  it: [
    "Monitoring kestabilan koneksi database transaksi toko & sistem presensi",
    "Pemeriksaan performa aplikasi Myaiwa & pencadangan data massal berkala",
    "Audit keamanan akun staf serta sinkronisasi log audit sistem",
    "Optimalisasi kecepatan respon antarmuka dan penanganan kendala teknis tim"
  ],
  gm: [
    "Evaluasi laporan omset harian, margin produk terlaris, & pergerakan stok lambat",
    "Validasi persetujuan pengajuan staf & otorisasi pencairan payroll/kasbon",
    "Inspeksi mendadak kelayakan penyimpanan bahan kue di gudang & display outlet",
    "Supervisi kepatuhan SOP harian, absensi GPS, dan performa KPI seluruh tim"
  ]
};

// PARAMETER ROLE DEFAULT
const DEFAULT_ROLE_PARAMS = {
  staff: { pagi_start: "07:30", pagi_end: "15:30", malam_start: "13:30", malam_end: "21:00", it_threshold: "10:00", tolerance: 15, late_penalty: 10000, overtime_rate: 25000, radius_meter: 100 },
  admin: { pagi_start: "08:00", pagi_end: "16:00", malam_start: "13:30", malam_end: "21:00", it_threshold: "10:00", tolerance: 15, late_penalty: 10000, overtime_rate: 25000, radius_meter: 100 },
  logistik: { pagi_start: "07:00", pagi_end: "15:00", malam_start: "13:00", malam_end: "21:00", it_threshold: "10:00", tolerance: 15, late_penalty: 10000, overtime_rate: 25000, radius_meter: 100 },
  it: { pagi_start: "08:00", pagi_end: "16:00", malam_start: "13:30", malam_end: "21:00", it_threshold: "10:00", tolerance: 15, late_penalty: 10000, overtime_rate: 25000, radius_meter: 100 },
  gm: { pagi_start: "08:00", pagi_end: "17:00", malam_start: "13:30", malam_end: "21:00", it_threshold: "10:00", tolerance: 30, late_penalty: 0, overtime_rate: 0, radius_meter: 200 }
};

let ROLE_PARAMS_CACHE = JSON.parse(JSON.stringify(DEFAULT_ROLE_PARAMS));

let currentUserShift = "pagi";
let currentUserWorkMode = "wfo";
let currentUserData = null;

const MONOTONE_ICONS = {
  warning: '<svg class="icon-inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
  location: '<svg class="icon-inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 00-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 00-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>'
};

// JAM & TANGGAL REALTIME BERANDA
function updateLiveClockAndDate() {
  const clockEl = document.getElementById("clock-date-live");
  if (!clockEl) return;
  const now = new Date();
  const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' };
  clockEl.innerText = now.toLocaleDateString("id-ID", options);
}
setInterval(updateLiveClockAndDate, 1000);
updateLiveClockAndDate();

// MUAT PARAMETER ROLE DARI FIRESTORE
async function loadSystemParameters() {
  try {
    const docSnap = await getDoc(doc(db, "app_settings", "parameters_roles"));
    if (docSnap.exists()) {
      ROLE_PARAMS_CACHE = { ...ROLE_PARAMS_CACHE, ...docSnap.data() };
    }
    updateAllShiftCardsTimeDisplay();
  } catch (e) {
    console.warn("Load config params error:", e);
  }
}

// SINKRONISASI LABEL JAM SHIFT
function updateAllShiftCardsTimeDisplay() {
  const roles = ["staff", "admin", "logistik", "it", "gm"];

  roles.forEach(roleKey => {
    const cfg = ROLE_PARAMS_CACHE[roleKey] || DEFAULT_ROLE_PARAMS[roleKey] || DEFAULT_ROLE_PARAMS.staff;

    const subPagi = document.getElementById(`sub-shift-${roleKey}-pagi`);
    const subMalam = document.getElementById(`sub-shift-${roleKey}-malam`);
    
    if (subPagi) subPagi.innerText = `${cfg.pagi_start || "07:30"} - ${cfg.pagi_end || "15:30"}`;
    if (subMalam) subMalam.innerText = `${cfg.malam_start || "13:30"} - ${cfg.malam_end || "21:00"}`;
  });

  const subIt = document.getElementById("sub-shift-it-flex");
  const subGm = document.getElementById("sub-shift-gm-regular");

  const itCfg = ROLE_PARAMS_CACHE.it || DEFAULT_ROLE_PARAMS.it;
  const gmCfg = ROLE_PARAMS_CACHE.gm || DEFAULT_ROLE_PARAMS.gm;

  if (subIt) subIt.innerText = `Maks Masuk: ${itCfg.it_threshold || "10:00"}`;
  if (subGm) subGm.innerText = `${gmCfg.pagi_start || "08:00"} - ${gmCfg.pagi_end || "17:00"}`;
}

// AUTH STATE OBSERVER
onAuthStateChanged(auth, async (user) => {
  if (user) {
    sectionLogin?.classList.add("hidden");
    sectionDashboard?.classList.remove("hidden");
    mainHeader?.classList.remove("hidden");
    bottomNav?.classList.remove("hidden");
    window.navigateToTab("beranda", false);

    const btnText = document.getElementById("btn-login-text");
    const btnSpinner = document.getElementById("btn-login-spinner");
    const btnSubmit = document.getElementById("btn-login-submit");
    if (btnText) btnText.innerText = "Masuk Sistem";
    if (btnSpinner) btnSpinner.classList.add("hidden");
    if (btnSubmit) btnSubmit.disabled = false;

    document.getElementById("header-user-email").innerText = user.email || "";
    document.getElementById("dashboard-user-name").innerText = user.email?.split('@')[0] || "Karyawan";
    document.getElementById("dashboard-greeting").innerText = getDynamicGreeting();

    try {
      await loadSystemParameters();

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        currentUserData = userDoc.data();
        currentUserShift = currentUserData.shift || "pagi";
        currentUserWorkMode = currentUserData.work_mode || "wfo";

        const rawRole = String(currentUserData.role || 'staff').toLowerCase();
        const displayRole = ROLE_DISPLAY_NAMES[rawRole] || rawRole;

        const userName = currentUserData.nama || user.email;
        document.getElementById("header-user-name").innerText = userName;
        document.getElementById("dashboard-user-name").innerText = userName;
        document.getElementById("dashboard-user-role-badge").innerText = `JABATAN: ${displayRole.toUpperCase()}`;

        let shiftBadgeText = `SHIFT ${currentUserShift.toUpperCase()}`;
        if (rawRole === "it") shiftBadgeText = "SHIFT IT";
        else if (rawRole === "gm") shiftBadgeText = "GM REGULAR";
        else if (rawRole === "staff") shiftBadgeText = (currentUserShift === "malam") ? "SHIFT MALAM" : "SHIFT PAGI";
        else if (rawRole === "admin") shiftBadgeText = `ADMIN · ${currentUserShift.toUpperCase()}`;
        else if (rawRole === "logistik") shiftBadgeText = `LOGISTIK · ${currentUserShift.toUpperCase()}`;

        document.getElementById("dashboard-shift-badge").innerText = shiftBadgeText;
        document.getElementById("dashboard-mode-label").innerText = currentUserWorkMode.toUpperCase();

        const userShiftModeBadge = document.getElementById("user-shift-mode-badge");
        if (userShiftModeBadge) {
          userShiftModeBadge.innerText = `${shiftBadgeText} · MODE ${currentUserWorkMode.toUpperCase()}`;
        }

        document.getElementById("page-user-name").innerText = userName;
        document.getElementById("page-user-email").innerText = user.email;
        document.getElementById("profile-full-name").value = currentUserData.nama || "";
        document.getElementById("profile-phone").value = currentUserData.phone || "";
        document.getElementById("profile-address").value = currentUserData.alamat || "";

        if (currentUserData.avatar_url) {
          applyUserAvatar(currentUserData.avatar_url);
        }

        renderRoleQuickActions(rawRole);
      }

      await loadDailyTaskChecklist();
      await calculateUserKPI(user.uid);
      checkTodayAttendance();
      
      if (currentUserData?.role === "admin" || currentUserData?.role === "gm" || currentUserData?.role === "it") {
        loadHRUserOptions();
        loadHRRequestsList();
      }
    } catch (err) {
      console.warn("Koneksi background data:", err);
    }
  } else {
    currentUserData = null;
    sectionLogin?.classList.remove("hidden");
    sectionDashboard?.classList.add("hidden");
    mainHeader?.classList.add("hidden");
    bottomNav?.classList.add("hidden");
  }
});

// GLOBAL LOADER & MODAL
window.showLoading = function(text = "Memproses...") {
  const loader = document.getElementById("global-loader");
  const loaderText = document.getElementById("loader-text");
  if (loaderText) loaderText.innerText = text;
  if (loader) loader.classList.remove("hidden");
};

window.hideLoading = function() {
  document.getElementById("global-loader")?.classList.add("hidden");
};

function notify(title, msg) {
  const modal = document.getElementById("custom-modal");
  const titleEl = document.getElementById("modal-title");
  const msgEl = document.getElementById("modal-message");

  if (modal && titleEl && msgEl) {
    titleEl.innerText = title || "Notifikasi";
    msgEl.innerText = msg || "";
    modal.classList.remove("hidden");
  } else {
    alert(`${title}: ${msg}`);
  }
}

window.showCustomConfirm = function(title, msg) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    document.getElementById("confirm-modal-title").innerText = title;
    document.getElementById("confirm-modal-message").innerText = msg;
    modal.classList.remove("hidden");

    const yesBtn = document.getElementById("btn-confirm-yes");
    const noBtn = document.getElementById("btn-confirm-no");

    const cleanup = () => {
      modal.classList.add("hidden");
      yesBtn.onclick = null;
      noBtn.onclick = null;
    };

    yesBtn.onclick = () => { cleanup(); resolve(true); };
    noBtn.onclick = () => { cleanup(); resolve(false); };
  });
};

function getDynamicGreeting() {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return "Selamat Pagi,";
  if (hour >= 11 && hour < 15) return "Selamat Siang,";
  if (hour >= 15 && hour < 18) return "Selamat Sore,";
  return "Selamat Malam,";
}

function applyUserAvatar(base64OrUrl) {
  if (!base64OrUrl) return;
  ['header-user-avatar', 'page-user-avatar', 'preview-user-avatar', 'dashboard-user-avatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.src = base64OrUrl;
      el.onload = () => el.classList.add('loaded');
      if (el.complete && el.naturalWidth > 0) el.classList.add('loaded');
    }
  });
}

// TEMA & VISIBILITAS PASSWORD (POIN 1: FIX ICON MATA DAN TEMA)
window.switchGlobalTheme = function(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  localStorage.setItem('myaiwa_theme', theme);
  document.querySelectorAll('#login-theme-light, #profile-theme-light').forEach(b => b.classList.toggle('active-theme', theme === 'light'));
  document.querySelectorAll('#login-theme-dark, #profile-theme-dark').forEach(b => b.classList.toggle('active-theme', theme === 'dark'));
};

const savedTheme = localStorage.getItem('myaiwa_theme') || 'light';
window.switchGlobalTheme(savedTheme);

window.togglePasswordVisibility = function() {
  const passInput = document.getElementById("login-password");
  const eyeOpen = document.getElementById("eye-icon-open");
  const eyeClosed = document.getElementById("eye-icon-closed");
  if (!passInput) return;

  if (passInput.type === "password") {
    passInput.type = "text";
    eyeOpen?.classList.add("hidden");
    eyeClosed?.classList.remove("hidden");
  } else {
    passInput.type = "password";
    eyeOpen?.classList.remove("hidden");
    eyeClosed?.classList.add("hidden");
  }
};

window.triggerLogout = async function() {
  const confirmLogout = await window.showCustomConfirm("Keluar Akun", "Apakah Anda yakin ingin keluar dari sistem?");
  if (confirmLogout) {
    window.showLoading("Keluar dari akun...");
    await signOut(auth);
    window.hideLoading();
  }
};

// NAVIGASI SISTEM
window.navigateToTab = function(tabName, pushState = true) {
  if (pushState) history.pushState({ tab: tabName, subpage: null }, "");

  currentActiveTab = tabName;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.bottom-nav .nav-item').forEach(el => el.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.remove('hidden');
    if (tabName === 'absensi' && window.initMapLibre) {
      setTimeout(window.initMapLibre, 150);
    } else if (tabName === 'it') {
      initITPanel();
    } else if (tabName === 'salary-history-page') {
      window.renderUserSlipHistory();
    } else if (tabName === 'kasbon') {
      window.loadKasbonAccountSummary();
    } else if (tabName === 'tugas') {
      loadDailyTaskChecklist();
    }
  }

  const navEl = document.getElementById(`nav-${tabName}`);
  if (navEl) navEl.classList.add('active');

  if (tabName !== 'hr') window.closeHRSubPage(false);
  if (tabName !== 'it') window.closeITSubPage(false);
};

window.openHRSubPage = function(subpageId, pushState = true) {
  isHRSubpageOpen = true;
  if (pushState) history.pushState({ tab: 'hr', subpage: subpageId }, "");

  document.getElementById('hr-menu-grid-view')?.classList.add('hidden');
  document.getElementById('hr-subpage-detail-view')?.classList.remove('hidden');

  document.querySelectorAll('.hr-feature-page').forEach(el => el.classList.add('hidden'));
  document.getElementById(`subtab-${subpageId}`)?.classList.remove('hidden');

  if (subpageId === 'hr-career-path') window.loadCareerPathList();
  if (subpageId === 'hr-kpi-leaderboard') window.renderGMLeaderboardReport();
  if (subpageId === 'hr-attendance') loadAdminAttendanceList();
  if (subpageId === 'hr-requests') loadHRRequestsList();
};

window.closeHRSubPage = function(popHistory = true) {
  isHRSubpageOpen = false;
  document.getElementById('hr-subpage-detail-view')?.classList.add('hidden');
  document.getElementById('hr-menu-grid-view')?.classList.remove('hidden');
  document.querySelectorAll('.hr-feature-page').forEach(el => el.classList.add('hidden'));

  if (popHistory && history.state && history.state.subpage) history.back();
};

window.openITSubPage = function(subpageId, pushState = true) {
  isITSubpageOpen = true;
  if (pushState) history.pushState({ tab: 'it', subpage: subpageId }, "");

  document.getElementById('it-menu-grid-view')?.classList.add('hidden');
  document.getElementById('it-subpage-detail-view')?.classList.remove('hidden');

  document.querySelectorAll('.it-feature-page').forEach(el => el.classList.add('hidden'));
  document.getElementById(`subtab-${subpageId}`)?.classList.remove('hidden');

  if (subpageId === 'it-database') calculateDatabaseMetrics();
  if (subpageId === 'it-users') loadITUsersList();
  if (subpageId === 'it-logs') loadAuditLogs();
};

window.closeITSubPage = function(popHistory = true) {
  isITSubpageOpen = false;
  document.getElementById('it-subpage-detail-view')?.classList.add('hidden');
  document.getElementById('it-menu-grid-view')?.classList.remove('hidden');
  document.querySelectorAll('.it-feature-page').forEach(el => el.classList.add('hidden'));

  if (popHistory && history.state && history.state.subpage) history.back();
};

// HANDLER POPSTATE BACK BUTTON
window.addEventListener('popstate', () => {
  if (document.getElementById('kpi-cert-modal')?.classList.contains('hidden') === false) {
    window.closeKPICertModal();
    return;
  }
  if (document.getElementById('gm-scanner-modal')?.classList.contains('hidden') === false) {
    window.closeGMScannerModal();
    return;
  }
  if (document.getElementById('qr-receipt-modal')?.classList.contains('hidden') === false) {
    window.closeQRReceiptModal();
    return;
  }
  if (document.getElementById('qris-kasbon-modal')?.classList.contains('hidden') === false) {
    window.closeKasbonQRISModal();
    return;
  }
  if (document.getElementById('share-options-modal')?.classList.contains('hidden') === false) {
    window.closeShareOptionsModal();
    return;
  }
  if (document.getElementById('crop-modal')?.classList.contains('hidden') === false) {
    document.getElementById('crop-modal')?.classList.add('hidden');
    return;
  }

  const roleParamForm = document.getElementById('subtab-hr-role-param-form');
  if (isHRSubpageOpen && roleParamForm && !roleParamForm.classList.contains('hidden')) {
    window.openHRSubPage('hr-params-menu', false);
    return;
  }

  if (isHRSubpageOpen) {
    window.closeHRSubPage(false);
    return;
  }

  if (isITSubpageOpen) {
    window.closeITSubPage(false);
    return;
  }

  if (currentActiveTab === 'employee-picker-page') {
    window.navigateToTab('hr', false);
    if (activePickerContext === 'shift') window.openHRSubPage('hr-shift', false);
    else if (activePickerContext === 'salary') window.openHRSubPage('hr-salary-structure', false);
    else if (activePickerContext === 'task') window.openHRSubPage('hr-tasks-assign', false);
    return;
  }

  if (currentActiveTab === 'claim-salary') {
    window.navigateToTab('payslip-page', false);
    return;
  }

  if (currentActiveTab === 'payslip-page' || currentActiveTab === 'salary-history-page') {
    window.navigateToTab('gaji', false);
    return;
  }

  if (currentActiveTab === 'gaji') {
    window.navigateToTab('beranda', false);
    return;
  }

  if (currentActiveTab === 'tugas' || currentActiveTab === 'kasbon' || currentActiveTab === 'leave-form' || currentActiveTab === 'employee-request-page' || currentActiveTab === 'change-pass') {
    window.navigateToTab('beranda', false);
    return;
  }

  if (currentActiveTab !== 'beranda') {
    window.navigateToTab('beranda', false);
    return;
  }

  const now = Date.now();
  if (now - lastBackPressTime < 2000) {
    history.back();
  } else {
    lastBackPressTime = now;
    showExitToast();
    history.pushState({ tab: 'beranda', subpage: null }, "");
  }
});

function showExitToast() {
  const toast = document.getElementById('toast-exit');
  if (!toast) return;
  toast.classList.remove('hidden');
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2000);
}
history.replaceState({ tab: 'beranda', subpage: null }, "");

// SELEKTOR SHIFT & MODE KERJA
window.selectRoleShiftCard = function(shiftType, roleKey) {
  const inputShift = document.getElementById("hr-select-shift");
  const inputRole = document.getElementById("hr-select-shift-role");

  if (inputShift) inputShift.value = shiftType;
  if (inputRole) inputRole.value = roleKey;

  document.querySelectorAll(".role-shift-group-block .shift-select-card").forEach(c => {
    c.classList.remove("active-shift");
  });

  let targetCardId = `shift-card-${roleKey}_${shiftType}`;
  if (shiftType === "it_flex") targetCardId = "shift-card-it_flex";
  if (roleKey === "gm") targetCardId = "shift-card-gm_regular";

  const targetCard = document.getElementById(targetCardId);
  if (targetCard) targetCard.classList.add("active-shift");
};

window.selectWorkModePill = function(modeType) {
  const inputEl = document.getElementById("hr-select-work-mode");
  if (inputEl) inputEl.value = modeType;
  ['wfo', 'wfa'].forEach(id => {
    const el = document.getElementById(`mode-btn-${id}`);
    el?.classList.toggle('active-shift', id === modeType);
  });
};

// NAVIGASI LAMAN PILIH KARYAWAN
window.navigateToEmployeePickerPage = function(context = "shift") {
  activePickerContext = context;
  renderEmployeePickerPageList(allEmployeesCache);
  window.navigateToTab('employee-picker-page');
};

function renderEmployeePickerPageList(usersList) {
  const container = document.getElementById("employee-picker-page-list");
  if (!container) return;

  if (usersList.length === 0) {
    container.innerHTML = "<p class='placeholder-text'>Tidak ada karyawan ditemukan.</p>";
    return;
  }

  container.innerHTML = usersList.map(u => {
    const rawRole = String(u.role || 'staff').toLowerCase();
    const displayBadge = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();
    return `
      <div class="picker-user-row" onclick="selectPickerUserItem('${u.id}', '${u.nama || u.email}')">
        <div class="picker-user-meta">
          <strong>${u.nama || u.email}</strong>
          <small>${u.email || '-'}</small>
        </div>
        <span class="badge-status-work">${displayBadge}</span>
      </div>
    `;
  }).join("");
}

window.filterEmployeePickerPageList = function() {
  const q = document.getElementById("picker-search-input")?.value.toLowerCase().trim() || "";
  const filtered = allEmployeesCache.filter(u => 
    (u.nama && u.nama.toLowerCase().includes(q)) || 
    (u.email && u.email.toLowerCase().includes(q)) ||
    (u.role && u.role.toLowerCase().includes(q))
  );
  renderEmployeePickerPageList(filtered);
};

window.selectPickerUserItem = function(userId, userName) {
  if (activePickerContext === "shift") {
    const shiftUserEl = document.getElementById("hr-select-user");
    const labelShiftEl = document.getElementById("label-picker-shift-user");
    if (shiftUserEl) shiftUserEl.value = userId;
    if (labelShiftEl) labelShiftEl.innerText = userName;
    window.onHRUserSelected(userId);
    window.navigateToTab('hr');
    window.openHRSubPage('hr-shift', false);
  } else if (activePickerContext === "salary") {
    const salUserEl = document.getElementById("salary-select-user");
    const labelSalEl = document.getElementById("label-picker-salary-user");
    if (salUserEl) salUserEl.value = userId;
    if (labelSalEl) labelSalEl.innerText = userName;
    window.loadEmployeeSalaryConfig(userId);
    window.navigateToTab('hr');
    window.openHRSubPage('hr-salary-structure', false);
  } else if (activePickerContext === "task") {
    const taskUserEl = document.getElementById("task-select-user");
    const labelTaskEl = document.getElementById("label-picker-task-user");
    if (taskUserEl) taskUserEl.value = userId;
    if (labelTaskEl) labelTaskEl.innerText = userName;
    window.navigateToTab('hr');
    window.openHRSubPage('hr-tasks-assign', false);
  }
};

// CHECKLIST TUGAS HARIAN & SOP TOKO
async function loadDailyTaskChecklist() {
  const user = auth.currentUser;
  const container = document.getElementById("daily-task-container");
  const progressBadge = document.getElementById("task-progress-badge");
  const btnSubmit = document.getElementById("btn-submit-daily-tasks");
  if (!user || !container) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const userRole = String(currentUserData?.role || 'staff').toLowerCase();
  const defaultTasks = ROLE_DEFAULT_SOP[userRole] || ROLE_DEFAULT_SOP.staff;

  try {
    const logDocSnap = await getDoc(doc(db, "daily_task_logs", `${user.uid}_${todayStr}`));
    const logData = logDocSnap.exists() ? logDocSnap.data() : { completed_tasks: [], is_submitted: false };
    const completedIndices = logData.completed_tasks || [];
    const isSubmitted = logData.is_submitted === true;

    if (btnSubmit) {
      if (isSubmitted) {
        btnSubmit.disabled = true;
        btnSubmit.style.background = "#34c759";
        btnSubmit.innerHTML = `<span>Tugas Sudah Terkunci ✓ (${logData.submitted_at_time || ''})</span>`;
      } else {
        btnSubmit.disabled = false;
        btnSubmit.style.background = "var(--text-accent)";
        btnSubmit.innerHTML = `
          <svg class="icon-inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Submit & Kunci Tugas Hari Ini</span>
        `;
      }
    }

    const customSnap = await getDocs(query(
      collection(db, "staff_tasks"),
      where("uid", "==", user.uid),
      where("target_date", "==", todayStr)
    ));

    const taskList = defaultTasks.map((t, idx) => ({
      id: `sop_${idx}`,
      title: t,
      isCustom: false,
      completed: completedIndices.includes(`sop_${idx}`)
    }));

    customSnap.forEach(d => {
      const data = d.data();
      taskList.push({
        id: d.id,
        title: data.instruction,
        isCustom: true,
        completed: data.completed === true
      });
    });

    const totalCount = taskList.length;
    const doneCount = taskList.filter(t => t.completed).length;

    if (progressBadge) {
      progressBadge.innerText = `${doneCount}/${totalCount} SELESAI`;
      progressBadge.style.background = doneCount === totalCount ? "rgba(52, 199, 89, 0.15)" : "rgba(26, 75, 139, 0.12)";
      progressBadge.style.color = doneCount === totalCount ? "#34c759" : "var(--text-accent)";
    }

    container.innerHTML = taskList.map(task => `
      <div class="task-item-checkbox ${task.completed ? 'completed' : ''} ${task.isCustom ? 'is-custom' : ''}" onclick="${isSubmitted ? '' : `toggleDailyTaskStatus('${task.id}', ${task.isCustom}, ${!task.completed})`}">
        <div class="task-checkbox-bubble">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <span class="task-label-text">${task.title}</span>
        <span class="task-type-badge">${task.isCustom ? 'TUGAS GM' : 'SOP'}</span>
      </div>
    `).join("");

  } catch (err) {
    container.innerHTML = "<p class='placeholder-text' style='font-size:0.65rem;'>Gagal memuat tugas harian.</p>";
  }
}

// TOGGLE CENTANG TUGAS
window.toggleDailyTaskStatus = async function(taskId, isCustom, newStatus) {
  const user = auth.currentUser;
  if (!user) return;

  const todayStr = new Date().toISOString().split('T')[0];

  try {
    if (isCustom) {
      await setDoc(doc(db, "staff_tasks", taskId), { completed: newStatus }, { merge: true });
    } else {
      const logRef = doc(db, "daily_task_logs", `${user.uid}_${todayStr}`);
      const snap = await getDoc(logRef);
      let list = snap.exists() ? (snap.data().completed_tasks || []) : [];

      if (newStatus) {
        if (!list.includes(taskId)) list.push(taskId);
      } else {
        list = list.filter(id => id !== taskId);
      }

      await setDoc(logRef, {
        uid: user.uid,
        date: todayStr,
        completed_tasks: list,
        updated_at: serverTimestamp()
      }, { merge: true });
    }

    await loadDailyTaskChecklist();
    await calculateUserKPI(user.uid);
  } catch (err) {
    console.error("Gagal simpan task:", err);
  }
};

window.submitDailyTasksFinal = async function() {
  const user = auth.currentUser;
  if (!user) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar" });

  const confirmSubmit = await window.showCustomConfirm(
    "Kunci & Submit Tugas",
    "Apakah Anda yakin ingin mengunci laporan tugas hari ini? Tugas yang sudah di-submit tidak dapat diubah kembali."
  );
  if (!confirmSubmit) return;

  window.showLoading("Mengunci laporan tugas operasional...");

  try {
    const logRef = doc(db, "daily_task_logs", `${user.uid}_${todayStr}`);
    await setDoc(logRef, {
      is_submitted: true,
      submitted_at_time: timeStr,
      submitted_at: serverTimestamp()
    }, { merge: true });

    window.hideLoading();
    notify("Berhasil", `Laporan tugas harian berhasil dikunci pada pukul ${timeStr}.`);
    await loadDailyTaskChecklist();
    await calculateUserKPI(user.uid);
  } catch (err) {
    window.hideLoading();
    notify("Gagal Submit", err.message);
  }
};

// ==========================================
// MODUL KASBON, COUNTDOWN QRIS 1 JAM & HANGUS 1 MENIT (POIN 7)
// ==========================================

window.openKasbonForm = function(actionType) {
  const formBox = document.getElementById("box-form-kasbon");
  const titleEl = document.getElementById("kasbon-form-title");
  const labelEl = document.getElementById("kasbon-input-label");
  const typeInput = document.getElementById("kasbon-action-type");
  const cicilanBox = document.getElementById("box-cicilan-fields");

  if (!formBox) return;

  if (actionType === "pinjam") {
    const currentKPIStatus = document.getElementById("kpi-status-tag")?.innerText?.trim().toLowerCase() || "kurang";
    const currentKPIScore = document.getElementById("kpi-score-badge")?.innerText?.trim() || "0%";

    if (currentKPIStatus !== "memuaskan") {
      return notify(
        "Akses Kasbon Terkunci",
        `Pengajuan kasbon hanya dapat diakses oleh karyawan dengan performa KPI MEMUASKAN (>85%).\n\nStatus KPI Anda saat ini: ${currentKPIStatus.toUpperCase()} (${currentKPIScore}). Tingkatkan kehadiran dan kepatuhan tugas harian Anda untuk membuka hak fasilitas kasbon.`
      );
    }

    titleEl.innerText = "Formulir Pengajuan Pinjaman Kasbon";
    labelEl.innerText = "TOTAL NOMINAL PINJAMAN (RP)";
    if (cicilanBox) cicilanBox.classList.remove("hidden");
  } else {
    titleEl.innerText = "Formulir Pembayaran / Setoran Kasbon";
    labelEl.innerText = "NOMINAL YANG DIBAYARKAN (RP)";
    if (cicilanBox) cicilanBox.classList.add("hidden");
  }

  typeInput.value = actionType;
  document.getElementById("kasbon-amount-input").value = "";
  document.getElementById("kasbon-notes-input").value = "";
  formBox.classList.remove("hidden");
};

window.loadKasbonAccountSummary = async function() {
  const user = auth.currentUser;
  if (!user) return;

  const displaySisa = document.getElementById("display-sisa-kasbon");
  const displayPinjaman = document.getElementById("display-total-pinjaman");
  const displayPelunasan = document.getElementById("display-total-pelunasan");
  const historyList = document.getElementById("kasbon-history-list");

  try {
    const snap = await getDocs(query(
      collection(db, "employee_requests"),
      where("uid", "==", user.uid)
    ));

    let totalPinjaman = 0;
    let totalPelunasan = 0;
    let transactions = [];
    const now = Date.now();

    for (const docSnap of snap.docs) {
      const item = { id: docSnap.id, ...docSnap.data() };
      if (item.type === "Kasbon" || item.type === "Bayar Kasbon") {
        
        // HANGUS OTOMATIS JIKA MELEWATI 1 JAM (60 MENIT)
        if (item.status === "Pending" && item.expires_at_millis && now > item.expires_at_millis) {
          item.status = "Expired";
          item.expired_at_millis = item.expires_at_millis;
          setDoc(doc(db, "employee_requests", item.id), { status: "Expired", expired_at_millis: now }, { merge: true }).catch(() => {});
        }

        // HAPUS OTOMATIS SETELAH 1 MENIT DARI STATUS EXPIRED
        if (item.status === "Expired" && item.expired_at_millis && (now - item.expired_at_millis > 60 * 1000)) {
          deleteDoc(doc(db, "employee_requests", item.id)).catch(() => {});
          continue;
        }

        transactions.push(item);

        if (item.type === "Kasbon" && item.status === "Approved") {
          totalPinjaman += Number(item.amount || 0);
          totalPelunasan += Number(item.total_paid || 0);
        } else if (item.type === "Bayar Kasbon" && item.status === "Approved") {
          totalPelunasan += Number(item.amount || 0);
        } else if (item.type === "Kasbon" && item.status === "Settled") {
          totalPinjaman += Number(item.amount || 0);
          totalPelunasan += Number(item.amount || 0);
        }
      }
    }

    const sisaKasbon = Math.max(0, totalPinjaman - totalPelunasan);

    if (displaySisa) displaySisa.innerText = `Rp ${sisaKasbon.toLocaleString()}`;
    if (displayPinjaman) displayPinjaman.innerText = `Rp ${totalPinjaman.toLocaleString()}`;
    if (displayPelunasan) displayPelunasan.innerText = `Rp ${totalPelunasan.toLocaleString()}`;

    if (!historyList) return;
    if (transactions.length === 0) {
      historyList.innerHTML = "<p class='placeholder-text'>Belum ada transaksi kasbon.</p>";
      return;
    }

    transactions.sort((a, b) => (b.requested_millis || 0) - (a.requested_millis || 0));

    historyList.innerHTML = transactions.map(t => {
      const isPinjam = t.type === "Kasbon";
      const color = isPinjam ? "#ff9500" : "#34c759";
      const prefix = isPinjam ? "+ Rp " : "- Rp ";
      const cicilanMeta = isPinjam ? `<small style="display:block; font-size:0.52rem; color:var(--text-accent);">Cicilan: Rp ${Number(t.monthly_installment || t.amount).toLocaleString()} / bln (${t.tenor_months || 1} Bln)</small>` : '';

      let statusDisplayColor = "#ff9500";
      if (t.status === "Approved") statusDisplayColor = "#34c759";
      if (t.status === "Expired" || t.status === "Rejected") statusDisplayColor = "#ff3b30";

      const showQRISBtn = (t.status === "Pending" && t.voucher_code) 
        ? `<button type="button" class="btn-primary" style="padding:4px 8px; font-size:0.58rem; margin-top:4px;" onclick="showKasbonQRISModal('${t.voucher_code}', ${t.expires_at_millis}, ${JSON.stringify(t).replace(/"/g, '&quot;')})">Tampilkan QRIS</button>` 
        : '';

      return `
        <div style="padding: 10px 0; border-bottom: 0.5px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div style="text-align:left;">
            <strong style="font-size: 0.72rem; color: var(--text-primary);">${t.type}</strong>
            <small style="display: block; font-size: 0.58rem; color: var(--text-secondary);">${t.note || '-'}</small>
            ${cicilanMeta}
            <small style="font-size: 0.55rem; color: ${statusDisplayColor}; font-weight: 700; display:block; margin-top:2px;">Status: ${t.status.toUpperCase()}</small>
            ${showQRISBtn}
          </div>
          <strong style="font-size: 0.82rem; color: ${color};">${prefix}${Number(t.amount || 0).toLocaleString()}</strong>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.warn("Gagal load kasbon:", err);
  }
};

window.showKasbonQRISModal = function(voucherCode, expiresAtMillis, transData) {
  const modal = document.getElementById("qris-kasbon-modal");
  const codeEl = document.getElementById("kasbon-voucher-code-display");
  const qrContainer = document.getElementById("qrcode-kasbon-container");
  const timerEl = document.getElementById("kasbon-countdown-timer");

  if (codeEl) codeEl.innerText = voucherCode;

  if (qrContainer) {
    qrContainer.innerHTML = "";
    if (window.QRCode) {
      qrCodeKasbonInstance = new QRCode(qrContainer, {
        text: JSON.stringify({
          app: "MYAIWA_KASBON",
          code: voucherCode,
          uid: transData.uid,
          nama: transData.nama,
          amount: transData.amount,
          type: transData.type,
          exp: expiresAtMillis
        }),
        width: 160,
        height: 160,
        colorDark: "#ff9500",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  // TIMER COUNTDOWN 1 JAM REALTIME
  if (qrCountdownInterval) clearInterval(qrCountdownInterval);

  function updateTimer() {
    const remaining = expiresAtMillis - Date.now();
    if (remaining <= 0) {
      clearInterval(qrCountdownInterval);
      if (timerEl) timerEl.innerText = "KODE TELAH KEDALUWARSA (EXPIRED)";
      window.loadKasbonAccountSummary();
      return;
    }
    const mins = Math.floor(remaining / (1000 * 60));
    const secs = Math.floor((remaining % (1000 * 60)) / 1000);
    if (timerEl) {
      timerEl.innerText = `Berlaku: ${String(mins).padStart(2, '0')} Menit ${String(secs).padStart(2, '0')} Detik`;
    }
  }

  updateTimer();
  qrCountdownInterval = setInterval(updateTimer, 1000);

  modal?.classList.remove("hidden");
};

window.closeKasbonQRISModal = function() {
  if (qrCountdownInterval) clearInterval(qrCountdownInterval);
  document.getElementById("qris-kasbon-modal")?.classList.add("hidden");
};

// ==========================================
// MODUL JENJANG KARIR DENGAN SEARCH BOX & JARAK RAPI (POIN 4)
// ==========================================

window.onCareerLevelPresetChange = function() {
  const selectedLevel = document.getElementById("career-select-level")?.value || "Junior";
  const allowanceInput = document.getElementById("career-custom-allowance");
  if (allowanceInput) {
    allowanceInput.value = CAREER_ALLOWANCE_PRESETS[selectedLevel] ?? 0;
  }
};

window.loadCareerPathList = async function() {
  const container = document.getElementById("career-path-list-container");
  if (!container) return;

  container.innerHTML = "<p class='placeholder-text'>Memuat data karir seluruh karyawan...</p>";

  try {
    const [usersSnap, salarySnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "salary_structures"))
    ]);

    const salaryMap = {};
    salarySnap.forEach(d => { salaryMap[d.id] = d.data(); });

    careerPathListCache = [];
    usersSnap.forEach(d => {
      const u = { id: d.id, ...d.data() };
      const rawRole = String(u.role || 'staff').toLowerCase();
      if (rawRole !== 'gm') {
        const sal = salaryMap[u.id] || {};
        const currentLevel = u.career_level || "Junior";
        const allowanceVal = Number(sal.role_allowance ?? (CAREER_ALLOWANCE_PRESETS[currentLevel] || 0));
        careerPathListCache.push({ ...u, currentLevel, allowanceVal });
      }
    });

    renderCareerPathList(careerPathListCache);
  } catch (err) {
    container.innerHTML = `<p class='placeholder-text' style='color:#ff3b30;'>Gagal memuat: ${err.message}</p>`;
  }
};

function renderCareerPathList(list) {
  const container = document.getElementById("career-path-list-container");
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = "<p class='placeholder-text'>Tidak ada data karyawan.</p>";
    return;
  }

  container.innerHTML = list.map(emp => {
    const rawRole = String(emp.role || 'staff').toLowerCase();
    const displayRole = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();

    return `
      <div class="picker-user-row" style="cursor:default;">
        <div class="picker-user-meta">
          <strong>${emp.nama || emp.email}</strong>
          <small>${displayRole} · Level: <b style="color:var(--text-accent);">${emp.currentLevel.toUpperCase()}</b></small>
          <small style="color:#34c759; margin-top:2px;">Tunjangan: Rp ${emp.allowanceVal.toLocaleString()} / bln</small>
        </div>
        <button type="button" class="btn-primary" style="padding:5px 10px; font-size:0.62rem;" onclick="openCareerPromotionModal('${emp.id}', '${emp.nama || emp.email}', '${emp.currentLevel}', ${emp.allowanceVal})">
          Promosi / Edit
        </button>
      </div>
    `;
  }).join("");
}

window.filterCareerPathList = function() {
  const q = document.getElementById("search-career-user")?.value.toLowerCase().trim() || "";
  const filtered = careerPathListCache.filter(u => 
    (u.nama && u.nama.toLowerCase().includes(q)) || 
    (u.email && u.email.toLowerCase().includes(q)) ||
    (u.role && u.role.toLowerCase().includes(q)) ||
    (u.currentLevel && u.currentLevel.toLowerCase().includes(q))
  );
  renderCareerPathList(filtered);
};

window.openCareerPromotionModal = function(userId, userName, currentLevel, currentAllowance) {
  const box = document.getElementById("box-career-promotion-form");
  const targetLabel = document.getElementById("career-target-user-label");
  const uidInput = document.getElementById("career-target-uid");
  const levelSelect = document.getElementById("career-select-level");
  const allowanceInput = document.getElementById("career-custom-allowance");

  if (!box) return;
  targetLabel.innerText = `Promosi: ${userName}`;
  uidInput.value = userId;
  levelSelect.value = currentLevel;
  allowanceInput.value = currentAllowance;

  box.classList.remove("hidden");
};

// ==========================================
// LEADERBOARD EVALUASI PERFORMA & SEARCH BOX (POIN 5)
// ==========================================

window.renderGMLeaderboardReport = async function() {
  const container = document.getElementById("gm-leaderboard-container");
  const uncompletedContainer = document.getElementById("gm-uncompleted-tasks-container");
  const monthInput = document.getElementById("filter-kpi-leaderboard-month")?.value || "2026-08";
  const roleFilter = document.getElementById("filter-kpi-leaderboard-role")?.value || "all";

  if (!container) return;
  container.innerHTML = "<p class='placeholder-text'>Menghitung rekapitulasi leaderboard tim...</p>";

  try {
    const [usersSnap, attSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(query(collection(db, "attendance"), where("date", ">=", `${monthInput}-01`)))
    ]);

    let userMap = {};
    usersSnap.forEach(d => {
      const u = { id: d.id, ...d.data() };
      if (roleFilter === "all" || u.role === roleFilter) {
        userMap[d.id] = { ...u, presentDays: 0, lateDays: 0 };
      }
    });

    attSnap.forEach(d => {
      const a = d.data();
      if (userMap[a.uid] && a.status === "Hadir") {
        userMap[a.uid].presentDays++;
        if (a.late_minutes && a.late_minutes > 0) userMap[a.uid].lateDays++;
      }
    });

    leaderboardReportCache = Object.values(userMap).map(u => {
      const targetWorkingDays = 26;
      const rate = Math.min(100, (u.presentDays / targetWorkingDays) * 100);
      const score = Math.max(0, Math.min(100, Math.round(rate - (u.lateDays * 3))));
      return { ...u, score };
    });

    leaderboardReportCache.sort((a, b) => b.score - a.score);

    const badgeEl = document.getElementById("kpi-ranking-count-badge");
    if (badgeEl) badgeEl.innerText = `${leaderboardReportCache.length} Karyawan`;

    renderLeaderboardReport(leaderboardReportCache);

    if (uncompletedContainer) {
      uncompletedContainer.innerHTML = "<p class='placeholder-text' style='color:#34c759;'>Seluruh checklist tugas operasional terpantau aman.</p>";
    }

  } catch (err) {
    container.innerHTML = `<p class='placeholder-text' style='color:#ff3b30;'>Gagal memuat: ${err.message}</p>`;
  }
};

function renderLeaderboardReport(list) {
  const container = document.getElementById("gm-leaderboard-container");
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = "<p class='placeholder-text'>Tidak ada data peringkat.</p>";
    return;
  }

  container.innerHTML = list.map((r, i) => `
    <div class="picker-user-row" style="cursor:default;">
      <div class="picker-user-meta">
        <strong>#${i + 1} ${r.nama || r.email}</strong>
        <small>${(ROLE_DISPLAY_NAMES[r.role] || r.role).toUpperCase()} · Hadir: ${r.presentDays} Hari · Telat: ${r.lateDays} Kali</small>
      </div>
      <strong style="color:var(--text-accent); font-size:0.9rem;">${r.score}%</strong>
    </div>
  `).join("");
}

window.filterLeaderboardReport = function() {
  const q = document.getElementById("search-leaderboard-user")?.value.toLowerCase().trim() || "";
  const filtered = leaderboardReportCache.filter(u => 
    (u.nama && u.nama.toLowerCase().includes(q)) || 
    (u.email && u.email.toLowerCase().includes(q)) ||
    (u.role && u.role.toLowerCase().includes(q))
  );
  renderLeaderboardReport(filtered);
};

// ==========================================
// RIWAYAT MANAGEMENT ABSENSI & FILTER TANGGAL (POIN 6)
// ==========================================

async function loadAdminAttendanceList() {
  const listEl = document.getElementById("admin-attendance-list");
  if (!listEl) return;

  try {
    const snap = await getDocs(query(collection(db, "attendance"), limit(50)));
    adminAttendanceCache = [];
    snap.forEach(d => {
      adminAttendanceCache.push({ id: d.id, ...d.data() });
    });

    adminAttendanceCache.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    renderAdminAttendanceList(adminAttendanceCache);
  } catch (e) {
    listEl.innerHTML = "<p class='placeholder-text' style='color:red;'>Gagal memuat data.</p>";
  }
}

function renderAdminAttendanceList(list) {
  const listEl = document.getElementById("admin-attendance-list");
  if (!listEl) return;

  if (list.length === 0) {
    listEl.innerHTML = "<p class='placeholder-text'>Tidak ada log absensi ditemukan.</p>";
    return;
  }

  listEl.innerHTML = list.map(item => {
    const rawRole = String(item.role || 'staff').toLowerCase();
    const displayRole = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();

    return `
      <div class="picker-user-row" style="cursor:default;">
        <div class="picker-user-meta">
          <strong>${item.nama || 'Karyawan'} [${displayRole}]</strong>
          <small>Tgl: ${item.date || '-'} · In: ${item.check_in_time || '--:--'} | Out: ${item.check_out_time || '--:--'}</small>
          <small style="color:var(--text-accent); font-weight:700;">Status: ${item.status || 'Hadir'}</small>
        </div>
        <button type="button" class="btn-danger-sm" onclick="deleteAttendanceRecord('${item.id}')">Hapus</button>
      </div>
    `;
  }).join("");
}

window.filterAdminAttendanceLog = function() {
  const q = document.getElementById("admin-attendance-search")?.value.toLowerCase().trim() || "";
  const dateVal = document.getElementById("admin-attendance-date-filter")?.value || "";

  const filtered = adminAttendanceCache.filter(item => {
    const matchName = !q || (item.nama && item.nama.toLowerCase().includes(q)) || (item.role && item.role.toLowerCase().includes(q));
    const matchDate = !dateVal || item.date === dateVal;
    return matchName && matchDate;
  });

  renderAdminAttendanceList(filtered);
};

// ==========================================
// SERTIFIKAT KPI ELEGAN & SANGGAHAN CROSCHECK
// ==========================================

window.openKPICertificateModal = function() {
  const user = auth.currentUser;
  if (!user || !currentUserData) return;

  const monthStr = new Date().toISOString().slice(0, 7);
  const certModal = document.getElementById("kpi-cert-modal");

  document.getElementById("cert-employee-name").innerText = currentUserData.nama || user.email;
  document.getElementById("cert-employee-role").innerText = (ROLE_DISPLAY_NAMES[currentUserData.role] || currentUserData.role || 'Staff').toUpperCase();
  document.getElementById("cert-verification-code").innerText = `CERT-${monthStr.replace("-", "")}-${user.uid.slice(0, 6).toUpperCase()}`;

  const currentScore = document.getElementById("kpi-score-badge")?.innerText || "0%";
  const currentPresence = document.getElementById("kpi-attendance-count")?.innerText || "0 Hari";
  const currentStatus = document.getElementById("kpi-status-tag")?.innerText || "Kurang";

  document.getElementById("cert-score-val").innerText = currentScore;
  document.getElementById("cert-presence-val").innerText = currentPresence;
  document.getElementById("cert-task-val").innerText = "100%";
  
  const certBadge = document.getElementById("cert-status-badge");
  if (certBadge) certBadge.innerText = `PRESTASI ${currentStatus.toUpperCase()}`;

  certModal?.classList.remove("hidden");
};

window.closeKPICertModal = function() {
  document.getElementById("kpi-cert-modal")?.classList.add("hidden");
};

window.printKPICertificate = function() {
  window.print();
};

window.openCrosscheckModal = async function() {
  const user = auth.currentUser;
  if (!user) return;

  const reason = prompt("Tuliskan alasan sanggahan atau koreksi data KPI yang tidak sesuai (misal: kendala GPS atau tugas belum terhitung):");
  if (!reason || reason.trim() === "") return;

  window.showLoading("Mengirimkan permintaan audit sanggahan ke GM...");
  const monthStr = new Date().toISOString().slice(0, 7);

  try {
    await setDoc(doc(db, "kpi_crosschecks", `${user.uid}_${monthStr}`), {
      uid: user.uid,
      nama: currentUserData.nama || user.email,
      role: currentUserData.role || "staff",
      month: monthStr,
      note: reason.trim(),
      status: "Menunggu Audit GM",
      timestamp: serverTimestamp()
    }, { merge: true });

    window.hideLoading();
    notify("Terkirim", "Permintaan croscheck telah diteruskan ke akun GM untuk diaudit.");
    calculateUserKPI(user.uid);
  } catch (err) {
    window.hideLoading();
    notify("Gagal", err.message);
  }
};

// PENGATURAN PARAMETER ROLE
window.openRoleParameterPage = function(roleKey, roleTitle) {
  const targetRoleInput = document.getElementById("target-role-param-id");
  const titleEl = document.getElementById("role-param-title");
  const badgeEl = document.getElementById("role-param-badge");

  if (targetRoleInput) targetRoleInput.value = roleKey;
  if (titleEl) titleEl.innerText = `Parameter ${roleTitle}`;
  if (badgeEl) badgeEl.innerText = roleTitle.toUpperCase();

  const cfg = ROLE_PARAMS_CACHE[roleKey] || DEFAULT_ROLE_PARAMS[roleKey] || DEFAULT_ROLE_PARAMS.staff;

  document.getElementById("cfg-role-pagi-start").value = cfg.pagi_start || "07:30";
  document.getElementById("cfg-role-pagi-end").value = cfg.pagi_end || "15:30";
  document.getElementById("cfg-role-malam-start").value = cfg.malam_start || "13:30";
  document.getElementById("cfg-role-malam-end").value = cfg.malam_end || "21:00";
  document.getElementById("cfg-role-it-threshold").value = cfg.it_threshold || "10:00";
  document.getElementById("cfg-role-tolerance").value = cfg.tolerance ?? 15;
  document.getElementById("cfg-role-overtime-rate").value = cfg.overtime_rate ?? 25000;
  document.getElementById("cfg-role-late-penalty").value = cfg.late_penalty ?? 10000;
  document.getElementById("cfg-role-radius-meter").value = cfg.radius_meter ?? 100;

  window.openHRSubPage('hr-role-param-form');
};

// DATABASE METRICS
async function calculateDatabaseMetrics() {
  try {
    const [attSnap, reqSnap, usersSnap, slipsSnap] = await Promise.all([
      getDocs(collection(db, "attendance")),
      getDocs(collection(db, "employee_requests")),
      getDocs(collection(db, "users")),
      getDocs(collection(db, "salary_slips_archive"))
    ]);

    const totalDocs = attSnap.size + reqSnap.size + usersSnap.size + slipsSnap.size;
    let totalBytes = 0;
    
    attSnap.forEach(d => totalBytes += JSON.stringify(d.data()).length);
    reqSnap.forEach(d => totalBytes += JSON.stringify(d.data()).length);
    usersSnap.forEach(d => totalBytes += JSON.stringify(d.data()).length);
    slipsSnap.forEach(d => totalBytes += JSON.stringify(d.data()).length);

    const usedKB = (totalBytes / 1024).toFixed(2);
    const pctStorage = Math.min(100, ((totalBytes / (1024 * 1024 * 1024)) * 100)).toFixed(1);
    const pctDoc = Math.min(100, (totalDocs / 5000) * 100).toFixed(0);

    const storagePctEl = document.getElementById("it-storage-pct");
    const storageFillEl = document.getElementById("it-storage-fill");
    const storageTextEl = document.getElementById("it-storage-text");
    
    if (storagePctEl) storagePctEl.innerText = `${pctStorage}%`;
    if (storageFillEl) storageFillEl.style.width = `${Math.max(4, pctStorage)}%`;
    if (storageTextEl) storageTextEl.innerText = `${usedKB} KB / 1.024 MB Digunakan`;

    const docPctEl = document.getElementById("it-doc-pct");
    const docFillEl = document.getElementById("it-doc-fill");
    const docTextEl = document.getElementById("it-doc-text");

    if (docPctEl) docPctEl.innerText = `${pctDoc}%`;
    if (docFillEl) docFillEl.style.width = `${Math.max(4, pctDoc)}%`;
    if (docTextEl) docTextEl.innerText = `${totalDocs} Dokumen Terdaftar`;

  } catch (e) {
    console.warn("Gagal hitung metrik:", e);
  }
}

window.refreshITMetrics = async function() {
  window.showLoading("Memperbarui metrik...");
  await calculateDatabaseMetrics();
  await loadITUsersList();
  window.hideLoading();
  notify("Refreshed", "Data metrik kapasitas server berhasil diperbarui.");
};

function initITPanel() {
  calculateDatabaseMetrics();
  loadITUsersList();
}

// MANAJEMEN PENGGUNA IT
async function loadITUsersList() {
  const tbody = document.getElementById("it-users-tbody");
  if (!tbody) return;
  try {
    const snap = await getDocs(collection(db, "users"));
    itUsersCache = [];
    snap.forEach(d => itUsersCache.push({ id: d.id, ...d.data() }));
    renderITUsersTable(itUsersCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-danger">Gagal memuat pengguna.</td></tr>`;
  }
}

function renderITUsersTable(list) {
  const tbody = document.getElementById("it-users-tbody");
  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="placeholder-text">Tidak ada pengguna ditemukan.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => {
    const rawRole = String(u.role || 'staff').toLowerCase();
    const displayRole = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();
    return `
      <tr>
        <td><strong>${u.nama || '-'}</strong><br><small>${u.email || '-'}</small></td>
        <td><span class="badge-status-work">${displayRole}</span></td>
        <td class="text-right">
          <button class="btn-danger-sm" onclick="deleteUserAccount('${u.id}')">Hapus</button>
        </td>
      </tr>
    `;
  }).join("");
}

window.filterITUsersList = function() {
  const q = document.getElementById("it-search-users")?.value.toLowerCase().trim() || "";
  const filtered = itUsersCache.filter(u => 
    (u.email && u.email.toLowerCase().includes(q)) || 
    (u.nama && u.nama.toLowerCase().includes(q)) || 
    (u.role && u.role.toLowerCase().includes(q))
  );
  renderITUsersTable(filtered);
};

window.deleteUserAccount = async function(userId) {
  const isConfirmed = await window.showCustomConfirm("Hapus Akun", "Apakah Anda yakin ingin menghapus data pengguna ini dari database?");
  if (!isConfirmed) return;

  window.showLoading("Menghapus akun pengguna...");
  try {
    await deleteDoc(doc(db, "users", userId));
    window.hideLoading();
    notify("Sukses", "Data pengguna berhasil dihapus.");
    loadITUsersList();
    loadHRUserOptions();
  } catch (err) {
    window.hideLoading();
    notify("Gagal Hapus", err.message);
  }
};

// CROPPER MODAL
window.openCropperModal = function(file, type) {
  currentCropType = type;
  const reader = new FileReader();
  reader.onload = (e) => {
    const cropModal = document.getElementById("crop-modal");
    const cropImg = document.getElementById("cropper-target-img");
    cropImg.src = e.target.result;
    cropModal.classList.remove("hidden");

    if (cropperInstance) cropperInstance.destroy();
    cropperInstance = new Cropper(cropImg, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1
    });
  };
  reader.readAsDataURL(file);
};

// HELPER TELAT
function calculateLateThresholdTime(baseTimeStr, toleranceMin) {
  if (!baseTimeStr) return "07:45:00";
  const [h, m] = baseTimeStr.split(":").map(Number);
  const totalMin = (h * 60) + m + Number(toleranceMin || 0);
  const thH = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
  const thM = String(totalMin % 60).padStart(2, '0');
  return `${thH}:${thM}:00`;
}

// KALKULASI KPI BULANAN REAL AKUMULATIF
async function calculateUserKPI(uid) {
  try {
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7);
    const userRoleKey = String(currentUserData?.role || 'staff').toLowerCase();
    const isITAccount = (userRoleKey === "it");
    
    const roleCfg = ROLE_PARAMS_CACHE[userRoleKey] || DEFAULT_ROLE_PARAMS[userRoleKey] || DEFAULT_ROLE_PARAMS.staff;

    const attSnap = await getDocs(query(
      collection(db, "attendance"),
      where("uid", "==", uid)
    ));

    let totalPresence = 0;
    let wfoCount = 0;
    let wfaCount = 0;
    let lateCount = 0;

    const shiftType = currentUserShift || "pagi";
    let baseStart = roleCfg.pagi_start || "07:30";
    if (shiftType === "malam") baseStart = roleCfg.malam_start || "13:30";
    if (shiftType === "it_flex") baseStart = roleCfg.it_threshold || "10:00";

    const toleranceMinutes = Number(roleCfg.tolerance ?? 15);
    const lateThresholdTime = calculateLateThresholdTime(baseStart, toleranceMinutes);
    const displayThresholdLabel = lateThresholdTime.slice(0, 5);

    attSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.date && data.date.startsWith(currentMonthStr) && data.status === "Hadir") {
        totalPresence++;
        const mode = (data.mode || "").toLowerCase();
        if (mode === "wfo") {
          wfoCount++;
        } else {
          wfaCount++;
        }

        if (data.check_in_time && data.check_in_time > lateThresholdTime) {
          lateCount++;
        }
      }
    });

    currentMonthITWfaCount = wfaCount;

    const targetWorkingDays = 26;
    const targetWFO = Math.ceil(targetWorkingDays * 0.6);
    const targetWFA = targetWorkingDays - targetWFO;

    let attendanceScore = 0;
    if (isITAccount) {
      const effectiveWFO = Math.min(targetWFO, wfoCount);
      const effectiveWFA = Math.min(targetWFA, wfaCount);
      attendanceScore = Math.min(100, Math.round(((effectiveWFO / targetWFO) * 60) + ((effectiveWFA / targetWFA) * 40)));
    } else {
      attendanceScore = Math.min(100, Math.round((totalPresence / targetWorkingDays) * 100));
    }
    attendanceScore = Math.max(0, attendanceScore - (lateCount * 2));

    const defaultTasks = ROLE_DEFAULT_SOP[userRoleKey] || ROLE_DEFAULT_SOP.staff;
    const dailySOPCount = defaultTasks.length;

    const taskLogsSnap = await getDocs(query(
      collection(db, "daily_task_logs"),
      where("uid", "==", uid)
    ));

    let totalPossibleTasksMonth = 0;
    let totalCompletedTasksMonth = 0;

    taskLogsSnap.forEach(d => {
      const log = d.data();
      if (log.date && log.date.startsWith(currentMonthStr)) {
        totalPossibleTasksMonth += dailySOPCount;
        const doneList = log.completed_tasks || [];
        totalCompletedTasksMonth += doneList.length;
      }
    });

    const customTasksSnap = await getDocs(query(
      collection(db, "staff_tasks"),
      where("uid", "==", uid)
    ));

    customTasksSnap.forEach(d => {
      const t = d.data();
      if (t.target_date && t.target_date.startsWith(currentMonthStr)) {
        totalPossibleTasksMonth += 1;
        if (t.completed === true) {
          totalCompletedTasksMonth += 1;
        }
      }
    });

    const taskMonthlyScore = totalPossibleTasksMonth > 0 
  ? Math.round((totalCompletedTasksMonth / totalPossibleTasksMonth) * 100) 
  : 0;

    let finalScore = Math.min(100, Math.round((attendanceScore * 0.7) + (taskMonthlyScore * 0.3)));

    const itBreakdownEl = document.getElementById("it-kpi-breakdown");
    const kpiPanelTitle = document.getElementById("kpi-panel-title");
    const kpiLabelPresence = document.getElementById("kpi-label-presence");
    const kpiLabelSecondary = document.getElementById("kpi-label-secondary");

    if (isITAccount) {
      if (itBreakdownEl) itBreakdownEl.classList.remove("hidden");
      if (kpiPanelTitle) kpiPanelTitle.innerText = "Performa KPI Bulanan";
      if (kpiLabelPresence) kpiLabelPresence.innerText = "Kehadiran";
      if (kpiLabelSecondary) kpiLabelSecondary.innerText = `Terlambat (>${displayThresholdLabel})`;

      const wfoPct = totalPresence > 0 ? Math.round((wfoCount / totalPresence) * 100) : 0;
      const wfaPct = totalPresence > 0 ? Math.round((wfaCount / totalPresence) * 100) : 0;

      const itWfoText = document.getElementById("it-wfo-count-text");
      const itWfaText = document.getElementById("it-wfa-count-text");
      const itWfoRemaining = document.getElementById("it-wfo-remaining-target");
      const itWfaRemaining = document.getElementById("it-wfa-remaining-target");

      if (itWfoText) itWfoText.innerText = `WFO: ${wfoCount} Hari (${wfoPct}%)`;
      if (itWfaText) itWfoText.innerText = `WFA: ${wfaCount} Hari (${wfaPct}%)`;

      const remainingWFO = Math.max(0, targetWFO - wfoCount);
      const remainingWFA = Math.max(0, targetWFA - wfaCount);

      if (itWfoRemaining) {
        itWfoRemaining.innerText = remainingWFO === 0 ? "Target WFO Tercapai ✓" : `Sisa Wajib: ${remainingWFO} Hari (Min 60%)`;
      }
      if (itWfaRemaining) {
        itWfaRemaining.innerText = remainingWFA === 0 ? "Kuota WFA Habis (0 Hari)" : `Sisa Kuota: ${remainingWFA} Hari (Maks 40%)`;
        itWfaRemaining.style.color = remainingWFA === 0 ? "#ff3b30" : "#34c759";
      }
    } else {
      if (itBreakdownEl) itBreakdownEl.classList.add("hidden");
      if (kpiPanelTitle) kpiPanelTitle.innerText = "Performa KPI Bulanan";
      if (kpiLabelPresence) kpiLabelPresence.innerText = "Kehadiran";
      if (kpiLabelSecondary) kpiLabelSecondary.innerText = `Terlambat (>${displayThresholdLabel})`;
    }

    const attCountEl = document.getElementById("kpi-attendance-count");
    const lateCountEl = document.getElementById("kpi-late-count");
    const scoreBadgeEl = document.getElementById("kpi-score-badge");

    if (attCountEl) attCountEl.innerText = `${totalPresence} Hari`;
    if (lateCountEl) lateCountEl.innerText = `${lateCount} Kali`;
    if (scoreBadgeEl) scoreBadgeEl.innerText = `${finalScore}%`;

    let statusText = "Kurang";
    let badgeClass = "badge-kurang";
    let fillClass = "fill-kurang";
    let activeMarkerId = "marker-kurang";

    if (finalScore > 85) {
      statusText = "Memuaskan";
      badgeClass = "badge-memuaskan";
      fillClass = "fill-memuaskan";
      activeMarkerId = "marker-memuaskan";
    } else if (finalScore >= 70) {
      statusText = "Cukup";
      badgeClass = "badge-cukup";
      fillClass = "fill-cukup";
      activeMarkerId = "marker-cukup";
    }

    const statusTagEl = document.getElementById("kpi-status-tag");
    const progressFill = document.getElementById("kpi-progress-fill");

    if (statusTagEl) {
      statusTagEl.innerText = statusText;
      statusTagEl.className = `kpi-level-badge ${badgeClass}`;
    }
    if (progressFill) {
      progressFill.style.width = `${finalScore}%`;
      progressFill.className = `db-progress-fill ${fillClass}`;
    }

    ['marker-kurang', 'marker-cukup', 'marker-memuaskan'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (id === activeMarkerId) {
          el.classList.add('active-scale');
        } else {
          el.classList.remove('active-scale');
        }
      }
    });

    const finalScoreEl = document.getElementById("final-kpi-score-display");
    const finalGradeEl = document.getElementById("final-kpi-grade-display");
    const careerBadgeEl = document.getElementById("user-career-level-badge");
    const careerTitleEl = document.getElementById("user-career-title");

    if (finalScoreEl) finalScoreEl.innerText = `${finalScore}%`;
    if (finalGradeEl) finalGradeEl.innerText = statusText;
    if (careerBadgeEl) careerBadgeEl.innerText = (currentUserData?.career_level || "Junior").toUpperCase();
    if (careerTitleEl) careerTitleEl.innerText = `${currentUserData?.career_level || 'Junior'} Staff`;

  } catch (e) {
    console.error("Gagal menghitung KPI:", e);
  }
}

// ROLE DASHBOARD ACTIONS
function renderRoleQuickActions(role) {
  const container = document.getElementById("dashboard-role-actions");
  if (!container) return;

  const cardTugas = `
    <div class="hr-icon-card" onclick="navigateToTab('tugas')">
      <div class="hr-icon-bubble bg-soft-mint">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4"></path>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
      </div>
      <strong>Tugas & SOP</strong>
      <small>Checklist Harian</small>
    </div>
  `;

  const cardAbsen = `
    <div class="hr-icon-card" onclick="navigateToTab('absensi')">
      <div class="hr-icon-bubble bg-telegram-subtle">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 00-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 00-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>
      </div>
      <strong>Presensi GPS</strong>
      <small>Check-In/Out</small>
    </div>
  `;

  const cardGaji = `
    <div class="hr-icon-card" onclick="navigateToTab('gaji')">
      <div class="hr-icon-bubble bg-soft-mint">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg>
      </div>
      <strong>Gaji</strong>
      <small>Slip & Riwayat</small>
    </div>
  `;

  const cardKasbon = `
    <div class="hr-icon-card" onclick="navigateToTab('kasbon')">
      <div class="hr-icon-bubble bg-soft-amber">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </div>
      <strong>Kasbon</strong>
      <small>Pinjam & Bayar</small>
    </div>
  `;

  const cardCuti = `
    <div class="hr-icon-card" onclick="openEmployeeRequestPage('Cuti')">
      <div class="hr-icon-bubble bg-soft-purple">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <strong>Ajukan Cuti</strong>
      <small>Izin / Libur</small>
    </div>
  `;

  const cardHR = `
    <div class="hr-icon-card" onclick="navigateToTab('hr')">
      <div class="hr-icon-bubble bg-tiktok-cyan">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </div>
      <strong>Modul HR</strong>
      <small>Shift & Parameter</small>
    </div>
  `;

  const cardLaporan = `
    <div class="hr-icon-card" onclick="navigateToTab('accounting')">
      <div class="hr-icon-bubble bg-soft-amber">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
      </div>
      <strong>Laporan KPI</strong>
      <small>Finalisasi & Cert</small>
    </div>
  `;

  const cardRecruitment = `
    <div class="hr-icon-card" onclick="navigateToTab('users')">
      <div class="hr-icon-bubble bg-soft-mint">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
      </div>
      <strong>Recruitment</strong>
      <small>Daftar Staf</small>
    </div>
  `;

  const cardIT = `
    <div class="hr-icon-card" onclick="navigateToTab('it')">
      <div class="hr-icon-bubble bg-tiktok-pink">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      </div>
      <strong>Panel IT</strong>
      <small>Sistem Database</small>
    </div>
  `;

  switch (role) {
    case "staff":
    case "logistik":
      container.innerHTML = cardTugas + cardAbsen + cardGaji + cardKasbon + cardCuti;
      break;
    case "admin":
      container.innerHTML = cardTugas + cardHR + cardLaporan + cardAbsen + cardGaji + cardKasbon + cardCuti;
      break;
    case "gm":
      container.innerHTML = cardTugas + cardHR + cardLaporan + cardRecruitment + cardAbsen + cardGaji + cardKasbon + cardCuti;
      break;
    case "it":
      container.innerHTML = cardTugas + cardIT + cardHR + cardLaporan + cardAbsen + cardGaji + cardKasbon;
      break;
    default:
      container.innerHTML = cardTugas + cardAbsen + cardGaji + cardKasbon + cardCuti;
  }
}

// KOMPILASI SLIP GAJI
async function compileEmployeeSlip(userId, monthStr) {
  const [userDoc, salDoc, attSnap, reqSnap] = await Promise.all([
    getDoc(doc(db, "users", userId)),
    getDoc(doc(db, "salary_structures", userId)),
    getDocs(query(collection(db, "attendance"), where("uid", "==", userId))),
    getDocs(query(collection(db, "employee_requests"), where("uid", "==", userId)))
  ]);

  const userData = userDoc.exists() ? userDoc.data() : {};
  const salData = salDoc.exists() ? salDoc.data() : { base_salary: 0, role_allowance: 0, meal_daily: 15000, bank_account: "-" };
  const userRoleKey = String(userData.role || 'staff').toLowerCase();
  const roleCfg = ROLE_PARAMS_CACHE[userRoleKey] || DEFAULT_ROLE_PARAMS[userRoleKey] || DEFAULT_ROLE_PARAMS.staff;

  let hadirCount = 0;
  let lateCount = 0;
  let totalOvertimeHours = 0;

  const shiftType = userData.shift || "pagi";
  let baseStart = roleCfg.pagi_start || "07:30";
  let baseEnd = roleCfg.pagi_end || "15:30";

  if (shiftType === "malam") {
    baseStart = roleCfg.malam_start || "13:30";
    baseEnd = roleCfg.malam_end || "21:00";
  } else if (shiftType === "it_flex") {
    baseStart = roleCfg.it_threshold || "10:00";
    baseEnd = "18:00";
  }

  const toleranceMinutes = Number(roleCfg.tolerance ?? 15);
  const lateThresholdTime = calculateLateThresholdTime(baseStart, toleranceMinutes);

  attSnap.forEach(d => {
    const item = d.data();
    if (item.date && item.date.startsWith(monthStr) && item.status === "Hadir") {
      hadirCount++;
      
      if (item.check_in_time && item.check_in_time > lateThresholdTime) {
        lateCount++;
      }

      if (item.check_out_time && baseEnd) {
        const [outH, outM] = item.check_out_time.split(":").map(Number);
        const [endH, endM] = baseEnd.split(":").map(Number);
        const outTotalMin = (outH * 60) + outM;
        const endTotalMin = (endH * 60) + endM;

        if (outTotalMin > endTotalMin + 60) {
          const otHours = Math.floor((outTotalMin - endTotalMin) / 60);
          totalOvertimeHours += otHours;
        }
      }
    }
  });

  let kasbonTotal = 0;
  reqSnap.forEach(d => {
    const r = d.data();
    if (r.type === "Kasbon" && r.status === "Approved") {
      const sisaPokok = (Number(r.amount) || 0) - (Number(r.total_paid) || 0);
      if (sisaPokok > 0) {
        const cicilan = Number(r.monthly_installment) || sisaPokok;
        kasbonTotal += Math.min(sisaPokok, cicilan);
      }
    }
  });

  const base = Number(salData.base_salary) || 0;
  const roleAll = Number(salData.role_allowance ?? (CAREER_ALLOWANCE_PRESETS[userData.career_level || 'Junior'] || 0));
  const meal = (Number(salData.meal_daily) || 15000) * hadirCount;
  const overtimePay = totalOvertimeHours * (Number(roleCfg.overtime_rate) || 25000);
  const latePenaltyTotal = lateCount * (Number(roleCfg.late_penalty) || 10000);
  const thp = Math.max(0, base + roleAll + meal + overtimePay - latePenaltyTotal - kasbonTotal);

  return {
    uid: userId,
    nama: userData.nama || userData.email || "Karyawan",
    role: userRoleKey,
    career_level: userData.career_level || "Junior",
    month: monthStr,
    year: monthStr.slice(0, 4),
    bank: salData.bank_account || "BCA (Auto Transfer)",
    hadir: hadirCount,
    telat: lateCount,
    lemburJam: totalOvertimeHours,
    baseSalary: base,
    roleAllowance: roleAll,
    mealTotal: meal,
    overtimePay: overtimePay,
    latePenaltyTotal: latePenaltyTotal,
    kasbon: kasbonTotal,
    takeHomePay: thp
  };
}

// SLIP GAJI BULAN BERJALAN
window.openMyCurrentPayslip = async function() {
  const user = auth.currentUser;
  if (!user) return;

  const currentMonth = new Date().toISOString().slice(0, 7);
  window.showLoading("Memuat slip gaji bulan berjalan...");

  try {
    const slipDoc = await getDoc(doc(db, "salary_slips_archive", `${user.uid}_${currentMonth}`));
    let slipData;

    if (slipDoc.exists()) {
      slipData = slipDoc.data();
    } else {
      slipData = await compileEmployeeSlip(user.uid, currentMonth);
    }

    window.hideLoading();
    window.openPayslipDetail(slipData);
  } catch (err) {
    window.hideLoading();
    notify("Gagal Memuat Slip", err.message);
  }
};

// KUNCI & TERBITKAN SLIP OLEH ADMIN/GM
window.lockAndPublishMonthlySlips = async function() {
  const monthStr = document.getElementById("publish-month-picker")?.value;
  if (!monthStr) return notify("Perhatian", "Pilih bulan penerbitan slip.");

  const confirmPublish = await window.showCustomConfirm(
    "Kunci & Terbitkan Slip", 
    `Terbitkan slip gaji resmi untuk periode ${monthStr}? Saldo kasbon aktif akan otomatis dipotong sesuai skema cicilan.`
  );
  if (!confirmPublish) return;

  window.showLoading("Mengompilasi dan mengarsipkan slip gaji...");

  try {
    const [usersSnap, reqSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "employee_requests"))
    ]);

    let count = 0;

    for (const uDoc of usersSnap.docs) {
      const uid = uDoc.id;
      const slipPayload = await compileEmployeeSlip(uid, monthStr);
      slipPayload.published_at = serverTimestamp();

      for (const rDoc of reqSnap.docs) {
        const r = rDoc.data();
        if (r.uid === uid && r.type === "Kasbon" && r.status === "Approved") {
          const sisaPokok = (Number(r.amount) || 0) - (Number(r.total_paid) || 0);
          if (sisaPokok > 0) {
            const cicilan = Number(r.monthly_installment) || sisaPokok;
            const potonganEfektif = Math.min(sisaPokok, cicilan);
            const totalPaidBaru = (Number(r.total_paid) || 0) + potonganEfektif;
            const isLunas = ((Number(r.amount) || 0) - totalPaidBaru) <= 0;

            await setDoc(doc(db, "employee_requests", rDoc.id), {
              total_paid: totalPaidBaru,
              installment_paid_count: (Number(r.installment_paid_count) || 0) + 1,
              status: isLunas ? "Settled" : "Approved",
              last_deducted_month: monthStr
            }, { merge: true });
          }
        }
      }

      await setDoc(doc(db, "salary_slips_archive", `${uid}_${monthStr}`), slipPayload, { merge: true });
      count++;
    }

    window.hideLoading();
    notify("Sukses", `Berhasil mengunci dan menerbitkan ${count} slip gaji untuk periode ${monthStr}.`);
  } catch (err) {
    window.hideLoading();
    notify("Gagal Menerbitkan Slip", err.message);
  }
};

// INISIALISASI DROPDOWN TAHUN
function populateSlipYearDropdown() {
  const selectYear = document.getElementById("filter-slip-year");
  if (!selectYear) return;

  const currentYear = new Date().getFullYear();
  selectYear.innerHTML = "";

  for (let i = 0; i < 4; i++) {
    const yr = currentYear - i;
    const opt = document.createElement("option");
    opt.value = String(yr);
    opt.innerText = String(yr);
    if (i === 0) opt.selected = true;
    selectYear.appendChild(opt);
  }
}

// RIWAYAT SLIP GAJI
window.renderUserSlipHistory = async function() {
  const user = auth.currentUser;
  if (!user) return;

  const yearSelect = document.getElementById("filter-slip-year");
  if (!yearSelect || yearSelect.children.length === 0) {
    populateSlipYearDropdown();
  }

  const selectedYear = document.getElementById("filter-slip-year")?.value || String(new Date().getFullYear());
  const selectedMonth = document.getElementById("filter-slip-month")?.value || "all";
  const container = document.getElementById("user-slip-history-list");
  const countBadge = document.getElementById("history-total-count");

  if (!container) return;
  container.innerHTML = "<p class='placeholder-text'>Memuat arsip slip gaji...</p>";

  try {
    const snap = await getDocs(query(
      collection(db, "salary_slips_archive"),
      where("uid", "==", user.uid),
      where("month", ">=", `${selectedYear}-01`),
      where("month", "<=", `${selectedYear}-12`),
      orderBy("month", "desc"),
      limit(12)
    ));

    let slips = [];
    snap.forEach(d => {
      const item = { id: d.id, ...d.data() };
      if (selectedMonth === "all" || item.month.endsWith(`-${selectedMonth}`)) {
        slips.push(item);
      }
    });

    if (countBadge) countBadge.innerText = `${slips.length} / 12 Dokumen`;

    if (slips.length === 0) {
      container.innerHTML = `<p class='placeholder-text'>Belum ada arsip slip resmi untuk periode ${selectedYear}${selectedMonth !== 'all' ? '-' + selectedMonth : ''}. Silakan cek 'Slip Gaji Bulan Berjalan' untuk estimasi saat ini.</p>`;
      return;
    }

    container.innerHTML = "";
    slips.forEach(slip => {
      const div = document.createElement("div");
      div.className = "picker-user-row";
      div.style.cursor = "pointer";
      div.onclick = () => window.openPayslipDetail(slip);

      div.innerHTML = `
        <div class="picker-user-meta">
          <strong>Periode: ${slip.month}</strong>
          <small>Take Home Pay: Rp ${Number(slip.takeHomePay).toLocaleString()}</small>
        </div>
        <button class="btn-primary" style="padding:4px 8px; font-size:0.6rem;">Buka Slip</button>
      `;
      container.appendChild(div);
    });
  } catch (e) {
    const fallbackSnap = await getDocs(query(
      collection(db, "salary_slips_archive"),
      where("uid", "==", user.uid),
      limit(24)
    ));

    let slips = [];
    fallbackSnap.forEach(d => {
      const item = { id: d.id, ...d.data() };
      if (item.month && item.month.startsWith(selectedYear)) {
        if (selectedMonth === "all" || item.month.endsWith(`-${selectedMonth}`)) {
          slips.push(item);
        }
      }
    });

    slips.sort((a, b) => b.month.localeCompare(a.month));
    slips = slips.slice(0, 12);

    if (countBadge) countBadge.innerText = `${slips.length} / 12 Dokumen`;

    if (slips.length === 0) {
      container.innerHTML = `<p class='placeholder-text'>Belum ada arsip slip resmi untuk periode ${selectedYear}.</p>`;
      return;
    }

    container.innerHTML = "";
    slips.forEach(slip => {
      const div = document.createElement("div");
      div.className = "picker-user-row";
      div.style.cursor = "pointer";
      div.onclick = () => window.openPayslipDetail(slip);

      div.innerHTML = `
        <div class="picker-user-meta">
          <strong>Periode: ${slip.month}</strong>
          <small>Take Home Pay: Rp ${Number(slip.takeHomePay).toLocaleString()}</small>
        </div>
        <button class="btn-primary" style="padding:4px 8px; font-size:0.6rem;">Buka Slip</button>
      `;
      container.appendChild(div);
    });
  }
};

window.openPayslipDetail = function(data) {
  if (!data) return;
  currentPayslipCache = data;
  const box = document.getElementById("payslip-page-content-box");
  const sigName = document.getElementById("payslip-sig-name");
  const docIdEl = document.getElementById("slip-meta-doc-id");
  if (!box) return;

  const docCode = `DOC-${data.month.replace("-", "")}-${data.uid.slice(0, 5).toUpperCase()}`;
  if (sigName) sigName.innerText = data.nama || "Karyawan";
  if (docIdEl) docIdEl.innerText = docCode;

  const rawRole = String(data.role || 'staff').toLowerCase();
  const displayRole = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();

  box.innerHTML = `
    <div class="corp-slip-divider"></div>

    <div class="payslip-meta-grid">
      <div class="payslip-meta-item">
        <small>NAMA STAF</small>
        <strong>${data.nama}</strong>
      </div>
      <div class="payslip-meta-item">
        <small>JABATAN / ROLE</small>
        <strong>${displayRole} (${(data.career_level || 'Junior').toUpperCase()})</strong>
      </div>
      <div class="payslip-meta-item">
        <small>PERIODE GAJI</small>
        <strong>${data.month}</strong>
      </div>
      <div class="payslip-meta-item">
        <small>REKENING PENERIMA</small>
        <strong>${data.bank || '-'}</strong>
      </div>
    </div>

    <div class="payslip-section-heading">RINCIAN PENGHASILAN (INCOME)</div>
    <div class="payslip-item-row">
      <span>Gaji Pokok</span>
      <strong>Rp ${(data.baseSalary || 0).toLocaleString()}</strong>
    </div>
    <div class="payslip-item-row">
      <span>Tunjangan Jabatan</span>
      <strong>Rp ${(data.roleAllowance || 0).toLocaleString()}</strong>
    </div>
    <div class="payslip-item-row">
      <span>Uang Makan (${data.hadir || 0} Hari)</span>
      <strong>Rp ${(data.mealTotal || 0).toLocaleString()}</strong>
    </div>
    ${(data.overtimePay > 0) ? `
      <div class="payslip-item-row" style="color:#1A4B8B;">
        <span>Upah Lembur (${data.lemburJam || 0} Jam)</span>
        <strong>+ Rp ${data.overtimePay.toLocaleString()}</strong>
      </div>
    ` : ''}

    <div class="payslip-section-heading">POTONGAN (DEDUCTION)</div>
    <div class="payslip-item-row text-deduct">
      <span>Denda Keterlambatan (${data.telat || 0}x)</span>
      <strong>- Rp ${(data.latePenaltyTotal || 0).toLocaleString()}</strong>
    </div>
    <div class="payslip-item-row text-deduct">
      <span>Pinjaman Kasbon</span>
      <strong>- Rp ${(data.kasbon || 0).toLocaleString()}</strong>
    </div>

    <div class="payslip-total-block">
      <span>GAJI BERSIH (TAKE HOME PAY)</span>
      <strong>Rp ${(data.takeHomePay || 0).toLocaleString()}</strong>
    </div>
  `;

  // GATING LOCK PENARIKAN GAJI (POIN 2: PERUBAHAN TULISAN TAHAP ADMINISTRASI)
  const btnClaim = document.getElementById("btn-claim-salary-action");
  const claimLabel = document.getElementById("claim-btn-label");

  if (btnClaim && claimLabel) {
    const isPublished = Boolean(data.published_at);
    const isBankRegistered = data.bank && data.bank !== "-" && !data.bank.includes("Belum");

    if (!isPublished) {
      btnClaim.disabled = true;
      btnClaim.style.background = "#8e8e93";
      btnClaim.style.cursor = "not-allowed";
      claimLabel.innerText = "Tahap Administrasi";
    } else if (!isBankRegistered && data.disbursement_method === "transfer") {
      btnClaim.disabled = true;
      btnClaim.style.background = "#ff9500";
      btnClaim.style.cursor = "not-allowed";
      claimLabel.innerText = "Rekening Belum Diverifikasi GM";
    } else if (data.disbursement_status === "Paid" || data.disbursement_status === "Claimed") {
      btnClaim.disabled = true;
      btnClaim.style.background = "#34c759";
      claimLabel.innerText = "Gaji Sudah Dicairkan ✓";
    } else if (data.disbursement_status === "Waiting_Cash_Scan") {
      btnClaim.disabled = false;
      btnClaim.style.background = "var(--text-accent)";
      claimLabel.innerText = `Lihat QR Pencairan (${data.voucher_code || 'Tunai'})`;
      btnClaim.onclick = () => showQRReceipt(data.voucher_code || "AIWA-CASH", data);
    } else if (data.disbursement_status === "Pending_Transfer") {
      btnClaim.disabled = true;
      btnClaim.style.background = "#ff9500";
      claimLabel.innerText = "Menunggu Verifikasi Transfer GM";
    } else {
      btnClaim.disabled = false;
      btnClaim.style.background = "var(--text-accent)";
      claimLabel.innerText = "Tarik Gaji Ini";
      btnClaim.onclick = () => window.openClaimSalaryPage();
    }
  }

  window.navigateToTab('payslip-page', true);
};

// NAVIGASI LAMAN TARIK GAJI
window.openClaimSalaryPage = async function() {
  if (!currentPayslipCache) return notify("Perhatian", "Data slip tidak ditemukan.");
  
  if (currentPayslipCache.disbursement_status === "Claimed" || currentPayslipCache.disbursement_status === "Paid") {
    return notify("Informasi", "Gaji periode ini sudah dicairkan.");
  }

  try {
    const salDoc = await getDoc(doc(db, "salary_structures", currentPayslipCache.uid));
    const registeredAcc = salDoc.exists() ? (salDoc.data().bank_account || "-") : "-";
    
    const regLabelEl = document.getElementById("registered-bank-info-label");
    if (regLabelEl) {
      regLabelEl.innerText = registeredAcc !== "-" ? registeredAcc : "Belum didaftarkan oleh GM";
    }
  } catch (e) {
    console.warn("Gagal memuat rekening terdaftar:", e);
  }

  window.selectDisbursementMethod("cash");
  window.navigateToTab("claim-salary");
};

window.selectDisbursementMethod = function(method) {
  selectedDisbursementType = method;
  const cardCash = document.getElementById("card-method-cash");
  const cardTransfer = document.getElementById("card-method-transfer");
  const boxCash = document.getElementById("box-cash-detail");
  const boxTransfer = document.getElementById("box-transfer-detail");

  if (method === "cash") {
    cardCash?.classList.add("active-method");
    cardTransfer?.classList.remove("active-method");
    boxCash?.classList.remove("hidden");
    boxTransfer?.classList.add("hidden");
  } else {
    cardTransfer?.classList.add("active-method");
    cardCash?.classList.remove("active-method");
    boxTransfer?.classList.remove("hidden");
    boxCash?.classList.add("hidden");
  }
};

window.submitSalaryDisbursement = async function() {
  if (!currentPayslipCache) return;
  const user = auth.currentUser;
  if (!user) return;

  const now = Date.now();
  const expiresAtMillis = now + (24 * 60 * 60 * 1000);
  const slipKey = `${currentPayslipCache.uid}_${currentPayslipCache.month}`;
  const voucherCode = `AIWA-${currentPayslipCache.month.replace("-", "")}-${Math.floor(1000 + Math.random() * 9000)}`;

  let bankNote = "Pencairan TUNAI di Kantor Finance";

  if (selectedDisbursementType === "transfer") {
    const bankName = document.getElementById("transfer-bank-select")?.value;
    const accNum = document.getElementById("transfer-acc-number")?.value.trim();
    const accName = document.getElementById("transfer-acc-name")?.value.trim();

    if (!accNum || !accName) {
      return notify("Perhatian", "Lengkapi nomor rekening dan nama pemilik rekening.");
    }

    window.showLoading("Memverifikasi kecocokan rekening...");

    try {
      const salDoc = await getDoc(doc(db, "salary_structures", user.uid));
      if (!salDoc.exists() || !salDoc.data().bank_number) {
        window.hideLoading();
        return notify("Rekening Belum Terdaftar", "Rekening Anda belum didaftarkan di sistem oleh GM. Silakan hubungi GM/HR terlebih dahulu.");
      }

      const regData = salDoc.data();
      const registeredNumber = String(regData.bank_number).trim();

      if (accNum !== registeredNumber) {
        window.hideLoading();
        return notify(
          "Rekening Tidak Cocok", 
          `Nomor rekening (${accNum}) tidak cocok dengan data resmi yang didaftarkan GM (${regData.bank_name} - ${registeredNumber} a.n ${regData.bank_holder}).`
        );
      }

      bankNote = `Transfer Bank: ${bankName} - ${accNum} a.n ${accName}`;
    } catch (err) {
      window.hideLoading();
      return notify("Gagal Validasi", err.message);
    }
  }

  window.showLoading("Memproses pengajuan penarikan...");

  try {
    const claimPayload = {
      uid: user.uid,
      nama: currentPayslipCache.nama,
      role: currentPayslipCache.role,
      month: currentPayslipCache.month,
      amount: currentPayslipCache.takeHomePay,
      method: selectedDisbursementType,
      voucher_code: voucherCode,
      note: `Pencairan ${selectedDisbursementType.toUpperCase()} (Kode: ${voucherCode}) - ${bankNote}`,
      disbursement_status: selectedDisbursementType === "cash" ? "Waiting_Cash_Scan" : "Pending_Transfer",
      status: "Pending",
      requested_at: serverTimestamp(),
      requested_millis: now,
      expires_at_millis: expiresAtMillis
    };

    await setDoc(doc(db, "employee_requests", `PAY_${slipKey}`), {
      type: "Tarik Gaji",
      ...claimPayload
    }, { merge: true });

    await setDoc(doc(db, "salary_slips_archive", slipKey), {
      ...currentPayslipCache,
      disbursement_status: claimPayload.disbursement_status,
      disbursement_method: selectedDisbursementType,
      voucher_code: voucherCode,
      expires_at_millis: expiresAtMillis
    }, { merge: true });

    currentPayslipCache.disbursement_status = claimPayload.disbursement_status;
    currentPayslipCache.voucher_code = voucherCode;
    currentPayslipCache.expires_at_millis = expiresAtMillis;

    window.hideLoading();

    if (selectedDisbursementType === "cash") {
      showQRReceipt(voucherCode, currentPayslipCache);
    } else {
      notify("Pengajuan Terkirim", "Nomor rekening terverifikasi cocok! Pengajuan transfer telah diteruskan ke GM (Berlaku 1x24 Jam).");
      window.navigateToTab("payslip-page");
    }

    window.openPayslipDetail(currentPayslipCache);
    loadHRRequestsList();
  } catch (err) {
    window.hideLoading();
    notify("Gagal Memproses", err.message);
  }
};

function showQRReceipt(voucherCode, slipData) {
  const modal = document.getElementById("qr-receipt-modal");
  const codeEl = document.getElementById("claim-voucher-code");
  const qrContainer = document.getElementById("qrcode-container");
  const expiryEl = document.getElementById("qr-expiry-info");

  if (codeEl) codeEl.innerText = voucherCode;

  if (expiryEl && slipData.expires_at_millis) {
    const expDate = new Date(slipData.expires_at_millis);
    const expTimeStr = expDate.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
    const expDateStr = expDate.toLocaleDateString("id-ID", { day: 'numeric', month: 'short' });
    expiryEl.innerHTML = `Batas Berlaku: <b style="color:#ff3b30;">${expDateStr}, ${expTimeStr} WITA (1x24 Jam)</b>`;
  }

  if (qrContainer) {
    qrContainer.innerHTML = "";
    if (window.QRCode) {
      qrCodeInstance = new QRCode(qrContainer, {
        text: JSON.stringify({
          app: "MYAIWA_PAYROLL",
          code: voucherCode,
          uid: slipData.uid,
          nama: slipData.nama,
          month: slipData.month,
          thp: slipData.takeHomePay,
          exp: slipData.expires_at_millis
        }),
        width: 160,
        height: 160,
        colorDark: "#1A4B8B",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  modal?.classList.remove("hidden");
}

window.closeQRReceiptModal = function() {
  document.getElementById("qr-receipt-modal")?.classList.add("hidden");
};

// SCANNER QR GM UNTUK VALIDASI GAJI & KASBON (POIN 8)
window.openGMScannerModal = function() {
  const modal = document.getElementById("gm-scanner-modal");
  modal?.classList.remove("hidden");

  if (window.Html5Qrcode) {
    html5QrScanner = new Html5Qrcode("reader");
    html5QrScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (decodedText) => {
        try {
          const payload = JSON.parse(decodedText);
          if (payload.code) {
            window.closeGMScannerModal();
            validateScannedOperationalCode(payload.code);
          } else {
            notify("QR Tidak Dikenal", "Format QR Code tidak valid.");
          }
        } catch (e) {
          window.closeGMScannerModal();
          validateScannedOperationalCode(decodedText);
        }
      },
      () => {}
    ).catch(() => {});
  }
};

window.closeGMScannerModal = function() {
  if (html5QrScanner) {
    html5QrScanner.stop()
      .then(() => {
        html5QrScanner.clear();
        html5QrScanner = null;
      })
      .catch(() => {
        html5QrScanner = null;
      });
  }
  document.getElementById("gm-scanner-modal")?.classList.add("hidden");
};

window.validateManualVoucherCode = function() {
  const code = document.getElementById("input-manual-voucher-code")?.value.trim().toUpperCase();
  if (!code) return notify("Perhatian", "Masukkan kode voucher.");
  window.closeGMScannerModal();
  validateScannedOperationalCode(code);
};

async function validateScannedOperationalCode(voucherCode) {
  window.showLoading("Memvalidasi kode voucher...");

  try {
    const q = query(
      collection(db, "employee_requests"), 
      where("voucher_code", "==", voucherCode)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      window.hideLoading();
      return notify("Kode Tidak Valid", `Tidak ditemukan pengajuan dengan kode ${voucherCode}.`);
    }

    const targetDoc = snap.docs[0];
    const reqData = targetDoc.data();

    const now = Date.now();
    if (reqData.expires_at_millis && now > reqData.expires_at_millis) {
      await setDoc(doc(db, "employee_requests", targetDoc.id), { status: "Expired", expired_at_millis: now }, { merge: true });
      window.hideLoading();
      return notify("Kode Kedaluwarsa", "Batas waktu QRIS / Voucher telah habis.");
    }

    if (reqData.status === "Approved") {
      window.hideLoading();
      return notify("Sudah Divalidasi", `Transaksi ${reqData.type} ${reqData.nama} sudah selesai.`);
    }

    const confirmApprove = await window.showCustomConfirm(
      `Konfirmasi ${reqData.type}`,
      `Validasi ${reqData.type} untuk ${reqData.nama} sejumlah Rp ${Number(reqData.amount).toLocaleString()}?`
    );

    if (confirmApprove) {
      await window.approveDisbursement(targetDoc.id, reqData.uid, reqData.month);
    } else {
      window.hideLoading();
    }
  } catch (err) {
    window.hideLoading();
    notify("Gagal Validasi", err.message);
  }
}

// EKSPOR DOKUMEN SLIP GAJI (POIN 3)
window.openShareOptionsModal = function() {
  document.getElementById("share-options-modal")?.classList.remove("hidden");
};

window.closeShareOptionsModal = function() {
  document.getElementById("share-options-modal")?.classList.add("hidden");
};

window.printPayslip = function() {
  window.print();
};

window.exportPayslipFile = async function(formatType) {
  if (!currentPayslipCache) return notify("Perhatian", "Data slip tidak ditemukan.");
  window.closeShareOptionsModal();

  const data = currentPayslipCache;
  const rawRole = String(data.role || 'staff').toLowerCase();
  const displayRole = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();
  const docCode = `DOC-${data.month.replace("-", "")}-${data.uid.slice(0, 5).toUpperCase()}`;
  const fileName = `SLIP_GAJI_${(data.nama || 'Karyawan').replace(/\s+/g, '_')}_${data.month}`;

  window.showLoading(`Menyiapkan berkas ${formatType.toUpperCase()}...`);

  try {
    if (formatType === "doc") {
      const wordHTML = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>Slip Gaji - ${data.nama}</title>
          <style>
            body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 10pt; color: #0f172a; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .header-table td { vertical-align: top; }
            .title { font-size: 14pt; font-weight: bold; color: #0f172a; }
            .sub { font-size: 7.5pt; font-weight: bold; color: #64748b; margin-top: 2px; }
            .badge { background-color: #dcfce7; color: #16a34a; padding: 3px 8px; font-size: 7.5pt; font-weight: bold; border-radius: 4px; }
            .doc-id { font-size: 7.5pt; color: #94a3b8; margin-top: 4px; font-family: monospace; }
            .divider { border-top: 2.5px solid #1A4B8B; margin: 10px 0; }
            .meta-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; }
            .meta-label { font-size: 7pt; color: #94a3b8; font-weight: bold; }
            .meta-val { font-size: 9.5pt; color: #0f172a; font-weight: bold; }
            .sec-title { font-size: 8pt; font-weight: bold; color: #64748b; padding-top: 12px; }
            .item-row td { padding: 5px 0; font-size: 9pt; }
            .item-deduct td { color: #ef4444; font-weight: 600; padding: 5px 0; font-size: 9pt; }
            .total-box { background-color: #f1f5f9; border-radius: 8px; padding: 10px; }
            .total-label { font-size: 9pt; font-weight: bold; color: #0f172a; }
            .total-amount { font-size: 13pt; font-weight: bold; color: #1A4B8B; text-align: right; }
            .sig-table { margin-top: 30px; font-size: 8pt; color: #64748b; }
            .sig-name { font-size: 9pt; font-weight: bold; color: #0f172a; border-top: 1.5px solid #0f172a; padding-top: 3px; display: inline-block; min-width: 150px; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <div class="title">AIWA RAGIN JAJE</div>
                <div class="sub">PAYROLL DISBURSEMENT SYSTEM · CONFIDENTIAL</div>
              </td>
              <td align="right">
                <span class="badge">TERVERIFIKASI SISTEM</span><br>
                <div class="doc-id">${docCode}</div>
              </td>
            </tr>
          </table>

          <div class="divider"></div>

          <div class="meta-box">
            <table>
              <tr>
                <td width="50%"><span class="meta-label">NAMA STAF</span><br><span class="meta-val">${data.nama}</span></td>
                <td width="50%"><span class="meta-label">JABATAN / ROLE</span><br><span class="meta-val">${displayRole}</span></td>
              </tr>
              <tr>
                <td style="padding-top:6px;"><span class="meta-label">PERIODE GAJI</span><br><span class="meta-val">${data.month}</span></td>
                <td style="padding-top:6px;"><span class="meta-label">REKENING PENERIMA</span><br><span class="meta-val">${data.bank || '-'}</span></td>
              </tr>
            </table>
          </div>

          <div class="sec-title">RINCIAN PENGHASILAN (INCOME)</div>
          <table>
            <tr class="item-row"><td>Gaji Pokok</td><td align="right"><b>Rp ${(data.baseSalary || 0).toLocaleString()}</b></td></tr>
            <tr class="item-row"><td>Tunjangan Jabatan</td><td align="right"><b>Rp ${(data.roleAllowance || 0).toLocaleString()}</b></td></tr>
            <tr class="item-row"><td>Uang Makan (${data.hadir || 0} Hari)</td><td align="right"><b>Rp ${(data.mealTotal || 0).toLocaleString()}</b></td></tr>
            ${(data.overtimePay > 0) ? `<tr class="item-row" style="color:#1A4B8B;"><td>Upah Lembur (${data.lemburJam || 0} Jam)</td><td align="right"><b>+ Rp ${data.overtimePay.toLocaleString()}</b></td></tr>` : ''}
          </table>

          <div class="sec-title">POTONGAN (DEDUCTION)</div>
          <table>
            <tr class="item-deduct"><td>Denda Keterlambatan (${data.telat || 0}x)</td><td align="right">- Rp ${(data.latePenaltyTotal || 0).toLocaleString()}</td></tr>
            <tr class="item-deduct"><td>Pinjaman Kasbon</td><td align="right">- Rp ${(data.kasbon || 0).toLocaleString()}</td></tr>
          </table>

          <div class="total-box" style="margin-top:14px;">
            <table>
              <tr>
                <td class="total-label">GAJI BERSIH (TAKE HOME PAY)</td>
                <td class="total-amount">Rp ${(data.takeHomePay || 0).toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <table class="sig-table">
            <tr>
              <td width="50%">Diterbitkan Resmi,<br><br><br><br><span class="sig-name">Finance & HR Management</span></td>
              <td width="50%" align="right">Penerima Manfaat,<br><br><br><br><span class="sig-name" style="text-align:right;">${data.nama}</span></td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff', wordHTML], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.doc`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      window.hideLoading();
      notify("Sukses", "Slip gaji berhasil diekspor sebagai file Word (DOC).");
    } 
    else if (formatType === "pdf") {
      if (!window.jspdf) throw new Error("Library jsPDF belum dimuat.");
      const { jsPDF } = window.jspdf;
      const docPdf = new jsPDF("p", "pt", "a4");

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(14);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text("AIWA RAGIN JAJE", 45, 52);

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(7.5);
      docPdf.setTextColor(100, 116, 139);
      docPdf.text("PAYROLL DISBURSEMENT SYSTEM · CONFIDENTIAL", 45, 65);

      docPdf.setFillColor(220, 252, 231);
      docPdf.roundedRect(425, 40, 125, 16, 3, 3, "F");
      docPdf.setFontSize(7.5);
      docPdf.setTextColor(22, 163, 74);
      docPdf.text("TERVERIFIKASI SISTEM", 436, 51);

      docPdf.setFont("courier", "normal");
      docPdf.setFontSize(8);
      docPdf.setTextColor(148, 163, 184);
      docPdf.text(docCode, 550, 66, { align: "right" });

      docPdf.setDrawColor(26, 75, 139);
      docPdf.setLineWidth(2.5);
      docPdf.line(45, 78, 550, 78);

      docPdf.setFillColor(248, 250, 252);
      docPdf.setDrawColor(241, 245, 249);
      docPdf.roundedRect(45, 92, 505, 54, 8, 8, "FD");

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(7);
      docPdf.setTextColor(148, 163, 184);
      docPdf.text("NAMA STAF", 58, 108);
      docPdf.text("JABATAN / ROLE", 300, 108);

      docPdf.setFontSize(9);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text(data.nama, 58, 120);
      docPdf.text(displayRole, 300, 120);

      docPdf.setFontSize(7);
      docPdf.setTextColor(148, 163, 184);
      docPdf.text("PERIODE GAJI", 58, 133);
      docPdf.text("REKENING PENERIMA", 300, 133);

      docPdf.setFontSize(9);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text(data.month, 58, 143);
      docPdf.text(data.bank || "-", 300, 143);

      let y = 172;
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(8);
      docPdf.setTextColor(100, 116, 139);
      docPdf.text("RINCIAN PENGHASILAN (INCOME)", 45, y);

      y += 16;
      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(9);
      docPdf.setTextColor(15, 23, 42);

      const incomeList = [
        ["Gaji Pokok", `Rp ${(data.baseSalary || 0).toLocaleString()}`],
        ["Tunjangan Jabatan", `Rp ${(data.roleAllowance || 0).toLocaleString()}`],
        [`Uang Makan (${data.hadir || 0} Hari)`, `Rp ${(data.mealTotal || 0).toLocaleString()}`]
      ];
      if (data.overtimePay > 0) incomeList.push([`Upah Lembur (${data.lemburJam || 0} Jam)`, `+ Rp ${data.overtimePay.toLocaleString()}`]);

      incomeList.forEach(item => {
        docPdf.text(item[0], 48, y);
        docPdf.setFont("helvetica", "bold");
        docPdf.text(item[1], 548, y, { align: "right" });
        docPdf.setFont("helvetica", "normal");
        y += 16;
      });

      y += 6;
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(8);
      docPdf.setTextColor(100, 116, 139);
      docPdf.text("POTONGAN (DEDUCTION)", 45, y);

      y += 16;
      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(9);
      docPdf.setTextColor(239, 68, 68);

      const deductList = [
        [`Denda Keterlambatan (${data.telat || 0}x)`, `- Rp ${(data.latePenaltyTotal || 0).toLocaleString()}`],
        ["Pinjaman Kasbon", `- Rp ${(data.kasbon || 0).toLocaleString()}`]
      ];

      deductList.forEach(item => {
        docPdf.text(item[0], 48, y);
        docPdf.setFont("helvetica", "bold");
        docPdf.text(item[1], 548, y, { align: "right" });
        docPdf.setFont("helvetica", "normal");
        y += 16;
      });

      y += 10;
      docPdf.setFillColor(241, 245, 249);
      docPdf.roundedRect(45, y, 505, 34, 6, 6, "F");

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(9);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text("GAJI BERSIH (TAKE HOME PAY)", 58, y + 21);

      docPdf.setFontSize(12);
      docPdf.setTextColor(26, 75, 139);
      docPdf.text(`Rp ${(data.takeHomePay || 0).toLocaleString()}`, 540, y + 22, { align: "right" });

      y += 68;
      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(8);
      docPdf.setTextColor(100, 116, 139);
      docPdf.text("Diterbitkan Resmi,", 48, y);
      docPdf.text("Penerima Manfaat,", 400, y);

      y += 35;
      docPdf.setDrawColor(15, 23, 42);
      docPdf.setLineWidth(1.2);
      docPdf.line(48, y, 190, y);
      docPdf.line(400, y, 545, y);

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(8.5);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text("Finance & HR Management", 48, y + 10);
      docPdf.text(data.nama, 400, y + 10);

      docPdf.save(`${fileName}.pdf`);
      window.hideLoading();
      notify("Sukses", "Slip gaji berhasil diunduh sebagai PDF.");
    }
    else if (formatType === "image") {
      const element = document.getElementById("printable-payslip");
      if (!window.html2canvas) throw new Error("Library HTML2Canvas belum siap.");

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true
      });

      const imgData = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.download = `${fileName}.png`;
      a.href = imgData;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.hideLoading();
      notify("Sukses", "Slip gaji berhasil diunduh sebagai gambar PNG.");
    }
  } catch (err) {
    window.hideLoading();
    notify("Gagal Ekspor", err.message);
  }
};

// BACKUP & EXPORT DATA MASSAL
window.exportDatabaseBackup = async function(format = "json") {
  const targetCol = document.getElementById("export-target-col")?.value || "all";
  window.showLoading(`Menyiapkan backup data massal (${format.toUpperCase()})...`);

  const collectionsToFetch = targetCol === "all" 
    ? ["attendance", "users", "salary_slips_archive", "employee_requests", "salary_structures", "staff_tasks", "daily_task_logs"]
    : [targetCol];

  try {
    const backupBundle = {};

    for (const colName of collectionsToFetch) {
      const snap = await getDocs(collection(db, colName));
      backupBundle[colName] = [];
      snap.forEach(d => {
        const item = d.data();
        if (item.timestamp && typeof item.timestamp.toDate === "function") {
          item.timestamp = item.timestamp.toDate().toISOString();
        }
        if (item.created_at && typeof item.created_at.toDate === "function") {
          item.created_at = item.created_at.toDate().toISOString();
        }
        backupBundle[colName].push({ id: d.id, ...item });
      });
    }

    const timestampStr = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      const jsonContent = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupBundle, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonContent);
      downloadAnchor.setAttribute("download", `BACKUP_MYAIWA_${targetCol.toUpperCase()}_${timestampStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else if (format === "xlsx") {
      if (!window.XLSX) throw new Error("Library XLSX belum siap.");

      const wb = XLSX.utils.book_new();
      let sheetCount = 0;

      for (const colName of collectionsToFetch) {
        if (backupBundle[colName].length > 0) {
          const ws = XLSX.utils.json_to_sheet(backupBundle[colName]);
          XLSX.utils.book_append_sheet(wb, ws, colName.slice(0, 31));
          sheetCount++;
        }
      }

      if (sheetCount === 0) {
        window.hideLoading();
        return notify("Perhatian", "Tidak ada data pada koleksi yang dipilih.");
      }

      XLSX.writeFile(wb, `BACKUP_MYAIWA_${targetCol.toUpperCase()}_${timestampStr}.xlsx`);
    }

    window.hideLoading();
    notify("Sukses", `Backup data massal berhasil diunduh (${format.toUpperCase()}).`);
  } catch (err) {
    window.hideLoading();
    notify("Gagal Backup", err.message);
  }
};

// PEMBERSIHAN MASSAL DATABASE
window.executeMassDatabaseWipe = async function() {
  const isConfirmed1 = await window.showCustomConfirm(
    "Peringatan Keras", 
    "Apakah Anda yakin ingin MENGHAPUS SEMUA DATA transaksi (Absensi, Pengajuan, Slip Gaji, Struktur)? Data akun pengguna akan tetap aman."
  );
  if (!isConfirmed1) return;

  const isConfirmed2 = await window.showCustomConfirm(
    "Konfirmasi Terakhir", 
    "Aksi ini TIDAK DAPAT DIBATALKAN. Pastikan Anda sudah mengunduh Backup JSON/Excel terlebih dahulu. Lanjutkan pembersihan?"
  );
  if (!isConfirmed2) return;

  window.showLoading("Membersihkan database secara massal...");

  const collectionsToWipe = ["attendance", "salary_slips_archive", "employee_requests", "salary_structures", "daily_task_logs", "staff_tasks"];
  let totalDeleted = 0;

  try {
    for (const colName of collectionsToWipe) {
      const snap = await getDocs(collection(db, colName));
      for (const docSnap of snap.docs) {
        await deleteDoc(doc(db, colName, docSnap.id));
        totalDeleted++;
      }
    }

    window.hideLoading();
    notify("Pembersihan Selesai", `Berhasil menghapus ${totalDeleted} dokumen data riwayat.`);
    
    checkTodayAttendance();
    calculateUserKPI(auth.currentUser?.uid);
    calculateDatabaseMetrics();
    loadDailyTaskChecklist();
  } catch (err) {
    window.hideLoading();
    notify("Gagal Membersihkan DB", err.message);
  }
};

// AUDIT LOGS
async function loadAuditLogs() {
  const container = document.getElementById("it-logs-container");
  if (!container) return;
  
  if (rawAuditLogsCache.length > 0) {
    renderAuditLogsList(rawAuditLogsCache);
  } else {
    container.innerHTML = "<p class='placeholder-text'>Memuat data riwayat log...</p>";
  }

  try {
    const snap = await getDocs(query(collection(db, "attendance"), limit(50)));
    rawAuditLogsCache = [];
    
    snap.forEach(d => {
      rawAuditLogsCache.push({ id: d.id, ...d.data() });
    });

    rawAuditLogsCache.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    renderAuditLogsList(rawAuditLogsCache);
  } catch (e) {
    container.innerHTML = `<p class='placeholder-text' style='color:#ff3b30;'>Gagal memuat: ${e.message}</p>`;
  }
}

function renderAuditLogsList(list) {
  const container = document.getElementById("it-logs-container");
  if (!container) return;
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = "<p class='placeholder-text'>Belum ada log aktivitas tercatat.</p>";
    return;
  }

  list.forEach(log => {
    const rawRole = String(log.role || 'staff').toLowerCase();
    const displayRole = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();

    const div = document.createElement("div");
    div.style.padding = "7px 0";
    div.style.borderBottom = "0.5px solid var(--border-color)";
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.alignItems = "center";

    div.innerHTML = `
      <div>
        <strong style="color:var(--text-primary); font-size:0.68rem;">${log.nama || 'Pengguna'}</strong>
        <span class="badge-status-work" style="font-size:0.5rem; padding:1px 4px; margin-left:4px;">${displayRole}</span>
        <br>
        <small style="color:var(--text-secondary); font-size:0.58rem;">
          ${log.date || '-'} · In: ${log.check_in_time || '--:--'} | Out: ${log.check_out_time || '--:--'}
        </small>
      </div>
    `;
    container.appendChild(div);
  });
}

window.filterAuditLogs = function() {
  const q = document.getElementById("log-search-input")?.value.toLowerCase().trim() || "";
  const dateVal = document.getElementById("log-date-filter")?.value || "";

  const filtered = rawAuditLogsCache.filter(item => {
    const matchName = !q || (item.nama && item.nama.toLowerCase().includes(q)) || (item.status && item.status.toLowerCase().includes(q));
    const matchDate = !dateVal || item.date === dateVal;
    return matchName && matchDate;
  });

  renderAuditLogsList(filtered);
};

// DAFTAR KARYAWAN
async function loadHRUserOptions() {
  try {
    const snap = await getDocs(collection(db, "users"));
    allEmployeesCache = [];
    snap.forEach(docSnap => {
      allEmployeesCache.push({ id: docSnap.id, ...docSnap.data() });
    });
  } catch (e) {
    console.error("Gagal load karyawan:", e);
  }
}

// SAAT KARYAWAN DIPILIH DI MENU HR
window.onHRUserSelected = function(userId) {
  const employee = allEmployeesCache.find(u => u.id === userId);
  if (!employee) return;

  const rawRole = String(employee.role || 'staff').toLowerCase();
  const currentShift = employee.shift || "pagi";

  updateAllShiftCardsTimeDisplay();

  if (rawRole === "it") {
    window.selectRoleShiftCard("it_flex", "it");
    window.selectWorkModePill(employee.work_mode || "wfa");
  } else if (rawRole === "gm") {
    window.selectRoleShiftCard("pagi", "gm");
    window.selectWorkModePill(employee.work_mode || "wfo");
  } else {
    window.selectRoleShiftCard(currentShift, rawRole);
    window.selectWorkModePill(employee.work_mode || "wfo");
  }
};

// DAFTAR PENGAJUAN STAF & RETENSI PEMBERSIHAN OTOMATIS
async function loadHRRequestsList() {
  const listEl = document.getElementById("hr-requests-list");
  if (!listEl) return;

  try {
    const snap = await getDocs(query(collection(db, "employee_requests"), limit(40)));
    listEl.innerHTML = "";
    if (snap.empty) {
      listEl.innerHTML = "<p class='placeholder-text'>Belum ada pengajuan staf.</p>";
      return;
    }

    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    for (const d of snap.docs) {
      const item = d.data();
      const docId = d.id;

      const reqTime = item.requested_millis || (item.requested_at?.toDate ? item.requested_at.toDate().getTime() : 0);

      if ((item.status === "Approved" || item.status === "Expired") && reqTime > 0 && reqTime < oneDayAgo) {
        deleteDoc(doc(db, "employee_requests", docId)).catch(() => {});
        continue;
      }

      let currentItemStatus = item.status;
      if (item.status === "Pending" && item.expires_at_millis && now > item.expires_at_millis) {
        currentItemStatus = "Expired";
        setDoc(doc(db, "employee_requests", docId), { status: "Expired", expired_at_millis: now }, { merge: true }).catch(() => {});
      }

      const div = document.createElement("div");
      div.className = "request-item-row";

      const isPending = currentItemStatus === "Pending";
      const isSalaryClaim = item.type === "Tarik Gaji";

      let statusColor = "#ff9500";
      if (currentItemStatus === "Approved") statusColor = "#34c759";
      if (currentItemStatus === "Rejected" || currentItemStatus === "Expired") statusColor = "#ff3b30";

      div.innerHTML = `
        <div class="request-item-info">
          <strong>${item.nama} [${item.type}]</strong>
          <small class="text-muted-xs">${isSalaryClaim ? 'Take Home Pay: Rp ' + Number(item.amount).toLocaleString() : 'Rp ' + Number(item.amount || 0).toLocaleString()} · ${item.note}</small>
          <small class="mt-1">Status: <b style="color:${statusColor}">${currentItemStatus}</b></small>
        </div>
        <div class="request-action-group">
          ${isPending ? `
            <button type="button" class="btn-approve-action" onclick="approveDisbursement('${docId}', '${item.uid}', '${item.month || ''}')">
              ${isSalaryClaim ? 'Cairkan' : 'Setujui'}
            </button>
            <button type="button" class="btn-reject-action" onclick="updateRequestStatus('${docId}', 'Rejected')">
              Tolak
            </button>
          ` : `<span class="badge-completed" style="background:${statusColor}22; color:${statusColor};">${currentItemStatus}</span>`}
        </div>
      `;
      listEl.appendChild(div);
    }
  } catch (e) {
    listEl.innerHTML = `<p class='placeholder-text' style='color:#ff3b30;'>Gagal memuat pengajuan: ${e.message}</p>`;
  }
}

window.approveDisbursement = async function(requestId, userId, monthStr) {
  window.showLoading("Memvalidasi pengajuan...");
  try {
    await setDoc(doc(db, "employee_requests", requestId), { 
      status: "Approved",
      disbursement_status: "Paid",
      approved_at: serverTimestamp() 
    }, { merge: true });

    if (userId && monthStr) {
      await setDoc(doc(db, "salary_slips_archive", `${userId}_${monthStr}`), {
        disbursement_status: "Paid"
      }, { merge: true });
    }

    window.hideLoading();
    notify("Sukses", "Pengajuan berhasil disetujui / divalidasi.");
    loadHRRequestsList();
    window.loadKasbonAccountSummary();
  } catch (err) {
    window.hideLoading();
    notify("Gagal Validasi", err.message);
  }
};

window.updateRequestStatus = async function(docId, newStatus) {
  window.showLoading(`Mengubah status pengajuan...`);
  try {
    await setDoc(doc(db, "employee_requests", docId), { status: newStatus }, { merge: true });
    window.hideLoading();
    notify("Sukses", `Pengajuan berhasil di-${newStatus}.`);
    loadHRRequestsList();
    window.loadKasbonAccountSummary();
  } catch (e) { 
    window.hideLoading();
    notify("Gagal", e.message); 
  }
};

// GPS & ABSENSI ENGINE
window.initMapLibre = function() {
  const mapContainer = document.getElementById("maplibre-view");
  if (!mapContainer) return;
  if (maplibreMap) { maplibreMap.resize(); return; }

  try {
    maplibreMap = new maplibregl.Map({
      container: 'maplibre-view',
      style: 'https://demotiles.maplibre.org/style.json',
      center: [MERCHANT_LOCATION.lng, MERCHANT_LOCATION.lat],
      zoom: 16
    });

    new maplibregl.Marker({ color: '#1A4B8B' })
      .setLngLat([MERCHANT_LOCATION.lng, MERCHANT_LOCATION.lat])
      .setPopup(new maplibregl.Popup().setHTML("<b>AIWA RAGIN JAJE</b><br>Jl. Pendidikan No.28, Aikmel"))
      .addTo(maplibreMap);

    getGPSLocation(true);
  } catch (e) { console.warn("MapLibre load error:", e); }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function isOutsideShiftHours() {
  const userRoleKey = String(currentUserData?.role || 'staff').toLowerCase();
  const roleCfg = ROLE_PARAMS_CACHE[userRoleKey] || DEFAULT_ROLE_PARAMS[userRoleKey] || DEFAULT_ROLE_PARAMS.staff;

  const currentHour = new Date().getHours();
  const shift = {
    pagi: { start: parseInt(roleCfg.pagi_start) || 7, end: parseInt(roleCfg.pagi_end) || 16 },
    malam: { start: parseInt(roleCfg.malam_start) || 13, end: parseInt(roleCfg.malam_end) || 21 },
    it_flex: { start: 8, end: 23 }
  }[currentUserShift] || { start: 7, end: 16 };

  return currentHour < shift.start || currentHour >= shift.end;
}

function validateUserPositionAndSchedule(userLat, userLng, accuracyMeters = 0) {
  const rawDistance = calculateDistance(userLat, userLng, MERCHANT_LOCATION.lat, MERCHANT_LOCATION.lng);
  const effectiveDistance = Math.max(0, rawDistance - (accuracyMeters / 2));

  const radiusBox = document.getElementById("gps-radius-status-box");
  const btnAbsen = document.getElementById("btn-trigger-attendance");
  
  const userRoleKey = String(currentUserData?.role || 'staff').toLowerCase();
  const isITAccount = (userRoleKey === "it");
  const roleCfg = ROLE_PARAMS_CACHE[userRoleKey] || DEFAULT_ROLE_PARAMS[userRoleKey] || DEFAULT_ROLE_PARAMS.staff;
  const maxRadiusAllowed = roleCfg.radius_meter || MERCHANT_LOCATION.maxRadiusMeters;

  const isInsideOutlet = (effectiveDistance <= maxRadiusAllowed);
  const isITQuotaExceeded = isITAccount && !isInsideOutlet && (currentMonthITWfaCount >= 10);
  
  const isRadiusExempt = (currentUserWorkMode === "wfa" || (isITAccount && !isITQuotaExceeded));
  const isOutRange = !isRadiusExempt && !isInsideOutlet;
  const isOutTime = !isITAccount && isOutsideShiftHours();

  if (radiusBox) {
    if (isITQuotaExceeded) {
      radiusBox.innerHTML = `
        <div class="radius-icon">${MONOTONE_ICONS.warning}</div>
        <div class="radius-text">
          <strong>KUOTA WFA HABIS (10/10 HARI - 40%)</strong>
          <span>Anda wajib melakukan presensi WFO di outlet AIWA RAGIN JAJE.</span>
        </div>
      `;
      radiusBox.style.background = "rgba(255, 59, 48, 0.08)";
      radiusBox.style.borderColor = "rgba(255, 59, 48, 0.25)";
    } else if (isOutRange || isOutTime) {
      let reasonText = [];
      if (isOutRange) reasonText.push(`Di luar radius (${Math.round(rawDistance)}m)`);
      if (isOutTime) reasonText.push(`Di luar jam shift ${currentUserShift.toUpperCase()}`);

      radiusBox.innerHTML = `
        <div class="radius-icon">${MONOTONE_ICONS.warning}</div>
        <div class="radius-text">
          <strong>ABSENSI TERKUNCI: ${reasonText.join(" & ")}</strong>
          <span>Gunakan opsi Sakit atau Izin jika berhalangan.</span>
        </div>
      `;
      radiusBox.style.background = "rgba(255, 149, 0, 0.08)";
      radiusBox.style.borderColor = "rgba(255, 149, 0, 0.25)";
    } else {
      let modeText = `DALAM RADIUS AIWA RAGIN JAJE (${Math.round(rawDistance)}m)`;
      if (isITAccount) {
        modeText = isInsideOutlet 
          ? `STAFF IT · TERDETEKSI DI OUTLET (MODE WFO - ${Math.round(rawDistance)}m)`
          : `STAFF IT · DI LUAR OUTLET (MODE WFA SISA ${10 - currentMonthITWfaCount} HARI - ${Math.round(rawDistance)}m)`;
      } else if (isRadiusExempt) {
        modeText = `MODE ${currentUserWorkMode.toUpperCase()} (Bebas Radius)`;
      }

      radiusBox.innerHTML = `
        <div class="radius-icon">${MONOTONE_ICONS.location}</div>
        <div class="radius-text">
          <strong>${modeText}</strong>
          <span>${currentUserShift === 'it_flex' ? 'SHIFT IT' : 'Shift ' + currentUserShift.toUpperCase()} · Silakan lakukan presensi</span>
        </div>
      `;
      radiusBox.style.background = "rgba(52, 199, 89, 0.08)";
      radiusBox.style.borderColor = "rgba(52, 199, 89, 0.25)";
    }
  }

  if (btnAbsen) {
    const shouldDisable = isOutRange || isOutTime || isITQuotaExceeded;
    btnAbsen.disabled = shouldDisable;
    btnAbsen.style.opacity = shouldDisable ? "0.4" : "1";
    btnAbsen.style.cursor = shouldDisable ? "not-allowed" : "pointer";
  }

  if (maplibreMap) {
    if (userMarker) userMarker.remove();
    userMarker = new maplibregl.Marker({ color: '#ff3b30' })
      .setLngLat([userLng, userLat])
      .setPopup(new maplibregl.Popup().setHTML(`<b>Posisi Anda</b><br>Jarak: ${Math.round(rawDistance)}m`))
      .addTo(maplibreMap);

    maplibreMap.flyTo({ center: [userLng, userLat], zoom: 17 });
  }
}

function getGPSLocation(isSilent = false) {
  const spinnerEl = document.getElementById("gps-spinner-monotone");
  const iconEl = document.getElementById("gps-icon-monotone");
  const textEl = document.getElementById("gps-btn-text");

  if (spinnerEl && iconEl && textEl && !isSilent) {
    spinnerEl.classList.remove("hidden");
    iconEl.classList.add("hidden");
    textEl.innerText = "MENCARI...";
  }

  if (!navigator.geolocation) {
    if (!isSilent) notify("GPS Error", "Browser tidak mendukung Geolocation.");
    resetGPSButtonState();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userGPSLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      validateUserPositionAndSchedule(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      resetGPSButtonState();
    },
    () => {
      navigator.geolocation.getCurrentPosition(
        (fallbackPos) => {
          userGPSLocation = { lat: fallbackPos.coords.latitude, lng: fallbackPos.coords.longitude };
          validateUserPositionAndSchedule(fallbackPos.coords.latitude, fallbackPos.coords.longitude, fallbackPos.coords.accuracy);
          resetGPSButtonState();
        },
        () => { 
          if (!isSilent) notify("GPS Ditolak", "Izinkan akses GPS pada browser Anda untuk absensi."); 
          resetGPSButtonState();
        },
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
      );
    },
    { enableHighAccuracy: true, timeout: 3500, maximumAge: 30000 }
  );
}

function resetGPSButtonState() {
  const spinnerEl = document.getElementById("gps-spinner-monotone");
  const iconEl = document.getElementById("gps-icon-monotone");
  const textEl = document.getElementById("gps-btn-text");

  if (spinnerEl && iconEl && textEl) {
    spinnerEl.classList.add("hidden");
    iconEl.classList.remove("hidden");
    textEl.innerText = "CEK GPS";
  }
}

window.refreshMapLibreGPS = function() { getGPSLocation(false); };

window.executeGPSAttendance = async function() {
  const user = auth.currentUser;
  if (!user) return;

  if (!userGPSLocation) {
    notify("GPS Belum Siap", "Tekan tombol 'CEK GPS' terlebih dahulu.");
    getGPSLocation(false);
    return;
  }

  const userRoleKey = String(currentUserData?.role || 'staff').toLowerCase();
  const isITAccount = (userRoleKey === "it");
  const roleCfg = ROLE_PARAMS_CACHE[userRoleKey] || DEFAULT_ROLE_PARAMS[userRoleKey] || DEFAULT_ROLE_PARAMS.staff;
  const maxRadiusAllowed = roleCfg.radius_meter || MERCHANT_LOCATION.maxRadiusMeters;

  const distance = calculateDistance(userGPSLocation.lat, userGPSLocation.lng, MERCHANT_LOCATION.lat, MERCHANT_LOCATION.lng);
  const isInsideOutlet = distance <= maxRadiusAllowed;

  if (isITAccount && !isInsideOutlet && currentMonthITWfaCount >= 10) {
    notify("Kuota WFA Habis", "Batas maksimal 10 hari WFA (40%) telah tercapai. Anda wajib melakukan presensi WFO di outlet.");
    return;
  }

  const isRadiusExempt = (currentUserWorkMode === "wfa" || isITAccount);
  if (!isRadiusExempt && !isInsideOutlet) {
    notify("Ditolak", `Di luar radius toko (${Math.round(distance)}m). Maks: ${maxRadiusAllowed}m`);
    return;
  }

  let recordedMode = currentUserWorkMode;
  if (isITAccount) {
    recordedMode = isInsideOutlet ? "wfo" : "wfa";
  }

  window.showLoading("Memproses verifikasi presensi...");

  const todayStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar" });

  try {
    const q = query(collection(db, "attendance"), where("uid", "==", user.uid), where("date", "==", todayStr));
    const snap = await getDocs(q);

    if (snap.empty) {
      await addDoc(collection(db, "attendance"), {
        uid: user.uid,
        nama: document.getElementById("header-user-name").innerText,
        role: userRoleKey,
        date: todayStr,
        check_in_time: timeStr,
        check_in_gps: userGPSLocation,
        shift: currentUserShift,
        mode: recordedMode,
        distance_meter: Math.round(distance),
        status: "Hadir",
        timestamp: serverTimestamp()
      });
      window.hideLoading();
      notify("Sukses", `Check-In berhasil [Mode: ${recordedMode.toUpperCase()}] pada pukul ${timeStr}`);
    } else {
      const docId = snap.docs[0].id;
      await setDoc(doc(db, "attendance", docId), {
        check_out_time: timeStr,
        check_out_gps: userGPSLocation
      }, { merge: true });
      window.hideLoading();
      notify("Sukses", `Check-Out berhasil pada pukul ${timeStr}`);
    }
    checkTodayAttendance();
    await calculateUserKPI(user.uid);
  } catch (e) { 
    window.hideLoading();
    notify("Gagal Presensi", e.message); 
  }
};

async function checkTodayAttendance() {
  const user = auth.currentUser;
  if (!user) return;
  const todayStr = new Date().toISOString().split('T')[0];
  const btnAbsen = document.getElementById("btn-trigger-attendance");
  const checkinEl = document.getElementById("today-checkin-time");
  const checkoutEl = document.getElementById("today-checkout-time");

  try {
    const q = query(collection(db, "attendance"), where("uid", "==", user.uid), where("date", "==", todayStr));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const data = snap.docs[0].data();
      if (checkinEl) checkinEl.innerText = data.check_in_time || "--:--";
      if (checkoutEl) checkoutEl.innerText = data.check_out_time || "--:--";

      if (data.check_in_time && !data.check_out_time) {
        if (btnAbsen) btnAbsen.querySelector("span").innerText = "Proses Check-Out Pulang";
        updateHomeLiveStatus(true, false);
      } else if (data.check_in_time && data.check_out_time) {
        if (btnAbsen) {
          btnAbsen.querySelector("span").innerText = "Presensi Hari Ini Selesai";
          btnAbsen.disabled = true;
        }
        updateHomeLiveStatus(false, true);
      }
    } else {
      if (checkinEl) checkinEl.innerText = "--:--";
      if (checkoutEl) checkoutEl.innerText = "--:--";
      if (btnAbsen) {
        btnAbsen.querySelector("span").innerText = "Proses Absensi Masuk";
        btnAbsen.disabled = false;
      }
      updateHomeLiveStatus(false, false);
    }
    loadAttendanceHistory();
    loadAdminAttendanceList();
  } catch (e) { console.error(e); }
}

function updateHomeLiveStatus(isPresent, isFinished) {
  const statusEl = document.getElementById("dashboard-today-status");
  const dotEl = document.getElementById("live-work-indicator");
  if (!statusEl || !dotEl) return;

  if (isFinished) {
    statusEl.innerText = "Selesai (Check-Out)";
    statusEl.style.color = "var(--text-secondary)";
    dotEl.className = "status-dot dot-offline";
  } else if (isPresent) {
    statusEl.innerText = "Aktif Bekerja";
    statusEl.style.color = "#34c759";
    dotEl.className = "status-dot dot-online";
  } else {
    statusEl.innerText = "Belum Presensi";
    statusEl.style.color = "#ff9500";
    dotEl.className = "status-dot dot-offline";
  }
}

// RIWAYAT KEHADIRAN
async function loadAttendanceHistory() {
  const user = auth.currentUser;
  const listEl = document.getElementById("attendance-history-list");
  if (!user || !listEl) return;
  try {
    const q = query(
      collection(db, "attendance"), 
      where("uid", "==", user.uid), 
      orderBy("date", "desc"), 
      limit(15)
    );
    const snap = await getDocs(q);
    listEl.innerHTML = "";
    if (snap.empty) {
      listEl.innerHTML = "<p class='placeholder-text'>Belum ada riwayat.</p>";
      return;
    }
    const badgeEl = document.getElementById("attendance-count-badge");
    if (badgeEl) badgeEl.innerText = `${snap.size} Hari`;

    snap.forEach(d => {
      const item = d.data();
      const div = document.createElement("div");
      div.className = "picker-user-row";
      div.style.cursor = "default";
      div.innerHTML = `
        <div class="picker-user-meta">
          <strong>${item.date} [${(item.mode || 'wfo').toUpperCase()}]</strong>
          <small>Masuk: ${item.check_in_time || '-'} | Keluar: ${item.check_out_time || '-'}${item.keterangan ? ' | Ket: ' + item.keterangan : ''}</small>
        </div>
        <span class='badge-status-work' style='background:rgba(52, 199, 89, 0.12); color:#34c759;'>${item.status || 'Hadir'}</span>
      `;
      listEl.appendChild(div);
    });
  } catch (e) {
    const fallbackQ = query(collection(db, "attendance"), where("uid", "==", user.uid), limit(15));
    const fallbackSnap = await getDocs(fallbackQ);
    listEl.innerHTML = "";
    fallbackSnap.forEach(d => {
      const item = d.data();
      const div = document.createElement("div");
      div.className = "picker-user-row";
      div.style.cursor = "default";
      div.innerHTML = `
        <div class="picker-user-meta">
          <strong>${item.date} [${(item.mode || 'wfo').toUpperCase()}]</strong>
          <small>Masuk: ${item.check_in_time || '-'} | Keluar: ${item.check_out_time || '-'}${item.keterangan ? ' | Ket: ' + item.keterangan : ''}</small>
        </div>
        <span class='badge-status-work' style='background:rgba(52, 199, 89, 0.12); color:#34c759;'>${item.status || 'Hadir'}</span>
      `;
      listEl.appendChild(div);
    });
  }
}

window.deleteAttendanceRecord = async function(docId) {
  const isConfirmed = await window.showCustomConfirm("Hapus Absensi", "Hapus data absensi ini?");
  if (!isConfirmed) return;

  window.showLoading("Menghapus data absensi...");
  try {
    await deleteDoc(doc(db, "attendance", docId));
    window.hideLoading();
    notify("Sukses", "Data absensi dihapus.");
    loadAdminAttendanceList();
    checkTodayAttendance();
  } catch (e) { 
    window.hideLoading();
    notify("Gagal", e.message); 
  }
};

// FORMULIR PENGAJUAN SAKIT & IZIN
window.openLeaveFormPage = function(leaveType) {
  pendingLeaveType = leaveType;
  document.getElementById('leave-page-header-title').innerText = `Formulir Pengajuan ${leaveType}`;
  document.getElementById('leave-badge-type').innerText = leaveType.toUpperCase();
  document.getElementById('leave-attachment-label').innerText = leaveType === 'Sakit' ? 'UNGGAH BUKTI (SURAT DOKTER / RESEP)' : 'UNGGAH DOKUMEN / BUKTI KEPERLUAN';
  
  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('leave-start-date').value = todayStr;
  document.getElementById('leave-end-date').value = todayStr;
  document.getElementById('leave-reason-text').value = '';
  document.getElementById('leave-file-input').value = '';
  document.getElementById('leave-file-label-display').innerText = 'Belum ada file dipilih';
  window.calculateLeaveDays();

  window.navigateToTab('leave-form');
};

window.calculateLeaveDays = function() {
  const start = document.getElementById('leave-start-date').value;
  const end = document.getElementById('leave-end-date').value;
  if (!start || !end) return;

  const d1 = new Date(start);
  const d2 = new Date(end);
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
  document.getElementById('leave-duration-display').value = `${diffDays} Hari`;
};

window.openEmployeeRequestPage = function(type) {
  pendingEmployeeRequestType = type;
  document.getElementById('emp-req-page-title').innerText = `Formulir Pengajuan ${type}`;
  document.getElementById('emp-req-page-badge').innerText = type.toUpperCase();
  document.getElementById('emp-req-page-label-val').innerText = type === 'Kasbon' ? 'NOMINAL PINJAMAN (RP)' : 'JUMLAH HARI CUTI';
  document.getElementById('emp-req-page-val').value = '';
  document.getElementById('emp-req-page-note').value = '';

  window.navigateToTab('employee-request-page');
};

// STRUKTUR GAJI & REKENING RESMI
window.loadEmployeeSalaryConfig = async function(userId) {
  if (!userId) return;
  window.showLoading("Memuat konfigurasi gaji...");
  try {
    const docSnap = await getDoc(doc(db, "salary_structures", userId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      document.getElementById("sal-base").value = data.base_salary || 0;
      document.getElementById("sal-meal-daily").value = data.meal_daily ?? 15000;
      
      document.getElementById("sal-bank-name").value = data.bank_name || "BCA";
      document.getElementById("sal-bank-number").value = data.bank_number || "";
      document.getElementById("sal-bank-holder").value = data.bank_holder || "";
    } else {
      document.getElementById("sal-base").value = "";
      document.getElementById("sal-meal-daily").value = "15000";
      document.getElementById("sal-bank-name").value = "BCA";
      document.getElementById("sal-bank-number").value = "";
      document.getElementById("sal-bank-holder").value = "";
    }
  } catch (e) {
    console.error(e);
  } finally {
    window.hideLoading();
  }
};

// ATTACH DOM EVENT LISTENERS
document.addEventListener("DOMContentLoaded", () => {
  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;
      const btnText = document.getElementById("btn-login-text");
      const btnSpinner = document.getElementById("btn-login-spinner");
      const btnSubmit = document.getElementById("btn-login-submit");

      btnText.innerText = "Memproses...";
      btnSpinner.classList.remove("hidden");
      btnSubmit.disabled = true;

      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        btnText.innerText = "Masuk Sistem";
        btnSpinner.classList.add("hidden");
        btnSubmit.disabled = false;
        
        let msg = "Email atau password salah.";
        if (error.code === "auth/network-request-failed") {
          msg = "Koneksi internet bermasalah. Periksa jaringan Anda.";
        } else if (error.code === "auth/too-many-requests") {
          msg = "Terlalu banyak percobaan gagal. Coba lagi beberapa saat.";
        }
        notify("Gagal Login", msg);
      }
    });
  }

  document.getElementById("input-avatar-file")?.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) window.openCropperModal(e.target.files[0], "avatar");
  });

  document.getElementById("btn-apply-crop")?.addEventListener("click", async () => {
    if (!cropperInstance) return;
    const btn = document.getElementById("btn-apply-crop");
    btn.innerText = "Memproses...";
    btn.disabled = true;
    window.showLoading("Menyimpan foto...");

    try {
      const canvas = cropperInstance.getCroppedCanvas({ 
        width: 120, 
        height: 120, 
        imageSmoothingQuality: "medium" 
      });
      const base64 = canvas.toDataURL("image/jpeg", 0.5);

      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, "users", user.uid), { avatar_url: base64 }, { merge: true });
        applyUserAvatar(base64);
        notify("Sukses", "Foto profil berhasil diperbarui!");
      }
      document.getElementById('crop-modal')?.classList.add('hidden');
    } catch (err) { 
      notify("Gagal", err.message); 
    } finally { 
      window.hideLoading();
      btn.innerText = "Gunakan & Simpan"; 
      btn.disabled = false; 
    }
  });

  // SUBMIT TRANSAKSI KASBON DENGAN GENERATE QRIS COUNTDOWN 1 JAM (POIN 7)
  document.getElementById("form-transaksi-kasbon")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const actionType = document.getElementById("kasbon-action-type").value;
    const currentKPIStatus = document.getElementById("kpi-status-tag")?.innerText?.trim().toLowerCase() || "kurang";

    if (actionType === "pinjam" && currentKPIStatus !== "memuaskan") {
      return notify("Pengajuan Ditolak", "Status performa KPI Anda belum memenuhi syarat minimal 'Memuaskan' (>85%).");
    }

    const amount = Number(document.getElementById("kasbon-amount-input").value);
    const note = document.getElementById("kasbon-notes-input").value.trim();
    const monthlyInstallment = actionType === "pinjam" ? Number(document.getElementById("kasbon-monthly-installment")?.value || 0) : 0;
    const tenorMonths = actionType === "pinjam" ? Number(document.getElementById("kasbon-tenor-months")?.value || 1) : 1;

    if (!amount || amount <= 0) return notify("Perhatian", "Masukkan nominal yang valid.");

    window.showLoading("Menerbitkan QRIS transaksi kasbon...");

    try {
      const now = Date.now();
      const expiresAtMillis = now + (60 * 60 * 1000); // TEPAT 1 JAM (60 MENIT)
      const isPinjam = (actionType === "pinjam");
      const voucherCode = `${isPinjam ? 'KB' : 'BYR'}-${new Date().toISOString().slice(0, 7).replace("-", "")}-${Math.floor(1000 + Math.random() * 9000)}`;

      const payload = {
        uid: user.uid,
        nama: currentUserData.nama || user.email,
        role: currentUserData.role || "staff",
        type: isPinjam ? "Kasbon" : "Bayar Kasbon",
        amount: amount,
        monthly_installment: monthlyInstallment || amount,
        tenor_months: tenorMonths,
        installment_paid_count: 0,
        total_paid: 0,
        note: note,
        voucher_code: voucherCode,
        status: "Pending",
        requested_millis: now,
        expires_at_millis: expiresAtMillis,
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, "employee_requests"), payload);

      window.hideLoading();
      document.getElementById("box-form-kasbon").classList.add("hidden");
      
      // MUNCULKAN POPUP QRIS BESERTA TIMER COUNTDOWN
      window.showKasbonQRISModal(voucherCode, expiresAtMillis, payload);
      window.loadKasbonAccountSummary();
    } catch (err) {
      window.hideLoading();
      notify("Gagal", err.message);
    }
  });

  // SUBMIT PROMOSI JENJANG KARIR
  document.getElementById("form-update-career-level")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("career-target-uid").value;
    const newLevel = document.getElementById("career-select-level").value;
    const customAllowance = Number(document.getElementById("career-custom-allowance").value || 0);

    if (!userId) return notify("Perhatian", "Pilih karyawan terlebih dahulu.");

    const confirmPromote = await window.showCustomConfirm(
      "Konfirmasi Promosi Karir",
      `Terapkan level ${newLevel.toUpperCase()} dengan tunjangan Rp ${customAllowance.toLocaleString()}/bulan untuk karyawan ini?`
    );
    if (!confirmPromote) return;

    window.showLoading("Memproses pembaruan karir & tunjangan...");

    try {
      await setDoc(doc(db, "users", userId), {
        career_level: newLevel,
        promoted_at: serverTimestamp()
      }, { merge: true });

      await setDoc(doc(db, "salary_structures", userId), {
        uid: userId,
        role_allowance: customAllowance,
        updated_at: serverTimestamp()
      }, { merge: true });

      window.hideLoading();
      notify("Sukses", `Promosi ke level ${newLevel} dan tunjangan jabatan berhasil disimpan.`);
      document.getElementById("box-career-promotion-form").classList.add("hidden");
      window.loadCareerPathList();
    } catch (err) {
      window.hideLoading();
      notify("Gagal", err.message);
    }
  });

  document.getElementById("form-assign-custom-task")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("task-select-user").value;
    const instruction = document.getElementById("task-instruction-input").value.trim();
    const targetDate = document.getElementById("task-target-date").value;

    if (!userId) return notify("Perhatian", "Pilih karyawan terlebih dahulu.");

    window.showLoading("Mengirimkan penugasan...");
    try {
      await addDoc(collection(db, "staff_tasks"), {
        uid: userId,
        instruction: instruction,
        target_date: targetDate,
        completed: false,
        created_at: serverTimestamp()
      });

      window.hideLoading();
      notify("Sukses", "Tugas khusus berhasil dikirimkan ke staf!");
      document.getElementById("form-assign-custom-task").reset();
      window.closeHRSubPage();
      loadDailyTaskChecklist();
      calculateUserKPI(userId);
    } catch (err) {
      window.hideLoading();
      notify("Gagal Kirim", err.message);
    }
  });

  document.getElementById("form-assign-shift")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("hr-select-user").value;
    const shift = document.getElementById("hr-select-shift").value;
    const workMode = document.getElementById("hr-select-work-mode").value;

    if (!userId) return notify("Perhatian", "Pilih karyawan terlebih dahulu.");

    window.showLoading("Menyimpan shift & mode kerja...");
    try {
      await setDoc(doc(db, "users", userId), { shift, work_mode: workMode }, { merge: true });
      window.hideLoading();
      notify("Sukses", "Shift dan mode kerja staf berhasil diperbarui!");
      loadHRUserOptions();
    } catch (err) {
      window.hideLoading();
      notify("Gagal", err.message);
    }
  });

  // FORM STRUKTUR GAJI (TANPA INPUT TUNJANGAN JABATAN)
  document.getElementById("form-salary-structure")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("salary-select-user").value;
    const base = Number(document.getElementById("sal-base").value);
    const meal = Number(document.getElementById("sal-meal-daily").value);
    
    const bankName = document.getElementById("sal-bank-name").value;
    const bankNumber = document.getElementById("sal-bank-number").value.trim();
    const bankHolder = document.getElementById("sal-bank-holder").value.trim();

    if (!userId) return notify("Perhatian", "Pilih karyawan terlebih dahulu.");
    if (!bankNumber || !bankHolder) return notify("Perhatian", "Lengkapi nomor rekening dan nama pemilik rekening.");

    const fullBankAccountStr = `${bankName} ${bankNumber} a.n ${bankHolder}`;

    window.showLoading("Menyimpan komponen gaji pokok & rekening...");
    try {
      await setDoc(doc(db, "salary_structures", userId), {
        uid: userId,
        base_salary: base,
        meal_daily: meal,
        bank_name: bankName,
        bank_number: bankNumber,
        bank_holder: bankHolder,
        bank_account: fullBankAccountStr,
        updated_at: serverTimestamp()
      }, { merge: true });

      window.hideLoading();
      notify("Sukses", "Data gaji pokok & rekening resmi staf berhasil disimpan!");
    } catch (err) {
      window.hideLoading();
      notify("Gagal", err.message);
    }
  });

  document.getElementById("form-update-role-param")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const targetRoleKey = document.getElementById("target-role-param-id").value;
    
    window.showLoading(`Menyimpan parameter ${ROLE_DISPLAY_NAMES[targetRoleKey] || targetRoleKey}...`);
    try {
      const payload = {
        pagi_start: document.getElementById("cfg-role-pagi-start").value,
        pagi_end: document.getElementById("cfg-role-pagi-end").value,
        malam_start: document.getElementById("cfg-role-malam-start").value,
        malam_end: document.getElementById("cfg-role-malam-end").value,
        it_threshold: document.getElementById("cfg-role-it-threshold").value,
        tolerance: Number(document.getElementById("cfg-role-tolerance").value),
        overtime_rate: Number(document.getElementById("cfg-role-overtime-rate").value),
        late_penalty: Number(document.getElementById("cfg-role-late-penalty").value),
        radius_meter: Number(document.getElementById("cfg-role-radius-meter").value)
      };

      ROLE_PARAMS_CACHE[targetRoleKey] = payload;

      await setDoc(doc(db, "app_settings", "parameters_roles"), {
        [targetRoleKey]: payload,
        updated_at: serverTimestamp()
      }, { merge: true });

      updateAllShiftCardsTimeDisplay();

      window.hideLoading();
      notify("Sukses", `Parameter untuk ${ROLE_DISPLAY_NAMES[targetRoleKey] || targetRoleKey} berhasil disimpan!`);
      window.closeHRSubPage();
    } catch (err) {
      window.hideLoading();
      notify("Gagal", err.message);
    }
  });

  document.getElementById("form-create-user")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("new-user-name").value.trim();
    const email = document.getElementById("new-user-email").value.trim();
    const pass = document.getElementById("new-user-password").value;
    const role = document.getElementById("new-user-role").value;

    window.showLoading("Mendaftarkan akun karyawan...");
    try {
      const res = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      await setDoc(doc(db, "users", res.user.uid), {
        nama: name,
        email: email,
        role: role,
        shift: role === "it" ? "it_flex" : "pagi",
        work_mode: role === "it" ? "wfa" : "wfo",
        career_level: "Junior",
        created_at: serverTimestamp()
      });
      await signOut(secondaryAuth);

      const displayRole = (ROLE_DISPLAY_NAMES[role] || role).toUpperCase();
      window.hideLoading();
      notify("Sukses", `Akun ${name} (${displayRole}) berhasil didaftarkan!`);
      document.getElementById("form-create-user").reset();
      loadHRUserOptions();
    } catch (err) {
      window.hideLoading();
      notify("Gagal Pendaftaran", err.message);
    }
  });

  document.getElementById("form-it-create-user")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("it-user-name").value.trim();
    const email = document.getElementById("it-user-email").value.trim();
    const pass = document.getElementById("it-user-password").value;
    const role = document.getElementById("it-user-role").value;

    window.showLoading("Mendaftarkan akun sistem...");
    try {
      const res = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      await setDoc(doc(db, "users", res.user.uid), {
        nama: name,
        email: email,
        role: role,
        shift: role === "it" ? "it_flex" : "pagi",
        work_mode: role === "it" ? "wfa" : "wfo",
        career_level: "Junior",
        created_at: serverTimestamp()
      });
      await signOut(secondaryAuth);

      window.hideLoading();
      notify("Sukses", `Akun untuk ${name} berhasil dibuat!`);
      document.getElementById("form-it-create-user").reset();
      loadITUsersList();
      loadHRUserOptions();
    } catch (err) {
      window.hideLoading();
      notify("Gagal Registrasi IT", err.message);
    }
  });

  document.getElementById("form-update-profile")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const name = document.getElementById("profile-full-name").value.trim();
    const phone = document.getElementById("profile-phone").value.trim();
    const address = document.getElementById("profile-address").value.trim();

    window.showLoading("Menyimpan data profil...");
    try {
      await setDoc(doc(db, "users", user.uid), {
        nama: name,
        phone: phone,
        alamat: address
      }, { merge: true });

      document.getElementById("header-user-name").innerText = name;
      document.getElementById("page-user-name").innerText = name;
      document.getElementById("dashboard-user-name").innerText = name;

      window.hideLoading();
      notify("Sukses", "Data profil Anda berhasil diperbarui!");
    } catch (err) {
      window.hideLoading();
      notify("Gagal", err.message);
    }
  });

  document.getElementById("form-direct-change-pass")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const currentPass = document.getElementById("pass-current").value;
    const newPass = document.getElementById("pass-new").value;
    const confirmPass = document.getElementById("pass-confirm").value;

    if (newPass !== confirmPass) return notify("Perhatian", "Konfirmasi password baru tidak cocok.");
    if (newPass.length < 6) return notify("Perhatian", "Password baru minimal 6 karakter.");

    window.showLoading("Memperbarui password...");
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPass);

      window.hideLoading();
      notify("Sukses", "Password akun berhasil diubah.");
      document.getElementById("form-direct-change-pass").reset();
      window.navigateToTab('profile');
    } catch (err) {
      window.hideLoading();
      notify("Gagal Ubah Password", err.message);
    }
  });

  document.getElementById('form-submit-emp-request-page')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    const val = Number(document.getElementById('emp-req-page-val').value);
    const note = document.getElementById('emp-req-page-note').value.trim();

    if (!val || val <= 0) return notify("Perhatian", "Masukkan nominal pinjaman/jumlah hari yang valid.");
    if (!note) return notify("Perhatian", "Tuliskan keterangan alasan pengajuan.");

    window.showLoading("Mengirim formulir pengajuan...");
    try {
      await addDoc(collection(db, "employee_requests"), {
        uid: user.uid,
        nama: document.getElementById("header-user-name")?.innerText || "Karyawan",
        type: pendingEmployeeRequestType,
        amount: val,
        note: note,
        status: "Pending",
        timestamp: serverTimestamp()
      });
      window.hideLoading();
      notify("Berhasil", `Pengajuan ${pendingEmployeeRequestType} telah terkirim.`);
      window.navigateToTab('beranda');
      loadHRRequestsList();
    } catch (err) { 
      window.hideLoading();
      notify("Gagal", err.message); 
    }
  });

  document.getElementById('form-submit-leave')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    const start = document.getElementById('leave-start-date').value;
    const end = document.getElementById('leave-end-date').value;
    const duration = document.getElementById('leave-duration-display').value;
    const reason = document.getElementById('leave-reason-text').value.trim();

    window.showLoading("Mengirimkan pengajuan izin/sakit...");
    try {
      await addDoc(collection(db, "attendance"), {
        uid: user.uid,
        nama: document.getElementById("header-user-name")?.innerText || "Karyawan",
        role: String(currentUserData?.role || 'staff').toLowerCase(),
        date: start,
        end_date: end,
        duration: duration,
        status: pendingLeaveType,
        keterangan: reason,
        timestamp: serverTimestamp()
      });
      window.hideLoading();
      notify("Berhasil", `Pengajuan ${pendingLeaveType} berhasil dikirim.`);
      window.navigateToTab('absensi');
      checkTodayAttendance();
    } catch (err) { 
      window.hideLoading();
      notify("Gagal", err.message); 
    }
  });

  document.getElementById("form-import-data")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("import-file-input");
    const targetCol = document.getElementById("import-target-col").value;

    if (!fileInput.files || !fileInput.files[0]) return notify("Perhatian", "Pilih file terlebih dahulu.");

    const file = fileInput.files[0];
    window.showLoading("Mengimpor data ke koleksi...");

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          let rows = [];
          if (file.name.endsWith('.json')) {
            rows = JSON.parse(evt.target.result);
          } else {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            const sheetName = wb.SheetNames[0];
            rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
          }

          for (const row of rows) {
            await addDoc(collection(db, targetCol), {
              ...row,
              imported_at: serverTimestamp()
            });
          }

          window.hideLoading();
          notify("Sukses", `Berhasil mengimpor ${rows.length} data ke koleksi '${targetCol}'.`);
          fileInput.value = "";
          document.getElementById("import-file-label").innerText = "Belum ada file dipilih";
        } catch (readErr) {
          window.hideLoading();
          notify("Gagal Membaca Berkas", readErr.message);
        }
      };

      if (file.name.endsWith('.json')) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    } catch (err) {
      window.hideLoading();
      notify("Gagal Import", err.message);
    }
  });
});

// ==========================================
// REGISTRASI SERVICE WORKER (PWA SUPPORT)
// ==========================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then((reg) => {
        console.log("PWA Service Worker terpasang:", reg.scope);
      })
      .catch((err) => {
        console.warn("PWA Service Worker gagal dipasang:", err);
      });
  });
}
