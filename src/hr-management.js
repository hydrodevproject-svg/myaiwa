/* ==========================================================================
   MYAIWA - HR MANAGEMENT, CAREER PATH, ROLES & DELEGATION (LENGKAP)
   ========================================================================== */

import { db } from "../firebase-config.js";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc, 
  serverTimestamp, 
  query, 
  where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { 
  ROLE_DISPLAY_NAMES, 
  DEFAULT_ROLE_PARAMS, 
  state 
} from "./constants.js";

import { 
  showLoading, 
  hideLoading, 
  notify, 
  navigateToTab, 
  openHRSubPage,
  getLocalDateWITA 
} from "./utils.js";

// ==========================================
// 1. SELEKSI SHIFT & WORK MODE
// ==========================================
export function selectRoleShiftCard(shiftKey, roleKey) {
  document.querySelectorAll('.shift-select-card').forEach(el => el.classList.remove('active-shift'));
  const targetCard = document.getElementById(`shift-card-${roleKey}_${shiftKey}`) || document.getElementById(`shift-card-${shiftKey}`);
  if (targetCard) targetCard.classList.add('active-shift');

  const shiftInput = document.getElementById("hr-select-shift");
  const roleInput = document.getElementById("hr-select-shift-role");
  if (shiftInput) shiftInput.value = shiftKey;
  if (roleInput) roleInput.value = roleKey;
}

export function selectWorkModePill(modeKey) {
  document.getElementById("mode-btn-wfo")?.classList.toggle("active-shift", modeKey === "wfo");
  document.getElementById("mode-btn-wfa")?.classList.toggle("active-shift", modeKey === "wfa");

  const modeInput = document.getElementById("hr-select-work-mode");
  if (modeInput) modeInput.value = modeKey;
}

export async function saveAssignedShift(userId, shift, workMode) {
  if (!userId) return notify("Perhatian", "Pilih karyawan terlebih dahulu.");

  showLoading("Menyimpan konfigurasi shift & mode...");
  try {
    await setDoc(doc(db, "users", userId), {
      shift: shift,
      work_mode: workMode,
      updated_at: serverTimestamp()
    }, { merge: true });

    hideLoading();
    notify("Berhasil", "Shift dan mode kerja karyawan berhasil diperbarui.");
  } catch (e) {
    hideLoading();
    notify("Gagal", e.message);
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
      <div class="picker-user-row" onclick="openCareerPromotionForm('${item.id}', '${(item.nama || item.email).replace(/'/g, "\\'")}', '${careerLevel}', ${item.custom_allowance || 0})">
        <div class="picker-user-meta">
          <strong>${item.nama || item.email} [${displayRole}]</strong>
          <small>Level: <b style="color:var(--text-accent);">${careerLevel}</b> · Tunjangan: ${customAllowance}</small>
        </div>
        <span class="badge-status-work">Promosi ➔</span>
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
  const listEl = document.getElementById("employee-picker-page-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  state.allEmployeesCache.forEach(u => {
    const rawRole = String(u.role || 'staff').toLowerCase();
    const roleLabel = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();
    const div = document.createElement("div");
    div.className = "picker-user-row";
    div.innerHTML = `
      <div class="picker-user-meta">
        <strong>${u.nama || u.email}</strong>
        <small>${u.email} · ${roleLabel}</small>
      </div>
      <span class="badge-status-work">Pilih ➔</span>
    `;
    div.onclick = () => selectEmployeeFromPicker(u.id, u.nama || u.email);
    listEl.appendChild(div);
  });

  navigateToTab('employee-picker-page');
}

export function filterEmployeePickerPageList() {
  const q = document.getElementById("picker-search-input")?.value.toLowerCase().trim() || "";
  const listEl = document.getElementById("employee-picker-page-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  const filtered = state.allEmployeesCache.filter(u => {
    return (u.nama && u.nama.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q));
  });

  filtered.forEach(u => {
    const rawRole = String(u.role || 'staff').toLowerCase();
    const roleLabel = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();
    const div = document.createElement("div");
    div.className = "picker-user-row";
    div.innerHTML = `
      <div class="picker-user-meta">
        <strong>${u.nama || u.email}</strong>
        <small>${u.email} · ${roleLabel}</small>
      </div>
      <span class="badge-status-work">Pilih ➔</span>
    `;
    div.onclick = () => selectEmployeeFromPicker(u.id, u.nama || u.email);
    listEl.appendChild(div);
  });
}

export function selectEmployeeFromPicker(userId, userName) {
  if (state.activePickerContext === 'shift') {
    const hidden = document.getElementById("hr-select-user");
    const label = document.getElementById("label-picker-shift-user");
    if (hidden) hidden.value = userId;
    if (label) label.innerText = userName;
    navigateToTab('hr');
    openHRSubPage('hr-shift');
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
// 5. EVALUASI KPI & LEADERBOARD GM
// ==========================================
export async function renderGMLeaderboardReport() {
  const container = document.getElementById("gm-leaderboard-container");
  const monthPicker = document.getElementById("filter-kpi-leaderboard-month");
  const roleFilter = document.getElementById("filter-kpi-leaderboard-role");
  if (!container) return;

  const targetMonth = monthPicker?.value || getLocalDateWITA().slice(0, 7);
  const targetRole = roleFilter?.value || "all";

  showLoading("Menghitung peringkat performa tim...");
  try {
    if (!state.allEmployeesCache || state.allEmployeesCache.length === 0) {
      await loadHRUserOptions();
    }

    const reportPromises = state.allEmployeesCache.map(async (u) => {
      const qAtt = query(
        collection(db, "attendance"),
        where("uid", "==", u.id),
        where("date", ">=", `${targetMonth}-01`),
        where("date", "<=", `${targetMonth}-31`)
      );
      const snapAtt = await getDocs(qAtt);
      let attendanceDays = 0;
      snapAtt.forEach(d => {
        if (d.data().status === "Hadir") attendanceDays++;
      });

      const presenceScore = Math.min(100, Math.round((attendanceDays / 26) * 100));
      const totalScore = presenceScore;

      return {
        id: u.id,
        nama: u.nama || u.email,
        role: String(u.role || 'staff').toLowerCase(),
        attendanceDays,
        presenceScore,
        totalScore
      };
    });

    const results = await Promise.all(reportPromises);
    state.leaderboardCache = results;

    hideLoading();
    filterLeaderboardReport();
  } catch (e) {
    hideLoading();
    container.innerHTML = `<p class="placeholder-text text-danger">Gagal: ${e.message}</p>`;
  }
}

export function filterLeaderboardReport() {
  const container = document.getElementById("gm-leaderboard-container");
  const q = document.getElementById("search-leaderboard-user")?.value.toLowerCase().trim() || "";
  const roleFilter = document.getElementById("filter-kpi-leaderboard-role")?.value || "all";
  if (!container) return;

  let filtered = (state.leaderboardCache || []).filter(u => {
    const matchQuery = !q || u.nama.toLowerCase().includes(q);
    const matchRole = (roleFilter === "all") || (u.role === roleFilter);
    return matchQuery && matchRole;
  });

  filtered.sort((a, b) => b.totalScore - a.totalScore);

  const countBadge = document.getElementById("kpi-ranking-count-badge");
  if (countBadge) countBadge.innerText = `${filtered.length} Karyawan`;

  if (filtered.length === 0) {
    container.innerHTML = "<p class='placeholder-text'>Tidak ada data performa ditemukan.</p>";
    return;
  }

  container.innerHTML = filtered.map((u, idx) => {
    let rankColor = "#64748b";
    if (idx === 0) rankColor = "#f59e0b";
    else if (idx === 1) rankColor = "#94a3b8";
    else if (idx === 2) rankColor = "#b45309";

    const displayRole = (ROLE_DISPLAY_NAMES[u.role] || u.role).toUpperCase();

    return `
      <div class="picker-user-row" style="cursor:default;">
        <div style="font-size:1.1rem; font-weight:900; color:${rankColor}; width:28px;">#${idx + 1}</div>
        <div class="picker-user-meta" style="flex:1;">
          <strong>${u.nama} [${displayRole}]</strong>
          <small>Hadir: ${u.attendanceDays} Hari · Skor: ${u.totalScore}%</small>
        </div>
        <span class="badge-status-work" style="color:${u.totalScore >= 85 ? '#10b981' : (u.totalScore >= 70 ? '#f59e0b' : '#ef4444')};">
          ${u.totalScore >= 85 ? 'Memuaskan' : (u.totalScore >= 70 ? 'Cukup' : 'Kurang')}
        </span>
      </div>
    `;
  }).join("");
}

// ==========================================
// 6. TERBITKAN & KUNCI SLIP GAJI MASSAL
// ==========================================
export async function lockAndPublishMonthlySlips() {
  const monthPicker = document.getElementById("publish-month-picker");
  const targetPeriod = monthPicker?.value || getLocalDateWITA().slice(0, 7);

  showLoading(`Menerbitkan & mengunci slip gaji periode ${targetPeriod}...`);
  try {
    if (!state.allEmployeesCache || state.allEmployeesCache.length === 0) {
      await loadHRUserOptions();
    }

    const publishPromises = state.allEmployeesCache.map(async (u) => {
      const salSnap = await getDoc(doc(db, "salary_structures", u.id));
      const salData = salSnap.exists() ? salSnap.data() : { base_salary: 2000000, meal_allowance_daily: 15000 };

      const qAtt = query(
        collection(db, "attendance"),
        where("uid", "==", u.id),
        where("date", ">=", `${targetPeriod}-01`),
        where("date", "<=", `${targetPeriod}-31`)
      );
      const snapAtt = await getDocs(qAtt);
      let hadirCount = 0;
      snapAtt.forEach(d => {
        if (d.data().status === "Hadir") hadirCount++;
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
// 7. PENUGASAN TUGAS KHUSUS STAF
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
// 8. PARAMETER ROLE TOKO (GAMBAR 1 & 2)
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
    await setDoc(doc(db, "role_configurations", roleKey), {
      ...payload,
      updated_at: serverTimestamp()
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
