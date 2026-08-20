/* ==========================================================================
   MYAIWA - AIWA RAGIN JAJE (MAIN ENTRY POINT & DISPATCHER)
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

// EKSPOS FUNGSI KE GLOBAL WINDOW
Object.assign(window, {
  state,
  ...Utils,
  ...Auth,
  ...Attendance,
  ...TasksKPI,
  ...PayrollKasbon,
  ...HR,
  ...IT
});

// INISIALISASI UTAMA DENGAN MEMUAT SEMUA VIEW DULU
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Muat seluruh file HTML parsial ke DOM
  await loadAllViews();

  // 2. Inisialisasi UI dasar
  Utils.initLiveClock();
  Utils.initSavedTheme();
  Utils.initPopStateHandler();

  // 3. Pasang Auth State Observer
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

  // 4. Pasang Event Listener Form
  attachDOMEventListeners();
});

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
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const actionType = document.getElementById("kasbon-action-type").value;
    const currentKPIStatus = document.getElementById("kpi-status-tag")?.innerText?.trim().toLowerCase() || "kurang";

    if (actionType === "pinjam" && currentKPIStatus !== "memuaskan") {
      return Utils.notify("Pengajuan Ditolak", "Status performa KPI Anda belum memenuhi syarat minimal 'Memuaskan' (>85%).");
    }

    const amount = Number(document.getElementById("kasbon-amount-input").value);
    const note = document.getElementById("kasbon-notes-input").value.trim();
    const monthlyInstallment = actionType === "pinjam" ? Number(document.getElementById("kasbon-monthly-installment")?.value || 0) : 0;
    const tenorMonths = actionType === "pinjam" ? Number(document.getElementById("kasbon-tenor-months")?.value || 1) : 1;

    if (!amount || amount <= 0) return Utils.notify("Perhatian", "Masukkan nominal yang valid.");

    Utils.showLoading("Menerbitkan QRIS transaksi kasbon...");

    try {
      const now = Date.now();
      const expiresAtMillis = now + (60 * 60 * 1000);
      const isPinjam = (actionType === "pinjam");
      const voucherCode = `${isPinjam ? 'KB' : 'BYR'}-${new Date().toISOString().slice(0, 7).replace("-", "")}-${Math.floor(1000 + Math.random() * 9000)}`;

      const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const payload = {
        uid: user.uid,
        nama: state.currentUserData?.nama || user.email,
        role: state.currentUserData?.role || "staff",
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

      Utils.hideLoading();
      document.getElementById("box-form-kasbon")?.classList.add("hidden");
      
      PayrollKasbon.showKasbonQRISModal(voucherCode, expiresAtMillis, payload);
      PayrollKasbon.loadKasbonAccountSummary();
    } catch (err) {
      Utils.hideLoading();
      Utils.notify("Gagal", err.message);
    }
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
    const userId = document.getElementById("hr-select-user").value;
    const shift = document.getElementById("hr-select-shift").value;
    const workMode = document.getElementById("hr-select-work-mode").value;

    await HR.saveAssignedShift(userId, shift, workMode);
  });

  // STRUKTUR GAJI
  document.getElementById("form-salary-structure")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("salary-select-user").value;
    const base = Number(document.getElementById("sal-base").value);
    const meal = Number(document.getElementById("sal-meal-daily").value);
    
    const bankName = document.getElementById("sal-bank-name").value;
    const bankNumber = document.getElementById("sal-bank-number").value.trim();
    const bankHolder = document.getElementById("sal-bank-holder").value.trim();

    await HR.saveSalaryStructure(userId, base, meal, bankName, bankNumber, bankHolder);
  });

  // PARAMETER ROLE
  document.getElementById("form-update-role-param")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const targetRoleKey = document.getElementById("target-role-param-id").value;
    
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

    await HR.saveRoleParameters(targetRoleKey, payload);
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

    Utils.showLoading("Mengirim formulir pengajuan...");
    try {
      const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      await addDoc(collection(db, "employee_requests"), {
        uid: user.uid,
        nama: document.getElementById("header-user-name")?.innerText || state.currentUserData?.nama || user.email,
        type: state.pendingEmployeeRequestType,
        amount: val,
        note: note,
        status: "Pending",
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

    await Attendance.submitLeaveRequest(start, end, duration, reason);
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

// SERVICE WORKER
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  });
}
