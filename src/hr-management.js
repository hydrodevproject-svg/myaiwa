/* ==========================================================================
   MYAIWA - HR MANAGEMENT, CAREER PATH, ROLES & DELEGATION (LENGKAP & OPTIMAL)
   ========================================================================== */

import { db } from "../firebase-config.js";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { 
  ROLE_DISPLAY_NAMES, 
  DEFAULT_ROLE_PARAMS, 
  DEFAULT_STAFF_WEEKLY_ROSTER,
  state 
} from "./constants.js";

import { 
  showLoading, 
  hideLoading, 
  notify, 
  navigateToTab, 
  openHRSubPage 
} from "./utils.js";

import { 
  renderGMLeaderboardReport, 
  filterLeaderboardReport 
} from "./tasks-kpi.js";

// Re-ekspor fungsi leaderboard agar tetap sinkron di window global
export { renderGMLeaderboardReport, filterLeaderboardReport };

// State temporary roster outlet aktif
let activeStaffRoster = { ...DEFAULT_STAFF_WEEKLY_ROSTER };

// ==========================================
// 1. SELEKSI SHIFT & ROSTER STAFF OUTLET
// ==========================================
export function setRosterDay(dayKey, shiftType) {
  activeStaffRoster[dayKey] = shiftType;

  ['pagi', 'malam', 'libur'].forEach(type => {
    const btn = document.getElementById(`rost-${dayKey}-${type}`);
    if (btn) {
      btn.classList.toggle('active-shift', type === shiftType);
      if (type === 'libur' && type === shiftType) {
        btn.style.borderColor = '#ef4444';
        btn.style.color = '#ef4444';
      } else if (type === 'libur') {
        btn.style.borderColor = '';
        btn.style.color = '';
      }
    }
  });
}

export function selectSpecificShiftOption(roleKey, shiftKey) {
  const hiddenInput = document.getElementById(`${roleKey}-chosen-shift`);
  if (hiddenInput) hiddenInput.value = shiftKey;

  document.querySelectorAll(`#box-shift-${roleKey} .shift-select-card`).forEach(el => el.classList.remove('active-shift'));
  const targetCard = document.getElementById(`shift-card-${roleKey}-${shiftKey}`);
  if (targetCard) targetCard.classList.add('active-shift');
}

export function showRoleSpecificShiftUI(userObj) {
  const rawRole = String(userObj.role || 'staff').toLowerCase();
  
  document.getElementById("box-shift-placeholder")?.classList.add("hidden");
  document.getElementById("box-shift-staff-outlet")?.classList.add("hidden");
  document.getElementById("box-shift-admin")?.classList.add("hidden");
  document.getElementById("box-shift-logistik")?.classList.add("hidden");
  document.getElementById("box-shift-it")?.classList.add("hidden");
  document.getElementById("box-shift-gm")?.classList.add("hidden");
  document.getElementById("btn-save-shift-config")?.classList.remove("hidden");

  const hiddenRole = document.getElementById("hr-select-user-role");
  if (hiddenRole) hiddenRole.value = rawRole;

  if (rawRole === 'staff') {
    document.getElementById("box-shift-staff-outlet")?.classList.remove("hidden");
    activeStaffRoster = userObj.weekly_schedule ? { ...userObj.weekly_schedule } : { ...DEFAULT_STAFF_WEEKLY_ROSTER };
    
    Object.keys(activeStaffRoster).forEach(day => {
      setRosterDay(day, activeStaffRoster[day] || 'pagi');
    });
  } 
  else if (rawRole === 'admin') {
    document.getElementById("box-shift-admin")?.classList.remove("hidden");
    const currentShift = userObj.shift || 'pagi';
    selectSpecificShiftOption('admin', currentShift);
    
    const wfaStart = document.getElementById("admin-wfa-start");
    const wfaEnd = document.getElementById("admin-wfa-end");
    if (wfaStart) wfaStart.value = userObj.wfa_start_date || "";
    if (wfaEnd) wfaEnd.value = userObj.wfa_end_date || "";
  } 
  else if (rawRole === 'logistik') {
    document.getElementById("box-shift-logistik")?.classList.remove("hidden");
    const currentShift = userObj.shift || 'pagi';
    selectSpecificShiftOption('logistik', currentShift);
  } 
  else if (rawRole === 'it') {
    document.getElementById("box-shift-it")?.classList.remove("hidden");
  } 
  else if (rawRole === 'gm') {
    document.getElementById("box-shift-gm")?.classList.remove("hidden");
  }
}

export async function saveAssignedShift(e) {
  if (e) e.preventDefault();

  const userId = document.getElementById("hr-select-user")?.value;
  const role = document.getElementById("hr-select-user-role")?.value || "staff";

  if (!userId) return notify("Perhatian", "Pilih karyawan terlebih dahulu.");

  let payload = {
    updated_at: serverTimestamp()
  };

  if (role === 'staff') {
    const liburCount = Object.values(activeStaffRoster).filter(s => s === 'libur').length;
    if (liburCount === 0) {
      return notify("Jadwal Tidak Sah", "Staff Outlet wajib memiliki minimal 1 hari LIBUR dalam seminggu.");
    }

    payload.shift = "roster";
    payload.work_mode = "wfo";
    payload.weekly_schedule = activeStaffRoster;
  } 
  else if (role === 'admin') {
    const shift = document.getElementById("admin-chosen-shift")?.value || "pagi";
    const wfaStart = document.getElementById("admin-wfa-start")?.value || null;
    const wfaEnd = document.getElementById("admin-wfa-end")?.value || null;

    payload.shift = shift;
    payload.work_mode = (wfaStart && wfaEnd) ? "wfa_scheduled" : "wfo";
    payload.wfa_start_date = wfaStart;
    payload.wfa_end_date = wfaEnd;
  } 
  else if (role === 'logistik') {
    const shift = document.getElementById("logistik-chosen-shift")?.value || "pagi";
    payload.shift = shift;
    payload.work_mode = "wfo";
  } 
  else if (role === 'it') {
    payload.shift = "it_flex";
    payload.work_mode = "hybrid";
  } 
  else if (role === 'gm') {
    payload.shift = "pagi";
    payload.work_mode = "flexible";
  }

  showLoading("Menyimpan konfigurasi shift...");
  try {
    await setDoc(doc(db, "users", userId), payload, { merge: true });

    const cachedUser = state.allEmployeesCache.find(u => u.id === userId);
    if (cachedUser) {
      Object.assign(cachedUser, payload);
    }

    hideLoading();
    notify("Berhasil", "Jadwal shift & mode kerja karyawan berhasil diperbarui.");
  } catch (err) {
    hideLoading();
    notify("Gagal Simpan", err.message);
  }
}

export async function loadHRUserOptions() {
  try {
    const snap = await getDocs(collection(db, "users"));
    state.allEmployeesCache = [];
    snap.forEach(d => {
      state.allEmployeesCache.push({ id: d.id, ...d.data() });
    });
    if (window.populateReportUserDropdown) {
      window.populateReportUserDropdown();
    }
  } catch (e) {
    console.warn("Gagal memuat list users HR:", e);
  }
}

// ==========================================
// 2. JENJANG KARIR & PROMOSI
// ==========================================
export async function loadCareerPathList() {
  const container = document.getElementById("career-path-list-container");
  if (!container) return;

  showLoading("Memuat data jenjang karir...");
  try {
    if (!state.allEmployeesCache || state.allEmployeesCache.length === 0) {
      await loadHRUserOptions();
    }

    hideLoading();
    renderCareerPathList(state.allEmployeesCache);
  } catch (e) {
    hideLoading();
    container.innerHTML = `<p class="placeholder-text text-danger">Gagal: ${e.message}</p>`;
  }
}

export function renderCareerPathList(list) {
  const container = document.getElementById("career-path-list-container");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = "<p class='placeholder-text'>Belum ada data karyawan.</p>";
    return;
  }

  container.innerHTML = list.map(item => {
    const rawRole = String(item.role || 'staff').toLowerCase();
    const displayRole = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();
    const careerLevel = item.career_level || "Junior";
    const customAllowance = item.custom_allowance ? `Rp ${Number(item.custom_allowance).toLocaleString('id-ID')}` : "Default Role";

    return `
      <div class="picker-user-row clean-tap-row" onclick="openCareerPromotionForm('${item.id}', '${(item.nama || item.email).replace(/'/g, "\\'")}', '${careerLevel}', ${item.custom_allowance || 0})">
        <div class="picker-user-meta">
          <strong>${item.nama || item.email} [${displayRole}]</strong>
          <small>Level: <b style="color:var(--text-accent);">${careerLevel}</b> · Tunjangan: ${customAllowance}</small>
        </div>
      </div>
    `;
  }).join("");
}

export function filterCareerPathList() {
  const q = document.getElementById("search-career-user")?.value.toLowerCase().trim() || "";
  const filtered = state.allEmployeesCache.filter(u => {
    const n = (u.nama || "").toLowerCase();
    const e = (u.email || "").toLowerCase();
    const r = (u.role || "").toLowerCase();
    return n.includes(q) || e.includes(q) || r.includes(q);
  });
  renderCareerPathList(filtered);
}

export function openCareerPromotionForm(userId, userName, currentLevel, currentAllowance) {
  const box = document.getElementById("box-career-promotion-form");
  const label = document.getElementById("career-target-user-label");
  const uidInput = document.getElementById("career-target-uid");
  const selectLevel = document.getElementById("career-select-level");
  const allowanceInput = document.getElementById("career-custom-allowance");

  if (label) label.innerText = `Promosikan: ${userName}`;
  if (uidInput) uidInput.value = userId;
  if (selectLevel) selectLevel.value = currentLevel || "Junior";
  if (allowanceInput) allowanceInput.value = currentAllowance || 0;

  if (box) {
    box.classList.remove("hidden");
    box.scrollIntoView({ behavior: 'smooth' });
  }
}

export function onCareerLevelPresetChange() {
  const level = document.getElementById("career-select-level")?.value;
  const allowanceInput = document.getElementById("career-custom-allowance");
  if (!allowanceInput) return;

  const presets = {
    Junior: 0,
    Middle: 150000,
    Senior: 350000,
    Lead: 750000
  };

  allowanceInput.value = presets[level] !== undefined ? presets[level] : 0;
}

export async function saveCareerPromotion(userId, newLevel, customAllowance) {
  if (!userId) return notify("Perhatian", "Pilih karyawan terlebih dahulu.");

  showLoading("Menerapkan promosi jenjang karir...");
  try {
    await setDoc(doc(db, "users", userId), {
      career_level: newLevel,
      custom_allowance: Number(customAllowance || 0),
      updated_at: serverTimestamp()
    }, { merge: true });

    hideLoading();
    document.getElementById("box-career-promotion-form")?.classList.add("hidden");
    notify("Sukses", `Promosi berhasil. Karyawan kini berada di level ${newLevel}.`);
    await loadCareerPathList();
  } catch (e) {
    hideLoading();
    notify("Gagal", e.message);
  }
}

// ==========================================
// 3. STRUKTUR GAJI & REKENING RESMI
// ==========================================
export async function saveSalaryStructure(userId, baseSalary, mealAllowanceDaily, bankName, bankNumber, bankHolder) {
  if (!userId) return notify("Perhatian", "Pilih karyawan terlebih dahulu.");

  showLoading("Menyimpan struktur gaji...");
  try {
    await setDoc(doc(db, "salary_structures", userId), {
      uid: userId,
      base_salary: Number(baseSalary || 0),
      meal_allowance_daily: Number(mealAllowanceDaily || 0),
      bank_name: bankName || "BCA",
      bank_number: String(bankNumber || "").trim(),
      bank_holder: String(bankHolder || "").trim(),
      updated_at: serverTimestamp()
    }, { merge: true });

    hideLoading();
    notify("Berhasil", "Struktur gaji dan data rekening resmi berhasil disimpan.");
  } catch (e) {
    hideLoading();
    notify("Gagal", e.message);
  }
}

// ==========================================
// 4. EMPLOYEE PICKER SUB-PAGE HANDLER
// ==========================================
export function navigateToEmployeePickerPage(context) {
  state.activePickerContext = context;

  const titleEl = document.getElementById("picker-page-title");
  const subEl = document.getElementById("picker-page-subtitle");
  const badgeEl = document.getElementById("picker-page-badge");
  const searchInput = document.getElementById("picker-search-input");

  if (searchInput) searchInput.value = "";

  if (context === 'attendance') {
    if (titleEl) titleEl.innerText = "Pilih Target Karyawan";
    if (subEl) subEl.innerText = "Pilih staf yang ingin dilihat absensinya";
    if (badgeEl) badgeEl.innerText = "LAPORAN";
  } else if (context === 'manual_attendance') {
    if (titleEl) titleEl.innerText = "Pilih Karyawan Absensi";
    if (subEl) subEl.innerText = "Pilih staf untuk input entri absensi manual GM";
    if (badgeEl) badgeEl.innerText = "ENTRI GM";
  } else if (context === 'shift') {
    if (titleEl) titleEl.innerText = "Pilih Karyawan Shift";
    if (subEl) subEl.innerText = "Tentukan jadwal shift dan mode kerja staf";
    if (badgeEl) badgeEl.innerText = "JADWAL";
  } else if (context === 'salary') {
    if (titleEl) titleEl.innerText = "Pilih Karyawan Payroll";
    if (subEl) subEl.innerText = "Atur struktur gaji dan data rekening bank";
    if (badgeEl) badgeEl.innerText = "GAJI";
  } else if (context === 'task') {
    if (titleEl) titleEl.innerText = "Pilih Karyawan Penugasan";
    if (subEl) subEl.innerText = "Delegasikan tugas operasional khusus";
    if (badgeEl) badgeEl.innerText = "TUGAS";
  }

  renderEmployeePickerItems(state.allEmployeesCache);
  navigateToTab('employee-picker-page');
}

export function renderEmployeePickerItems(list) {
  const listEl = document.getElementById("employee-picker-page-list");
  if (!listEl) return;

  listEl.innerHTML = "";

  if (state.activePickerContext === 'attendance') {
    const allDiv = document.createElement("div");
    allDiv.className = "picker-user-row clean-tap-row";
    allDiv.innerHTML = `
      <div class="picker-user-meta">
        <strong>Semua Karyawan (Seluruh Tim)</strong>
        <small>Tampilkan rekapitulasi seluruh divisi & outlet</small>
      </div>
    `;
    allDiv.onclick = () => selectEmployeeFromPicker('all', 'Semua Karyawan (Seluruh Tim)');
    listEl.appendChild(allDiv);
  }

  if (!list || list.length === 0) {
    const emptyDiv = document.createElement("p");
    emptyDiv.className = "placeholder-text";
    emptyDiv.innerText = "Tidak ada data karyawan yang cocok.";
    listEl.appendChild(emptyDiv);
    return;
  }

  list.forEach(u => {
    const rawRole = String(u.role || 'staff').toLowerCase();
    const roleLabel = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();
    const div = document.createElement("div");
    div.className = "picker-user-row clean-tap-row";
    div.innerHTML = `
      <div class="picker-user-meta">
        <strong>${u.nama || u.email}</strong>
        <small>${u.email || '-'} · ${roleLabel}</small>
      </div>
    `;
    div.onclick = () => selectEmployeeFromPicker(u.id, u.nama || u.email, u);
    listEl.appendChild(div);
  });
}

export function filterEmployeePickerPageList() {
  const q = document.getElementById("picker-search-input")?.value.toLowerCase().trim() || "";
  const filtered = state.allEmployeesCache.filter(u => {
    const matchName = u.nama && u.nama.toLowerCase().includes(q);
    const matchEmail = u.email && u.email.toLowerCase().includes(q);
    const matchRole = u.role && u.role.toLowerCase().includes(q);
    return matchName || matchEmail || matchRole;
  });

  renderEmployeePickerItems(filtered);
}

export function selectEmployeeFromPicker(userId, userName, userObj) {
  if (state.activePickerContext === 'attendance') {
    const hidden = document.getElementById("report-select-user");
    const label = document.getElementById("label-report-selected-user");
    if (hidden) hidden.value = userId;
    if (label) label.innerText = userName;

    navigateToTab('hr');
    openHRSubPage('hr-attendance');

    if (window.generateAdminAttendanceReport) {
      window.generateAdminAttendanceReport();
    }
  } else if (state.activePickerContext === 'manual_attendance') {
    const hidden = document.getElementById("manual-att-user");
    const label = document.getElementById("label-picker-manual-att-user");
    if (hidden) hidden.value = userId;
    if (label) label.innerText = userName;

    navigateToTab('hr');
    openHRSubPage('hr-manual-attendance');
  } else if (state.activePickerContext === 'shift') {
    const hidden = document.getElementById("hr-select-user");
    const label = document.getElementById("label-picker-shift-user");
    if (hidden) hidden.value = userId;
    if (label) label.innerText = userName;

    navigateToTab('hr');
    openHRSubPage('hr-shift');

    const targetUser = userObj || state.allEmployeesCache.find(u => u.id === userId) || { role: 'staff' };
    showRoleSpecificShiftUI(targetUser);
  } else if (state.activePickerContext === 'salary') {
    const hidden = document.getElementById("salary-select-user");
    const label = document.getElementById("label-picker-salary-user");
    if (hidden) hidden.value = userId;
    if (label) label.innerText = userName;

    getDoc(doc(db, "salary_structures", userId)).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        document.getElementById("sal-base").value = d.base_salary || "";
        document.getElementById("sal-meal-daily").value = d.meal_allowance_daily || 15000;
        document.getElementById("sal-bank-name").value = d.bank_name || "BCA";
        document.getElementById("sal-bank-number").value = d.bank_number || "";
        document.getElementById("sal-bank-holder").value = d.bank_holder || "";
      }
    });

    navigateToTab('hr');
    openHRSubPage('hr-salary-structure');
  } else if (state.activePickerContext === 'task') {
    const hidden = document.getElementById("task-select-user");
    const label = document.getElementById("label-picker-task-user");
    if (hidden) hidden.value = userId;
    if (label) label.innerText = userName;
    navigateToTab('hr');
    openHRSubPage('hr-tasks-assign');
  }
}

// ==========================================
// 5. TERBITKAN & KUNCI SLIP GAJI MASSAL
// ==========================================
export async function lockAndPublishMonthlySlips() {
  const monthPicker = document.getElementById("publish-month-picker");
  const targetPeriod = monthPicker?.value || new Date().toISOString().slice(0, 7);

  showLoading(`Menerbitkan & mengunci slip gaji periode ${targetPeriod}...`);
  try {
    if (!state.allEmployeesCache || state.allEmployeesCache.length === 0) {
      await loadHRUserOptions();
    }

    const publishPromises = state.allEmployeesCache.map(async (u) => {
      const salSnap = await getDoc(doc(db, "salary_structures", u.id));
      const salData = salSnap.exists() ? salSnap.data() : { base_salary: 2000000, meal_allowance_daily: 15000 };

      const attSnap = await getDocs(query(
        collection(db, "attendance"),
        where("date", ">=", `${targetPeriod}-01`),
        where("date", "<=", `${targetPeriod}-31`)
      ));

      let hadirCount = 0;
      attSnap.forEach(d => {
        const att = d.data();
        if (att.uid === u.id && att.status === "Hadir") hadirCount++;
      });

      const allowance = Number(u.custom_allowance || 0);
      const mealTotal = hadirCount * Number(salData.meal_allowance_daily || 15000);
      const totalEarnings = Number(salData.base_salary || 0) + allowance + mealTotal;
      const thp = totalEarnings;

      const slipUniqueId = `${u.id}_${targetPeriod}`;
      return setDoc(doc(db, "salary_slips_archive", slipUniqueId), {
        uid: u.id,
        nama: u.nama || u.email,
        role: u.role || "staff",
        period: targetPeriod,
        base_salary: salData.base_salary || 0,
        position_allowance: allowance,
        meal_allowance: mealTotal,
        total_earnings: totalEarnings,
        total_deductions: 0,
        thp: thp,
        bank_name: salData.bank_name || "BCA",
        bank_number: salData.bank_number || "-",
        bank_holder: salData.bank_holder || (u.nama || u.email),
        published_at: serverTimestamp()
      }, { merge: true });
    });

    await Promise.all(publishPromises);
    hideLoading();
    notify("Sukses", `Slip gaji seluruh staf untuk periode ${targetPeriod} berhasil diterbitkan dan dikunci.`);
  } catch (e) {
    hideLoading();
    notify("Gagal Terbit", e.message);
  }
}

// ==========================================
// 6. PENUGASAN TUGAS KHUSUS STAF
// ==========================================
export async function assignCustomTask(userId, instruction, targetDate) {
  if (!userId) return notify("Perhatian", "Pilih karyawan terlebih dahulu.");
  if (!instruction) return notify("Perhatian", "Tuliskan instruksi tugas.");
  if (!targetDate) return notify("Perhatian", "Tentukan tanggal berlaku tugas.");

  showLoading("Mengirimkan tugas khusus...");
  try {
    const taskId = `task_${userId}_${Date.now()}`;
    await setDoc(doc(db, "staff_tasks", taskId), {
      uid: userId,
      instruction: instruction,
      target_date: targetDate,
      completed: false,
      created_at: serverTimestamp()
    });

    hideLoading();
    notify("Sukses", "Tugas khusus berhasil dikirimkan ke akun karyawan.");
    document.getElementById("task-instruction-input").value = "";
  } catch (e) {
    hideLoading();
    notify("Gagal", e.message);
  }
}

// ==========================================
// 7. PARAMETER ROLE TOKO (KUSTOMISASI GM)
// ==========================================
export function openRoleParameterPage(roleKey, roleTitle, pushState = true) {
  if (pushState) {
    history.pushState({ tab: 'hr', subpage: 'hr-role-param-form', role: roleKey }, "");
  }

  document.querySelectorAll('.hr-feature-page').forEach(el => el.classList.add('hidden'));
  const formPage = document.getElementById('subtab-hr-role-param-form');
  if (formPage) formPage.classList.remove('hidden');

  const titleEl = document.getElementById('role-param-title');
  const badgeEl = document.getElementById('role-param-badge');
  const hiddenInput = document.getElementById('target-role-param-id');

  if (titleEl) titleEl.innerText = `Parameter: ${roleTitle}`;
  if (badgeEl) badgeEl.innerText = roleKey.toUpperCase();
  if (hiddenInput) hiddenInput.value = roleKey;

  const cfg = state.roleParamsCache[roleKey] || DEFAULT_ROLE_PARAMS[roleKey] || DEFAULT_ROLE_PARAMS.staff;
  document.getElementById("cfg-role-pagi-start").value = cfg.pagi_start || "07:30";
  document.getElementById("cfg-role-pagi-end").value = cfg.pagi_end || "15:30";
  document.getElementById("cfg-role-malam-start").value = cfg.malam_start || "13:30";
  document.getElementById("cfg-role-malam-end").value = cfg.malam_end || "21:00";
  document.getElementById("cfg-role-it-threshold").value = cfg.it_threshold || "10:00";
  document.getElementById("cfg-role-tolerance").value = cfg.tolerance || 15;
  document.getElementById("cfg-role-overtime-rate").value = cfg.overtime_rate || 25000;
  document.getElementById("cfg-role-late-penalty").value = cfg.late_penalty || 10000;
  document.getElementById("cfg-role-radius-meter").value = cfg.radius_meter || 100;
}

export async function saveRoleParameters(roleKey, payload) {
  showLoading(`Menyimpan parameter role ${roleKey.toUpperCase()}...`);
  try {
    await setDoc(doc(db, "app_settings", "parameters_roles"), {
      [roleKey]: payload
    }, { merge: true });

    state.roleParamsCache[roleKey] = payload;

    hideLoading();
    notify("Berhasil", `Parameter untuk role ${roleKey.toUpperCase()} berhasil disimpan.`);
    openHRSubPage('hr-params-menu');
  } catch (e) {
    hideLoading();
    notify("Gagal", e.message);
  }
}
