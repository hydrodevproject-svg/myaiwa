/* ==========================================================================
   MYAIWA - UTILITIES, UI HELPERS & NAVIGATION CONTROLLER (LENGKAP)
   ========================================================================== */

import { state } from "./constants.js";

// ==========================================
// 1. ZONA WAKTU WITA & JAM REALTIME
// ==========================================
export function getLocalDateWITA(dateObj = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj);
}

export function getLocalTimeWITA(dateObj = new Date()) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Makassar',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(dateObj).replace(/\./g, ':');
}

export function updateLiveClockAndDate() {
  const clockEl = document.getElementById("clock-date-live");
  if (!clockEl) return;
  const now = new Date();
  const options = { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric', 
    timeZone: 'Asia/Makassar' 
  };
  clockEl.innerText = now.toLocaleDateString("id-ID", options);
}

export function initLiveClock() {
  setInterval(updateLiveClockAndDate, 1000);
  updateLiveClockAndDate();
}

// ==========================================
// 2. GLOBAL LOADER & MODAL NOTIFIKASI
// ==========================================
export function showLoading(text = "Memproses...") {
  const loader = document.getElementById("global-loader");
  const loaderText = document.getElementById("loader-text");
  if (loaderText) loaderText.innerText = text;
  if (loader) loader.classList.remove("hidden");
}

export function hideLoading() {
  document.getElementById("global-loader")?.classList.add("hidden");
}

export function notify(title, msg) {
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

export function closeModal() {
  document.getElementById("custom-modal")?.classList.add("hidden");
}

export function closeCropModal() {
  document.getElementById("crop-modal")?.classList.add("hidden");
}

export function updateFileName(input, labelId) {
  const label = document.getElementById(labelId);
  if (label && input && input.files && input.files[0]) {
    label.innerText = input.files[0].name;
  }
}

export function showCustomConfirm(title, msg) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    if (!modal) {
      resolve(confirm(`${title}\n\n${msg}`));
      return;
    }

    const titleEl = document.getElementById("confirm-modal-title");
    const msgEl = document.getElementById("confirm-modal-message");
    const yesBtn = document.getElementById("btn-confirm-yes");
    const noBtn = document.getElementById("btn-confirm-no");

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = msg;
    modal.classList.remove("hidden");

    const cleanup = () => {
      modal.classList.add("hidden");
      if (yesBtn) yesBtn.onclick = null;
      if (noBtn) noBtn.onclick = null;
    };

    if (yesBtn) yesBtn.onclick = () => { cleanup(); resolve(true); };
    if (noBtn) noBtn.onclick = () => { cleanup(); resolve(false); };
  });
}

// ==========================================
// 3. SAPAAN DINAMIS & AVATAR PENGGUNA
// ==========================================
export function getDynamicGreeting() {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return "Selamat Pagi,";
  if (hour >= 11 && hour < 15) return "Selamat Siang,";
  if (hour >= 15 && hour < 18) return "Selamat Sore,";
  return "Selamat Malam,";
}

export function applyUserAvatar(base64OrUrl) {
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

// ==========================================
// 4. TEMA SISTEM & VISIBILITAS PASSWORD
// ==========================================
export function switchGlobalTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  localStorage.setItem('myaiwa_theme', theme);
  document.querySelectorAll('#login-theme-light, #profile-theme-light').forEach(b => b.classList.toggle('active-theme', theme === 'light'));
  document.querySelectorAll('#login-theme-dark, #profile-theme-dark').forEach(b => b.classList.toggle('active-theme', theme === 'dark'));
}

export function initSavedTheme() {
  const savedTheme = localStorage.getItem('myaiwa_theme') || 'light';
  switchGlobalTheme(savedTheme);
}

export function togglePasswordVisibility() {
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
}

// ==========================================
// 5. HELPER WAKTU & AMBANG BATAS TELAT
// ==========================================
export function calculateLateThresholdTime(baseTimeStr, toleranceMin) {
  if (!baseTimeStr) return "07:45:00";
  const [h, m] = baseTimeStr.split(":").map(Number);
  const totalMin = (h * 60) + m + Number(toleranceMin || 0);
  const thH = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
  const thM = String(totalMin % 60).padStart(2, '0');
  return `${thH}:${thM}:00`;
}

// ==========================================
// 6. NAVIGASI UTAMA & SUB-PAGE
// ==========================================
export function navigateToTab(tabName, pushState = true) {
  if (pushState) history.pushState({ tab: tabName, subpage: null }, "");

  state.currentActiveTab = tabName;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.bottom-nav .nav-item').forEach(el => el.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.remove('hidden');
    
    if (tabName === 'absensi' && window.initMapLibre) {
      setTimeout(window.initMapLibre, 150);
    } else if (tabName === 'it' && window.initITPanel) {
      window.initITPanel();
    } else if (tabName === 'salary-history-page' && window.renderUserSlipHistory) {
      window.renderUserSlipHistory();
    } else if (tabName === 'kasbon' && window.loadKasbonAccountSummary) {
      window.loadKasbonAccountSummary();
    } else if (tabName === 'tugas' && window.loadDailyTaskChecklist) {
      window.loadDailyTaskChecklist();
    }
  }

  const navEl = document.getElementById(`nav-${tabName}`);
  if (navEl) navEl.classList.add('active');

  if (tabName !== 'hr') closeHRSubPage(false);
  if (tabName !== 'it') closeITSubPage(false);
}

export function openHRSubPage(subpageId, pushState = true) {
  state.isHRSubpageOpen = true;
  if (pushState) history.pushState({ tab: 'hr', subpage: subpageId }, "");

  document.getElementById('hr-menu-grid-view')?.classList.add('hidden');
  document.getElementById('hr-subpage-detail-view')?.classList.remove('hidden');

  document.querySelectorAll('.hr-feature-page').forEach(el => el.classList.add('hidden'));
  document.getElementById(`subtab-${subpageId}`)?.classList.remove('hidden');

  if (subpageId === 'hr-career-path' && window.loadCareerPathList) window.loadCareerPathList();
  if (subpageId === 'hr-kpi-leaderboard' && window.renderGMLeaderboardReport) window.renderGMLeaderboardReport();
  if (subpageId === 'hr-requests' && window.loadHRRequestsList) window.loadHRRequestsList();

  if (subpageId === 'hr-attendance') {
    const dateFilterEl = document.getElementById("report-filter-date");
    const monthFilterEl = document.getElementById("report-filter-month");
    if (dateFilterEl && !dateFilterEl.value) dateFilterEl.value = getLocalDateWITA();
    if (monthFilterEl && !monthFilterEl.value) monthFilterEl.value = getLocalDateWITA().slice(0, 7);

    if (window.populateReportUserDropdown) {
      window.populateReportUserDropdown().then(() => {
        if (window.generateAdminAttendanceReport) window.generateAdminAttendanceReport();
      });
    }
  }
}

export function closeHRSubPage(popHistory = true) {
  state.isHRSubpageOpen = false;
  document.getElementById('hr-subpage-detail-view')?.classList.add('hidden');
  document.getElementById('hr-menu-grid-view')?.classList.remove('hidden');
  document.querySelectorAll('.hr-feature-page').forEach(el => el.classList.add('hidden'));

  if (popHistory && history.state && history.state.subpage) history.back();
}

export function openITSubPage(subpageId, pushState = true) {
  state.isITSubpageOpen = true;
  if (pushState) history.pushState({ tab: 'it', subpage: subpageId }, "");

  document.getElementById('it-menu-grid-view')?.classList.add('hidden');
  document.getElementById('it-subpage-detail-view')?.classList.remove('hidden');

  document.querySelectorAll('.it-feature-page').forEach(el => el.classList.add('hidden'));
  document.getElementById(`subtab-${subpageId}`)?.classList.remove('hidden');

  if (subpageId === 'it-database' && window.calculateDatabaseMetrics) window.calculateDatabaseMetrics();
  if (subpageId === 'it-users' && window.loadITUsersList) window.loadITUsersList();
  if (subpageId === 'it-logs' && window.loadAuditLogs) window.loadAuditLogs();
}

export function closeITSubPage(popHistory = true) {
  state.isITSubpageOpen = false;
  document.getElementById('it-subpage-detail-view')?.classList.add('hidden');
  document.getElementById('it-menu-grid-view')?.classList.remove('hidden');
  document.querySelectorAll('.it-feature-page').forEach(el => el.classList.add('hidden'));

  if (popHistory && history.state && history.state.subpage) history.back();
}

// ==========================================
// 7. POPSTATE HANDLER (SINKRONISASI TOMBOL BACK DEVICE)
// ==========================================
export function showExitToast() {
  const toast = document.getElementById('toast-exit');
  if (!toast) return;
  toast.classList.remove('hidden');
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2000);
}

export function initPopStateHandler() {
  history.replaceState({ tab: 'beranda', subpage: null }, "");

  window.addEventListener('popstate', () => {
    // 1. Tutup modal overlay jika sedang aktif
    if (document.getElementById('edit-attendance-modal')?.classList.contains('hidden') === false) {
      document.getElementById('edit-attendance-modal')?.classList.add('hidden');
      return;
    }
    if (document.getElementById('kpi-cert-modal')?.classList.contains('hidden') === false) {
      document.getElementById('kpi-cert-modal')?.classList.add('hidden');
      return;
    }
    if (document.getElementById('gm-scanner-modal')?.classList.contains('hidden') === false) {
      if (window.closeGMScannerModal) window.closeGMScannerModal();
      else document.getElementById('gm-scanner-modal')?.classList.add('hidden');
      return;
    }
    if (document.getElementById('qr-receipt-modal')?.classList.contains('hidden') === false) {
      if (window.closeQRReceiptModal) window.closeQRReceiptModal();
      else document.getElementById('qr-receipt-modal')?.classList.add('hidden');
      return;
    }
    if (document.getElementById('qris-kasbon-modal')?.classList.contains('hidden') === false) {
      if (window.closeKasbonQRISModal) window.closeKasbonQRISModal();
      else document.getElementById('qris-kasbon-modal')?.classList.add('hidden');
      return;
    }
    if (document.getElementById('share-options-modal')?.classList.contains('hidden') === false) {
      if (window.closeShareOptionsModal) window.closeShareOptionsModal();
      else document.getElementById('share-options-modal')?.classList.add('hidden');
      return;
    }
    if (document.getElementById('crop-modal')?.classList.contains('hidden') === false) {
      document.getElementById('crop-modal')?.classList.add('hidden');
      return;
    }
    if (document.getElementById('custom-modal')?.classList.contains('hidden') === false) {
      closeModal();
      return;
    }

    // 2. Navigasi kembali dari Employee Picker Page ke sub-halaman pengirim
    if (state.currentActiveTab === 'employee-picker-page') {
      navigateToTab('hr', false);
      if (state.activePickerContext === 'shift') openHRSubPage('hr-shift', false);
      else if (state.activePickerContext === 'salary') openHRSubPage('hr-salary-structure', false);
      else if (state.activePickerContext === 'task') openHRSubPage('hr-tasks-assign', false);
      else if (state.activePickerContext === 'attendance') openHRSubPage('hr-attendance', false);
      else if (state.activePickerContext === 'manual_attendance') openHRSubPage('hr-manual-attendance', false);
      return;
    }

    // 3. Form Parameter Role -> Menu Pilihan Role
    const roleParamForm = document.getElementById('subtab-hr-role-param-form');
    if (state.isHRSubpageOpen && roleParamForm && !roleParamForm.classList.contains('hidden')) {
      document.querySelectorAll('.hr-feature-page').forEach(el => el.classList.add('hidden'));
      document.getElementById('subtab-hr-params-menu')?.classList.remove('hidden');
      return;
    }

    // 4. Laman Manual Attendance -> Kembali ke Log Rekap Absensi
    const manualAttSubPage = document.getElementById('subtab-hr-manual-attendance');
    if (state.isHRSubpageOpen && manualAttSubPage && !manualAttSubPage.classList.contains('hidden')) {
      openHRSubPage('hr-attendance', false);
      return;
    }

    // 5. Sub-Menu HR -> Grid Menu Utama HR
    if (state.isHRSubpageOpen) {
      closeHRSubPage(false);
      return;
    }

    // 6. Sub-Menu IT -> Grid Menu Utama IT
    if (state.isITSubpageOpen) {
      closeITSubPage(false);
      return;
    }

    // 7. Sub-halaman Umum
    if (state.currentActiveTab === 'claim-salary') {
      navigateToTab('payslip-page', false);
      return;
    }

    if (state.currentActiveTab === 'payslip-page' || state.currentActiveTab === 'salary-history-page') {
      navigateToTab('gaji', false);
      return;
    }

    if (state.currentActiveTab === 'gaji' || state.currentActiveTab === 'tugas' || state.currentActiveTab === 'kasbon' || state.currentActiveTab === 'leave-form' || state.currentActiveTab === 'employee-request-page' || state.currentActiveTab === 'change-pass') {
      navigateToTab('beranda', false);
      return;
    }

    if (state.currentActiveTab !== 'beranda') {
      navigateToTab('beranda', false);
      return;
    }

    // 8. Double-press back untuk keluar aplikasi di tab beranda
    const now = Date.now();
    if (now - state.lastBackPressTime < 2000) {
      history.back();
    } else {
      state.lastBackPressTime = now;
      showExitToast();
      history.pushState({ tab: 'beranda', subpage: null }, "");
    }
  });
}
