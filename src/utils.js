/* ==========================================================================
   SRC/UTILS.JS - UTILITIES, UI HELPERS & HIERARCHICAL DEVICE BACK SYSTEM
   MYAIWA - AIWA RAGIN JAJE SYSTEM
   ========================================================================== */

import { state } from "./constants.js";
import { auth } from "../firebase-config.js";

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
// 2. LOADING STATE HANDLER
// ==========================================
export function showLoading() {
  const overlay = document.getElementById("loading-overlay");
  const loader = document.getElementById("global-loader");
  if (overlay) overlay.classList.remove("hidden");
  if (loader) loader.classList.remove("hidden");
}

export function hideLoading() {
  const overlay = document.getElementById("loading-overlay");
  const loader = document.getElementById("global-loader");
  if (overlay) overlay.classList.add("hidden");
  if (loader) loader.classList.add("hidden");
}

// ==========================================
// 3. MODAL DIALOG NOTIFIKASI & HELPER INPUT
// ==========================================
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
  document.getElementById("confirm-modal")?.classList.add("hidden");
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
    if (modal) {
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
      return;
    }

    resolve(confirm(`${title}\n\n${msg}`));
  });
}

// ==========================================
// 4. SAPAAN DINAMIS & AVATAR PENGGUNA
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
// 5. TEMA SISTEM & SINKRONISASI STATUS BAR
// ==========================================
export function switchGlobalTheme(theme) {
  const metaTheme = document.getElementById('meta-theme-color') || document.querySelector('meta[name="theme-color"]');
  
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    if (metaTheme) metaTheme.setAttribute('content', '#0f172a');
  } else {
    document.body.classList.remove('dark-mode');
    if (metaTheme) metaTheme.setAttribute('content', '#ffffff');
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
// 6. HELPER WAKTU & FORMAT RUPIAH
// ==========================================
export function calculateLateThresholdTime(baseTimeStr, toleranceMin) {
  if (!baseTimeStr) return "07:45:00";
  const [h, m] = baseTimeStr.split(":").map(Number);
  const totalMin = (h * 60) + m + Number(toleranceMin || 0);
  const thH = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
  const thM = String(totalMin % 60).padStart(2, '0');
  return `${thH}:${thM}:00`;
}

export function formatRupiah(number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(number) || 0);
}

// ==========================================
// 7. PWA INSTALLER & HARD UPDATE SYSTEM
// ==========================================
export async function forceUpdateAndClearCache() {
  const confirmUpdate = await showCustomConfirm(
    "Perbarui Sistem",
    "Aplikasi akan menghapus seluruh data cache lama, memperbarui modul, dan memuat ulang sistem terbaru. Lanjutkan?"
  );
  if (!confirmUpdate) return;

  showLoading();

  try {
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(k => caches.delete(k)));
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }

    setTimeout(() => {
      window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
    }, 600);
  } catch (err) {
    hideLoading();
    notify("Gagal Update", err.message);
  }
}

export async function triggerPWAInstall() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    return notify("Informasi", "Aplikasi Myaiwa sudah terpasang dan berjalan dalam mode aplikasi mandiri.");
  }

  if (state.deferredPWAInstallPrompt) {
    state.deferredPWAInstallPrompt.prompt();
    const { outcome } = await state.deferredPWAInstallPrompt.userChoice;
    state.deferredPWAInstallPrompt = null;
    if (outcome === 'accepted') {
      notify("Berhasil", "Terima kasih! Aplikasi Myaiwa sedang dipasang ke perangkat Anda.");
    }
    return;
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    return notify(
      "Pasang di iPhone / iPad",
      "1. Tekan tombol 'Bagikan' (Share icon berbentuk kotak panah atas) di browser Safari Anda.\n2. Gulir ke bawah lalu pilih 'Tambah ke Layar Utama' (Add to Home Screen)."
    );
  }

  notify(
    "Pasang Aplikasi",
    "Gunakan opsi menu browser Anda (titik tiga di pojok kanan atas) lalu pilih 'Install App' atau 'Tambahkan ke Layar Utama'."
  );
}

// ==========================================
// 8. NAVIGASI UTAMA & SUB-PAGE (LIFECYCLE HOOKS)
// ==========================================
export function navigateToTab(tabName, pushState = true) {
  if (pushState) history.pushState({ tab: tabName, subpage: null }, "");

  if (state.currentActiveTab === 'absensi' && tabName !== 'absensi' && window.cleanupMapLibre) {
    window.cleanupMapLibre();
  }

  state.currentActiveTab = tabName;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.bottom-nav .nav-item, .bottom-nav-bar .nav-item').forEach(el => el.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.remove('hidden');
    
    // Lifecycle Triggers
    if (tabName === 'absensi' && window.initMapLibre) {
      setTimeout(window.initMapLibre, 150);
    } else if (tabName === 'accounting') {
      if (window.initKPIReportTab) {
        window.initKPIReportTab();
      } else if (window.calculateUserKPI && auth.currentUser) {
        window.calculateUserKPI(auth.currentUser.uid);
      }
    } else if (tabName === 'it' && window.initITPanel) {
      window.initITPanel();
    } else if (tabName === 'salary-history-page' && window.renderUserSlipHistory) {
      window.renderUserSlipHistory();
    } else if (tabName === 'gaji') {
      closeFinanceSubPage(false);
    } else if (tabName === 'tugas' && window.loadDailyTaskChecklist) {
      window.loadDailyTaskChecklist();
    }
  }

  const navEl = document.getElementById(`nav-${tabName}`) || document.querySelector(`[data-tab="${tabName}"]`);
  if (navEl) navEl.classList.add('active');

  if (tabName !== 'hr') closeHRSubPage(false);
  if (tabName !== 'it') closeITSubPage(false);
  if (tabName !== 'gaji') closeFinanceSubPage(false);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function openFinanceSubPage(subpageId, pushState = true) {
  state.isFinanceSubpageOpen = true;
  if (pushState) history.pushState({ tab: 'gaji', subpage: subpageId }, "");

  document.getElementById('finance-menu-grid-view')?.classList.add('hidden');
  document.getElementById('finance-subpage-detail-view')?.classList.remove('hidden');

  if (subpageId === 'finance-kasbon' && window.loadKasbonAccountSummary) {
    window.loadKasbonAccountSummary();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function closeFinanceSubPage(popHistory = true) {
  state.isFinanceSubpageOpen = false;
  document.getElementById('finance-subpage-detail-view')?.classList.add('hidden');
  document.getElementById('finance-menu-grid-view')?.classList.remove('hidden');

  if (popHistory && history.state && history.state.subpage) history.back();
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

  window.scrollTo({ top: 0, behavior: 'smooth' });
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

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function closeITSubPage(popHistory = true) {
  state.isITSubpageOpen = false;
  document.getElementById('it-subpage-detail-view')?.classList.add('hidden');
  document.getElementById('it-menu-grid-view')?.classList.remove('hidden');
  document.querySelectorAll('.it-feature-page').forEach(el => el.classList.add('hidden'));

  if (popHistory && history.state && history.state.subpage) history.back();
}

// ==========================================
// 9. HIERARCHICAL DEVICE BACK SYSTEM (POPSTATE)
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
    // 1. TUTUP MODAL / POPUP AKTIF JIKA ADA
    if (document.getElementById('edit-attendance-modal')?.classList.contains('hidden') === false) {
      document.getElementById('edit-attendance-modal')?.classList.add('hidden');
      history.pushState({ tab: state.currentActiveTab, subpage: null }, "");
      return;
    }
    if (document.getElementById('crosscheck-modal')?.classList.contains('hidden') === false) {
      document.getElementById('crosscheck-modal')?.classList.add('hidden');
      history.pushState({ tab: state.currentActiveTab, subpage: null }, "");
      return;
    }
    if (document.getElementById('qr-receipt-modal')?.classList.contains('hidden') === false) {
      if (window.closeQRReceiptModal) window.closeQRReceiptModal();
      else document.getElementById('qr-receipt-modal')?.classList.add('hidden');
      history.pushState({ tab: state.currentActiveTab, subpage: null }, "");
      return;
    }
    if (document.getElementById('share-options-modal')?.classList.contains('hidden') === false) {
      if (window.closeShareOptionsModal) window.closeShareOptionsModal();
      else document.getElementById('share-options-modal')?.classList.add('hidden');
      history.pushState({ tab: state.currentActiveTab, subpage: null }, "");
      return;
    }
    if (document.getElementById('crop-modal')?.classList.contains('hidden') === false) {
      document.getElementById('crop-modal')?.classList.add('hidden');
      history.pushState({ tab: state.currentActiveTab, subpage: null }, "");
      return;
    }
    if (document.getElementById('custom-modal')?.classList.contains('hidden') === false || document.getElementById('confirm-modal')?.classList.contains('hidden') === false) {
      closeModal();
      history.pushState({ tab: state.currentActiveTab, subpage: null }, "");
      return;
    }

    // 2. SUB-PAGE KASBON DALAM MODUL FINANCE -> KEMBALI KE GRID MENU FINANCE
    if (state.isFinanceSubpageOpen) {
      closeFinanceSubPage(false);
      return;
    }

    // 3. LAMAN QR PENCAIRAN GAJI TUNAI -> KEMBALI KE SLIP
    if (state.currentActiveTab === 'qris-salary-page') {
      if (window.closeSalaryQRModal) window.closeSalaryQRModal();
      else navigateToTab('payslip-page', false);
      return;
    }

    // 4. LAMAN SERTIFIKAT KPI FULL-PAGE -> KEMBALI KE LAPORAN KPI
    if (state.currentActiveTab === 'kpi-cert-page') {
      navigateToTab('accounting', false);
      return;
    }

    // 5. LAMAN SCANNER QR FULL-PAGE -> HENTIKAN KAMERA & KEMBALI KE DAFTAR PENGAJUAN
    if (state.currentActiveTab === 'gm-scanner-page') {
      if (state.html5QrScanner) {
        state.html5QrScanner.stop().catch(() => {}).finally(() => {
          state.html5QrScanner = null;
        });
      }
      navigateToTab('hr', false);
      openHRSubPage('hr-requests', false);
      return;
    }

    // 6. LAMAN DETAIL KASBON FULL-PAGE -> KEMBALI KE DAFTAR PENGAJUAN
    if (state.currentActiveTab === 'kasbon-detail-page') {
      navigateToTab('hr', false);
      openHRSubPage('hr-requests', false);
      return;
    }

    // 7. LAMAN PEMILIH KARYAWAN -> KEMBALI KE SUBPAGE PEMANGGIL
    if (state.currentActiveTab === 'employee-picker-page') {
      navigateToTab('hr', false);
      if (state.activePickerContext === 'shift') openHRSubPage('hr-shift', false);
      else if (state.activePickerContext === 'salary') openHRSubPage('hr-salary-structure', false);
      else if (state.activePickerContext === 'task') openHRSubPage('hr-tasks-assign', false);
      else if (state.activePickerContext === 'attendance') openHRSubPage('hr-attendance', false);
      else if (state.activePickerContext === 'manual_attendance') openHRSubPage('hr-manual-attendance', false);
      return;
    }

    // 8. SUB-SUBPAGE DALAM MODUL HR
    const roleParamForm = document.getElementById('subtab-hr-role-param-form');
    if (state.isHRSubpageOpen && roleParamForm && !roleParamForm.classList.contains('hidden')) {
      document.querySelectorAll('.hr-feature-page').forEach(el => el.classList.add('hidden'));
      document.getElementById('subtab-hr-params-menu')?.classList.remove('hidden');
      return;
    }

    const manualAttSubPage = document.getElementById('subtab-hr-manual-attendance');
    if (state.isHRSubpageOpen && manualAttSubPage && !manualAttSubPage.classList.contains('hidden')) {
      openHRSubPage('hr-attendance', false);
      return;
    }

    // 9. SUB-PAGES MODUL HR -> KEMBALI KE GRID MENU HR
    if (state.isHRSubpageOpen) {
      closeHRSubPage(false);
      return;
    }

    // 10. SUB-PAGES MODUL IT -> KEMBALI KE GRID MENU IT
    if (state.isITSubpageOpen) {
      closeITSubPage(false);
      return;
    }

    // 11. LAMAN UBAH PASSWORD -> KEMBALI KE PROFIL
    if (state.currentActiveTab === 'change-pass') {
      navigateToTab('profile', false);
      return;
    }

    // 12. FORMULIR PULANG AWAL & CUTI -> DINAMIS KEMBALI KE TAB ASAL
    if (state.currentActiveTab === 'early-leave-form') {
      navigateToTab('absensi', false);
      return;
    }
    if (state.currentActiveTab === 'leave-form') {
      navigateToTab(state.leaveFormOriginTab || 'beranda', false);
      return;
    }

    // 13. LAMAN PENUH QRIS KASBON -> KEMBALI KE SUB-PAGE KASBON
    if (state.currentActiveTab === 'qris-kasbon-page') {
      if (state.qrCountdownInterval) clearInterval(state.qrCountdownInterval);
      navigateToTab('gaji', false);
      openFinanceSubPage('finance-kasbon', false);
      return;
    }

    // 14. ALUR GAJI & SLIP
    if (state.currentActiveTab === 'claim-salary') {
      navigateToTab('payslip-page', false);
      return;
    }
    if (state.currentActiveTab === 'payslip-page' || state.currentActiveTab === 'salary-history-page') {
      navigateToTab('gaji', false);
      return;
    }

    // 15. FORMULIR PENGAJUAN STAF UMUM -> KEMBALI KE BERANDA
    if (state.currentActiveTab === 'employee-request-page') {
      navigateToTab('beranda', false);
      return;
    }

    // 16. DARI TAB UTAMA LAINNYA -> KEMBALI KE BERANDA (HOME)
    if (state.currentActiveTab !== 'beranda') {
      navigateToTab('beranda', false);
      return;
    }

    // 17. ROOT (BERANDA) -> DOUBLE TAP BACK UNTUK KELUAR
    const now = Date.now();
    if (now - (state.lastBackPressTime || 0) < 2000) {
      history.back();
    } else {
      state.lastBackPressTime = now;
      showExitToast();
      history.pushState({ tab: 'beranda', subpage: null }, "");
    }
  });
}
