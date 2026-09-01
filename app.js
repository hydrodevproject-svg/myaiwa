/* ==========================================================================
   MYAIWA - AIWA RAGIN JAJE (MAIN ENTRY POINT & ACTION BRIDGE)
   ========================================================================== */

import { auth, db } from "./firebase-config.js";
import { state } from "./src/constants.js";
import { loadAllViews } from "./src/view-loader.js";

// IMPORT SELURUH MODUL DOMAIN
import * as Utils from "./src/utils.js";
import * as Auth from "./src/auth.js";
import * as Attendance from "./src/attendance.js";
import * as TasksKPI from "./src/tasks-kpi.js";
import * as PayrollKasbon from "./src/payroll-kasbon.js";
import * as HR from "./src/hr-management.js";
import * as IT from "./src/it-system.js";

// ==========================================
// 1. ISOLASI NAMESPACE & ACTION DISPATCHER
// ==========================================
const publicActions = {
  state,
  // Utils & Navigasi
  navigateToTab: Utils.navigateToTab,
  openFinanceSubPage: Utils.openFinanceSubPage,
  closeFinanceSubPage: Utils.closeFinanceSubPage,
  openHRSubPage: Utils.openHRSubPage,
  closeHRSubPage: Utils.closeHRSubPage,
  openITSubPage: Utils.openITSubPage,
  closeITSubPage: Utils.closeITSubPage,
  switchGlobalTheme: Utils.switchGlobalTheme,
  togglePasswordVisibility: Utils.togglePasswordVisibility,
  forceUpdateAndClearCache: Utils.forceUpdateAndClearCache,
  triggerPWAInstall: Utils.triggerPWAInstall,
  closeModal: Utils.closeModal,
  closeCropModal: Utils.closeCropModal,
  updateFileName: Utils.updateFileName,

  // Auth & Profile
  triggerLogout: Auth.triggerLogout,
  openCropperModal: Auth.openCropperModal,

  // Absensi & GPS (Lengkap dengan Handler Form & Modal)
  refreshMapLibreGPS: Attendance.refreshMapLibreGPS,
  executeGPSAttendance: Attendance.executeGPSAttendance,
  openLeaveFormPage: Attendance.openLeaveFormPage,
  openManualAttendancePage: Attendance.openManualAttendancePage,
  saveManualAttendance: Attendance.saveManualAttendance,
  selectReportPeriodType: Attendance.selectReportPeriodType,
  openTargetUserPicker: Attendance.openTargetUserPicker,
  generateAdminAttendanceReport: Attendance.generateAdminAttendanceReport,
  openEditAttendanceModal: Attendance.openEditAttendanceModal,
  closeEditAttendanceModal: Attendance.closeEditAttendanceModal,
  saveEditedAttendance: Attendance.saveEditedAttendance,
  deleteAttendanceRecord: Attendance.deleteAttendanceRecord,
  openEarlyLeavePage: Attendance.openEarlyLeavePage,
  selectEarlyLeaveCategory: Attendance.selectEarlyLeaveCategory,
  submitEarlyLeaveRequest: Attendance.submitEarlyLeaveRequest,
  calculateLeaveDays: Attendance.calculateLeaveDays,
  initMapLibre: Attendance.initMapLibre,
  cleanupMapLibre: Attendance.cleanupMapLibre,
  checkTodayAttendance: Attendance.checkTodayAttendance,
  populateReportUserDropdown: Attendance.populateReportUserDropdown,

  // Tugas & KPI
  submitDailyTasksFinal: TasksKPI.submitDailyTasksFinal,
  toggleDailyTaskStatus: TasksKPI.toggleDailyTaskStatus,
  calculateUserKPI: TasksKPI.calculateUserKPI,
  initKPIReportTab: TasksKPI.initKPIReportTab,
  renderGMLeaderboardReport: TasksKPI.renderGMLeaderboardReport,
  filterLeaderboardReport: TasksKPI.filterLeaderboardReport,
  openKPICertificateModal: TasksKPI.openKPICertificateModal,
  closeKPICertModal: TasksKPI.closeKPICertModal,
  printKPICertificate: TasksKPI.printKPICertificate,
  openCrosscheckModal: TasksKPI.openCrosscheckModal,
  closeCrosscheckModal: TasksKPI.closeCrosscheckModal,
  submitKPICrosscheck: TasksKPI.submitKPICrosscheck,
  loadDailyTaskChecklist: TasksKPI.loadDailyTaskChecklist,

  // Finance, Payroll & Kasbon
  compileEmployeeSlip: PayrollKasbon.compileEmployeeSlip,
  openMyCurrentPayslip: PayrollKasbon.openMyCurrentPayslip,
  viewCurrentMonthPayslip: PayrollKasbon.openMyCurrentPayslip,
  lockAndPublishMonthlySlips: PayrollKasbon.lockAndPublishMonthlySlips,
  renderUserSlipHistory: PayrollKasbon.renderUserSlipHistory,
  openPayslipDetail: PayrollKasbon.openPayslipDetail,
  openClaimSalaryPage: PayrollKasbon.openClaimSalaryPage,
  selectDisbursementMethod: PayrollKasbon.selectDisbursementMethod,
  submitSalaryDisbursement: PayrollKasbon.submitSalaryDisbursement,
  openGMScannerModal: PayrollKasbon.openGMScannerModal,
  closeGMScannerModal: PayrollKasbon.closeGMScannerModal,
  validateManualVoucherCode: PayrollKasbon.validateManualVoucherCode,
  validateScannedOperationalCode: PayrollKasbon.validateScannedOperationalCode,
  openShareOptionsModal: Utils.notify,
  closeShareOptionsModal: Utils.closeModal,
  printPayslip: PayrollKasbon.printPayslip,
  exportPayslipFile: PayrollKasbon.exportPayslipFile,
  getKasbonTierLimits: PayrollKasbon.getKasbonTierLimits,
  openKasbonForm: PayrollKasbon.openKasbonForm,
  closeKasbonForm: PayrollKasbon.closeKasbonForm,
  calculateKasbonInstallment: PayrollKasbon.calculateKasbonInstallment,
  submitKasbonTransaction: PayrollKasbon.submitKasbonTransaction,
  loadKasbonAccountSummary: PayrollKasbon.loadKasbonAccountSummary,
  openKasbonQRISPage: PayrollKasbon.openKasbonQRISPage,
  showKasbonQRISModal: PayrollKasbon.openKasbonQRISPage,
  closeKasbonQRISModal: PayrollKasbon.closeKasbonQRISModal,
  loadHRRequestsList: PayrollKasbon.loadHRRequestsList,
  approveDisbursement: PayrollKasbon.approveDisbursement,
  updateRequestStatus: PayrollKasbon.updateRequestStatus,
  closeQRReceiptModal: PayrollKasbon.closeQRReceiptModal,
  openKasbonPaymentDetailModal: PayrollKasbon.openKasbonPaymentDetailModal,
  closeKasbonPaymentDetailModal: PayrollKasbon.closeKasbonPaymentDetailModal,

  // HR Management
  setRosterDay: HR.setRosterDay,
  selectSpecificShiftOption: HR.selectSpecificShiftOption,
  openCareerPromotionForm: HR.openCareerPromotionForm,
  onCareerLevelPresetChange: HR.onCareerLevelPresetChange,
  filterCareerPathList: HR.filterCareerPathList,
  navigateToEmployeePickerPage: HR.navigateToEmployeePickerPage,
  renderEmployeePickerItems: HR.renderEmployeePickerItems,
  filterEmployeePickerPageList: HR.filterEmployeePickerPageList,
  selectEmployeeFromPicker: HR.selectEmployeeFromPicker,
  openRoleParameterPage: HR.openRoleParameterPage,
  handleSaveRoleParameters: HR.handleSaveRoleParameters,
  saveAssignedShift: HR.saveAssignedShift,
  loadHRUserOptions: HR.loadHRUserOptions,
  loadCareerPathList: HR.loadCareerPathList,

  // IT System
  initITPanel: IT.initITPanel,
  refreshITMetrics: IT.refreshITMetrics,
  loadITUsersList: IT.loadITUsersList,
  filterITUsersList: IT.filterITUsersList,
  deleteUserAccount: IT.deleteUserAccount,
  loadAuditLogs: IT.loadAuditLogs,
  filterAuditLogs: IT.filterAuditLogs,
  exportDatabaseBackup: IT.exportDatabaseBackup,
  executeMassDatabaseWipe: IT.executeMassDatabaseWipe,
  calculateDatabaseMetrics: IT.calculateDatabaseMetrics
};

Object.assign(window, publicActions);

// ==========================================
// 2. GLOBAL EVENT CAPTURE & NETWORK MONITOR
// ==========================================
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredPWAInstallPrompt = e;
});

window.addEventListener('appinstalled', () => {
  state.deferredPWAInstallPrompt = null;
});

window.addEventListener('online', () => {
  Utils.notify("Koneksi Pulih", "Perangkat Anda kembali terhubung ke jaringan internet.");
});

window.addEventListener('offline', () => {
  Utils.notify("Mode Offline", "Koneksi terputus. Sistem tetap dapat diakses menggunakan cache lokal.");
});

// ==========================================
// 3. INISIALISASI UTAMA SIKLUS APLIKASI
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadAllViews();

    Utils.initLiveClock();
    Utils.initSavedTheme();
    Utils.initPopStateHandler();

    Auth.initAuthObserver(async (user, userData) => {
      await TasksKPI.loadDailyTaskChecklist();
      await TasksKPI.calculateUserKPI(user.uid);
      Attendance.checkTodayAttendance();

      const role = String(userData?.role || 'staff').toLowerCase();
      if (role === "admin" || role === "gm" || role === "it") {
        await HR.loadHRUserOptions();
        await PayrollKasbon.loadHRRequestsList();
      }
    });

    attachDOMEventListeners();
  } catch (err) {
    console.error("Gagal inisialisasi aplikasi Myaiwa:", err);
  }
});

// ==========================================
// 4. ATTACH FORM EVENT LISTENERS
// ==========================================
function attachDOMEventListeners() {
  // FORM LOGIN
  document.getElementById("form-login")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    try {
      await Auth.loginUser(email, password);
    } catch (err) {}
  });

  // CROP AVATAR
  document.getElementById("input-avatar-file")?.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      Auth.openCropperModal(e.target.files[0], "avatar");
    }
  });

  document.getElementById("btn-apply-crop")?.addEventListener("click", () => {
    Auth.applyAndSaveCrop();
  });

  // FORM TRANSAKSI KASBON
  document.getElementById("form-transaksi-kasbon")?.addEventListener("submit", async (e) => {
    await PayrollKasbon.submitKasbonTransaction(e);
  });

  // PROMOSI KARIR
  document.getElementById("form-update-career-level")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("career-target-uid").value;
    const newLevel = document.getElementById("career-select-level").value;
    const customAllowance = Number(document.getElementById("career-custom-allowance").value || 0);

    await HR.saveCareerPromotion(userId, newLevel, customAllowance);
  });

  // PENUGASAN TUGAS KHUSUS
  document.getElementById("form-assign-custom-task")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("task-select-user").value;
    const instruction = document.getElementById("task-instruction-input").value.trim();
    const targetDate = document.getElementById("task-target-date").value;

    await HR.assignCustomTask(userId, instruction, targetDate);
  });

  // SHIFT & MODE KERJA
  document.getElementById("form-assign-shift")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await HR.saveAssignedShift(e);
  });

  // STRUKTUR GAJI & TERMIN
  document.getElementById("form-salary-structure")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("salary-select-user").value;
    const base = Number(document.getElementById("sal-base").value);
    const meal = Number(document.getElementById("sal-meal-daily").value);
    const payrollTerm = document.getElementById("sal-payroll-term")?.value || "termin_1";
    
    const bankName = document.getElementById("sal-bank-name").value;
    const bankNumber = document.getElementById("sal-bank-number").value.trim();
    const bankHolder = document.getElementById("sal-bank-holder").value.trim();

    await HR.saveSalaryStructure(userId, base, meal, bankName, bankNumber, bankHolder, payrollTerm);
  });

  // PARAMETER ROLE
  document.getElementById("form-update-role-param")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await HR.handleSaveRoleParameters(e);
  });

  // REKRUTMEN USER BARU
  document.getElementById("form-create-user")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("new-user-name").value.trim();
    const email = document.getElementById("new-user-email").value.trim();
    const pass = document.getElementById("new-user-password").value;
    const role = document.getElementById("new-user-role").value;

    await Auth.createUserAccount(name, email, pass, role);
  });

  // IT CREATE USER
  document.getElementById("form-it-create-user")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("it-user-name").value.trim();
    const email = document.getElementById("it-user-email").value.trim();
    const pass = document.getElementById("it-user-password").value;
    const role = document.getElementById("it-user-role").value;

    await Auth.createITUserAccount(name, email, pass, role);
  });

  // UPDATE PROFIL
  document.getElementById("form-update-profile")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("profile-full-name").value.trim();
    const phone = document.getElementById("profile-phone").value.trim();
    const address = document.getElementById("profile-address").value.trim();

    await Auth.updateUserProfile(name, phone, address);
  });

  // UBAH PASSWORD
  document.getElementById("form-direct-change-pass")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPass = document.getElementById("pass-current").value;
    const newPass = document.getElementById("pass-new").value;
    const confirmPass = document.getElementById("pass-confirm").value;

    await Auth.changeUserPassword(currentPass, newPass, confirmPass);
  });

  // FORM PENGAJUAN STAF
  document.getElementById('form-submit-emp-request-page')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    const val = Number(document.getElementById('emp-req-page-val').value);
    const note = document.getElementById('emp-req-page-note').value.trim();

    if (!val || val <= 0) return Utils.notify("Perhatian", "Masukkan nominal pinjaman/jumlah hari yang valid.");
    if (!note) return Utils.notify("Perhatian", "Tuliskan keterangan alasan pengajuan.");

    Utils.showLoading();
    try {
      const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      await addDoc(collection(db, "employee_requests"), {
        uid: user.uid,
        nama: document.getElementById("header-user-name")?.innerText || state.currentUserData?.nama || user.email,
        type: state.pendingEmployeeRequestType,
        amount: val,
        note: note,
        status: "Pending",
        requested_millis: Date.now(),
        timestamp: serverTimestamp()
      });
      Utils.hideLoading();
      Utils.notify("Berhasil", `Pengajuan ${state.pendingEmployeeRequestType} telah terkirim.`);
      Utils.navigateToTab('beranda');
      PayrollKasbon.loadHRRequestsList();
    } catch (err) { 
      Utils.hideLoading();
      Utils.notify("Gagal", err.message); 
    }
  });

  // FORM CUTI & SAKIT
  document.getElementById('form-submit-leave')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const start = document.getElementById('leave-start-date').value;
    const end = document.getElementById('leave-end-date').value;
    const duration = document.getElementById('leave-duration-display').value;
    const reason = document.getElementById('leave-reason-text').value.trim();
    const fileInput = document.getElementById('leave-file-input');
    const file = (fileInput && fileInput.files && fileInput.files[0]) ? fileInput.files[0] : null;

    await Attendance.submitLeaveRequest(start, end, duration, reason, file);
  });

  // IMPORT DATABASE
  document.getElementById("form-import-data")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("import-file-input");
    const targetCol = document.getElementById("import-target-col").value;

    if (!fileInput.files || !fileInput.files[0]) return Utils.notify("Perhatian", "Pilih file terlebih dahulu.");

    await IT.importDatabaseData(fileInput.files[0], targetCol);
  });
}

// SERVICE WORKER REGISTRATION
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  });
}
