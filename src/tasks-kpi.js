/* ==========================================================================
   MYAIWA - DAILY TASKS, ACCURATE KPI ENGINE & GM LEADERBOARD (MULTI-LEVEL)
   MYAIWA - AIWA RAGIN JAJE SYSTEM
   ========================================================================== */

import { auth, db } from "../firebase-config.js";
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
  state, 
  ROLE_DEFAULT_SOP, 
  ROLE_DISPLAY_NAMES, 
  DEFAULT_ROLE_PARAMS,
  CAREER_ALLOWANCE_PRESETS
} from "./constants.js";

import { 
  showLoading, 
  hideLoading, 
  notify, 
  showCustomConfirm, 
  calculateLateThresholdTime,
  navigateToTab,
  getLocalDateWITA 
} from "./utils.js";

// ==========================================
// 1. CHECKLIST TUGAS HARIAN & SOP TOKO
// ==========================================
export async function loadDailyTaskChecklist() {
  const user = auth.currentUser;
  const container = document.getElementById("daily-task-container");
  const progressBadge = document.getElementById("task-progress-badge");
  const btnSubmit = document.getElementById("btn-submit-daily-tasks");
  if (!user || !container) return;

  const todayStr = getLocalDateWITA();
  const userRole = String(state.currentUserData?.role || 'staff').toLowerCase();
  const defaultTasks = ROLE_DEFAULT_SOP[userRole] || ROLE_DEFAULT_SOP.staff;

  try {
    const logDocSnap = await getDoc(doc(db, "daily_task_logs", `${user.uid}_${todayStr}`));
    const logData = logDocSnap.exists() ? logDocSnap.data() : { completed_tasks: [], is_submitted: false };
    const completedIndices = logData.completed_tasks || [];
    const isSubmitted = logData.is_submitted === true;

    if (btnSubmit) {
      if (isSubmitted) {
        btnSubmit.disabled = true;
        btnSubmit.style.background = "#10b981";
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
      progressBadge.style.background = doneCount === totalCount ? "rgba(16, 185, 129, 0.15)" : "rgba(26, 75, 139, 0.12)";
      progressBadge.style.color = doneCount === totalCount ? "#10b981" : "var(--text-accent)";
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
    container.innerHTML = "<p class='placeholder-text'>Gagal memuat tugas harian.</p>";
  }
}

// ==========================================
// 2. TOGGLE STATUS & SUBMIT KUNCI TUGAS
// ==========================================
export async function toggleDailyTaskStatus(taskId, isCustom, newStatus) {
  const user = auth.currentUser;
  if (!user) return;

  const todayStr = getLocalDateWITA();

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
}

export async function submitDailyTasksFinal() {
  const user = auth.currentUser;
  if (!user) return;

  const todayStr = getLocalDateWITA();
  const timeStr = new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar" });

  const confirmSubmit = await showCustomConfirm(
    "Kunci & Submit Tugas",
    "Apakah Anda yakin ingin mengunci laporan tugas hari ini? Tugas yang sudah di-submit tidak dapat diubah kembali."
  );
  if (!confirmSubmit) return;

  showLoading();

  try {
    const logRef = doc(db, "daily_task_logs", `${user.uid}_${todayStr}`);
    await setDoc(logRef, {
      is_submitted: true,
      submitted_at_time: timeStr,
      submitted_at: serverTimestamp()
    }, { merge: true });

    hideLoading();
    notify("Berhasil", `Laporan tugas harian berhasil dikunci pada pukul ${timeStr} WITA.`);
    await loadDailyTaskChecklist();
    await calculateUserKPI(user.uid);
  } catch (err) {
    hideLoading();
    notify("Gagal Submit", err.message);
  }
}

// ==========================================
// 3. ENGINE KALKULASI KPI AKUMULATIF USER (BEBAS COMPOSITE INDEX)
// ==========================================
export async function calculateUserKPI(uid) {
  try {
    const currentMonthStr = getLocalDateWITA().slice(0, 7);
    const userRoleKey = String(state.currentUserData?.role || 'staff').toLowerCase();
    const isITAccount = (userRoleKey === "it");
    const roleCfg = state.roleParamsCache[userRoleKey] || DEFAULT_ROLE_PARAMS[userRoleKey] || DEFAULT_ROLE_PARAMS.staff;

    const [attSnap, taskLogsSnap, customTasksSnap] = await Promise.all([
      getDocs(query(
        collection(db, "attendance"),
        where("uid", "==", uid)
      )),
      getDocs(query(
        collection(db, "daily_task_logs"),
        where("uid", "==", uid)
      )),
      getDocs(query(
        collection(db, "staff_tasks"),
        where("uid", "==", uid)
      ))
    ]);

    let totalPresence = 0;
    let effectivePresenceDays = 0;
    let wfoCount = 0;
    let wfaCount = 0;
    let lateCount = 0;

    const toleranceMinutes = Number(roleCfg.tolerance ?? 15);

    attSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.date && data.date.startsWith(currentMonthStr) && data.status === "Hadir") {
        totalPresence++;

        if (data.early_leave_type === "Izin") {
          effectivePresenceDays += 0.75;
        } else {
          effectivePresenceDays += 1.0;
        }

        const mode = (data.mode || "").toLowerCase();
        if (mode === "wfo") {
          wfoCount++;
        } else {
          wfaCount++;
        }

        const itemShift = data.shift || "pagi";
        let baseStart = roleCfg.pagi_start || "07:30";
        if (itemShift === "malam") baseStart = roleCfg.malam_start || "13:30";
        if (itemShift === "it_flex") baseStart = roleCfg.it_threshold || "10:00";

        const lateThresholdTime = calculateLateThresholdTime(baseStart, toleranceMinutes);

        if (data.check_in_time && data.check_in_time > lateThresholdTime) {
          lateCount++;
        }
      }
    });

    state.currentMonthITWfaCount = wfaCount;

    const targetWorkingDays = 26;
    const targetWFO = Math.ceil(targetWorkingDays * 0.6);
    const targetWFA = targetWorkingDays - targetWFO;

    let attendanceScore = 0;
    if (isITAccount) {
      const effectiveWFO = Math.min(targetWFO, wfoCount);
      const effectiveWFA = Math.min(targetWFA, wfaCount);
      attendanceScore = Math.min(100, Math.round(((effectiveWFO / targetWFO) * 60) + ((effectiveWFA / targetWFA) * 40)));
    } else {
      attendanceScore = Math.min(100, Math.round((effectivePresenceDays / targetWorkingDays) * 100));
    }
    attendanceScore = Math.max(0, attendanceScore - (lateCount * 2));

    const defaultTasks = ROLE_DEFAULT_SOP[userRoleKey] || ROLE_DEFAULT_SOP.staff;
    const dailySOPCount = defaultTasks.length;
    const totalPossibleSOPMonth = totalPresence * dailySOPCount;
    let totalCompletedSOPMonth = 0;

    taskLogsSnap.forEach(d => {
      const log = d.data();
      if (log.date && log.date.startsWith(currentMonthStr)) {
        const doneList = log.completed_tasks || [];
        totalCompletedSOPMonth += doneList.length;
      }
    });

    let totalPossibleCustomMonth = 0;
    let totalCompletedCustomMonth = 0;

    customTasksSnap.forEach(d => {
      const t = d.data();
      if (t.target_date && t.target_date.startsWith(currentMonthStr)) {
        totalPossibleCustomMonth += 1;
        if (t.completed === true) {
          totalCompletedCustomMonth += 1;
        }
      }
    });

    const totalPossibleTasks = totalPossibleSOPMonth + totalPossibleCustomMonth;
    const totalCompletedTasks = totalCompletedSOPMonth + totalCompletedCustomMonth;

    let taskMonthlyScore = 0;
    if (totalPossibleTasks > 0) {
      taskMonthlyScore = Math.min(100, Math.round((totalCompletedTasks / totalPossibleTasks) * 100));
    }

    state.currentUserTaskScore = taskMonthlyScore;

    let finalScore = Math.min(100, Math.round((attendanceScore * 0.7) + (taskMonthlyScore * 0.3)));

    const itBreakdownEl = document.getElementById("it-kpi-breakdown");
    if (isITAccount) {
      if (itBreakdownEl) itBreakdownEl.classList.remove("hidden");
      const wfoPct = totalPresence > 0 ? Math.round((wfoCount / totalPresence) * 100) : 0;
      const wfaPct = totalPresence > 0 ? Math.round((wfaCount / totalPresence) * 100) : 0;

      const itWfoText = document.getElementById("it-wfo-count-text");
      const itWfaText = document.getElementById("it-wfa-count-text");
      const itWfoRemaining = document.getElementById("it-wfo-remaining-target");
      const itWfaRemaining = document.getElementById("it-wfa-remaining-target");

      if (itWfoText) itWfoText.innerText = `WFO: ${wfoCount} Hari (${wfoPct}%)`;
      if (itWfaText) itWfaText.innerText = `WFA: ${wfaCount} Hari (${wfaPct}%)`;

      const remainingWFO = Math.max(0, targetWFO - wfoCount);
      const remainingWFA = Math.max(0, targetWFA - wfaCount);

      if (itWfoRemaining) {
        itWfoRemaining.innerText = remainingWFO === 0 ? "Target WFO Tercapai ✓" : `Sisa Wajib: ${remainingWFO} Hari (Min 60%)`;
      }
      if (itWfaRemaining) {
        itWfaRemaining.innerText = remainingWFA === 0 ? "Kuota WFA Habis (0 Hari)" : `Sisa Kuota: ${remainingWFA} Hari (Maks 40%)`;
        itWfaRemaining.style.color = remainingWFA === 0 ? "#ef4444" : "#10b981";
      }
    } else {
      if (itBreakdownEl) itBreakdownEl.classList.add("hidden");
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
      if (el) el.classList.toggle('active-scale', id === activeMarkerId);
    });

    const finalScoreEl = document.getElementById("final-kpi-score-display");
    const finalGradeEl = document.getElementById("final-kpi-grade-display");
    const careerBadgeEl = document.getElementById("user-career-level-badge");
    const careerTitleEl = document.getElementById("user-career-title");
    const allowanceEl = document.getElementById("user-career-allowance-display");

    const careerLevel = state.currentUserData?.career_level || "Junior";
    const customAllowance = state.currentUserData?.custom_allowance;
    const allowanceVal = customAllowance !== undefined && customAllowance !== null && customAllowance !== ""
      ? Number(customAllowance)
      : (CAREER_ALLOWANCE_PRESETS[careerLevel] || 0);

    if (finalScoreEl) finalScoreEl.innerText = `${finalScore}%`;
    if (finalGradeEl) finalGradeEl.innerText = statusText;
    if (careerBadgeEl) careerBadgeEl.innerText = careerLevel.toUpperCase();
    if (careerTitleEl) careerTitleEl.innerText = `${careerLevel} Staff`;
    if (allowanceEl) allowanceEl.innerText = `Rp ${allowanceVal.toLocaleString('id-ID')} / bulan`;

    getDoc(doc(db, "kpi_crosschecks", `${uid}_${currentMonthStr}`)).then(snap => {
      const crossBox = document.getElementById("kpi-crosscheck-box");
      const crossNote = document.getElementById("kpi-crosscheck-note-display");
      if (snap.exists() && crossBox && crossNote) {
        const data = snap.data();
        crossBox.classList.remove("hidden");
        crossNote.innerText = `[${data.status || 'Diajukan'}]: "${data.note || '-'}"`;
      } else if (crossBox) {
        crossBox.classList.add("hidden");
      }
    }).catch(() => {});

  } catch (e) {
    console.error("Gagal menghitung KPI:", e);
  }
}

// ==========================================
// 4. INISIALISASI & SINKRONISASI TAB LAPORAN KPI
// ==========================================
export async function initKPIReportTab() {
  const user = auth.currentUser;
  if (!user) return;

  const userRole = String(state.currentUserData?.role || 'staff').toLowerCase();
  const isManagement = ['gm', 'it', 'admin'].includes(userRole);

  const managementSection = document.getElementById("management-kpi-section");
  const monthInput = document.getElementById("filter-kpi-leaderboard-month");

  if (monthInput && !monthInput.value) {
    monthInput.value = getLocalDateWITA().slice(0, 7);
  }

  await calculateUserKPI(user.uid);

  if (isManagement) {
    managementSection?.classList.remove("hidden");
    await renderGMLeaderboardReport();
  } else {
    managementSection?.classList.add("hidden");
  }
}

// ==========================================
// 5. GM LEADERBOARD
// ==========================================
export async function renderGMLeaderboardReport() {
  const container = document.getElementById("gm-leaderboard-container");
  const uncompletedContainer = document.getElementById("gm-uncompleted-tasks-container");
  const monthInputEl = document.getElementById("filter-kpi-leaderboard-month");

  const currentMonth = getLocalDateWITA().slice(0, 7);
  if (monthInputEl && !monthInputEl.value) {
    monthInputEl.value = currentMonth;
  }
  const monthInput = monthInputEl?.value || currentMonth;

  if (!container) return;
  container.innerHTML = "<p class='placeholder-text'>Menghitung performa seluruh tim...</p>";

  try {
    if (!state.allEmployeesCache || state.allEmployeesCache.length === 0) {
      const usersSnap = await getDocs(collection(db, "users"));
      state.allEmployeesCache = [];
      usersSnap.forEach(d => state.allEmployeesCache.push({ id: d.id, ...d.data() }));
    }

    const [attSnap, taskLogsSnap, customTasksSnap] = await Promise.all([
      getDocs(query(
        collection(db, "attendance"),
        where("date", ">=", `${monthInput}-01`),
        where("date", "<=", `${monthInput}-31`)
      )),
      getDocs(query(
        collection(db, "daily_task_logs"),
        where("date", ">=", `${monthInput}-01`),
        where("date", "<=", `${monthInput}-31`)
      )),
      getDocs(query(
        collection(db, "staff_tasks"),
        where("target_date", ">=", `${monthInput}-01`),
        where("target_date", "<=", `${monthInput}-31`)
      ))
    ]);

    const attMap = {};
    attSnap.forEach(d => {
      const a = d.data();
      if (!attMap[a.uid]) attMap[a.uid] = [];
      attMap[a.uid].push(a);
    });

    const taskLogMap = {};
    taskLogsSnap.forEach(d => {
      const t = d.data();
      if (!taskLogMap[t.uid]) taskLogMap[t.uid] = [];
      taskLogMap[t.uid].push(t);
    });

    const customTaskMap = {};
    const uncompletedTasksList = [];

    customTasksSnap.forEach(d => {
      const ct = { id: d.id, ...d.data() };
      if (!customTaskMap[ct.uid]) customTaskMap[ct.uid] = [];
      customTaskMap[ct.uid].push(ct);

      if (ct.completed !== true) uncompletedTasksList.push(ct);
    });

    state.leaderboardReportCache = state.allEmployeesCache.map(u => {
      const userAtt = attMap[u.id] || [];
      const userRoleKey = String(u.role || 'staff').toLowerCase();
      const roleCfg = state.roleParamsCache[userRoleKey] || DEFAULT_ROLE_PARAMS[userRoleKey] || DEFAULT_ROLE_PARAMS.staff;
      const isIT = (userRoleKey === "it");
      const toleranceMin = Number(roleCfg.tolerance ?? 15);

      let presentDays = 0;
      let effectivePresenceDays = 0;
      let lateDays = 0;
      let wfoDays = 0;
      let wfaDays = 0;

      userAtt.forEach(a => {
        if (a.status === "Hadir") {
          presentDays++;
          if (a.early_leave_type === "Izin") effectivePresenceDays += 0.75;
          else effectivePresenceDays += 1.0;

          if ((a.mode || "wfo").toLowerCase() === "wfo") wfoDays++;
          else wfaDays++;

          const shift = a.shift || "pagi";
          let baseStart = roleCfg.pagi_start || "07:30";
          if (shift === "malam") baseStart = roleCfg.malam_start || "13:30";
          if (shift === "it_flex") baseStart = roleCfg.it_threshold || "10:00";

          const lateTime = calculateLateThresholdTime(baseStart, toleranceMin);
          if (a.check_in_time && a.check_in_time > lateTime) lateDays++;
        }
      });

      const targetWorkingDays = 26;
      let presenceScore = 0;

      if (isIT) {
        const targetWFO = 16;
        const targetWFA = 10;
        presenceScore = Math.min(100, Math.round(((Math.min(targetWFO, wfoDays) / targetWFO) * 60) + ((Math.min(targetWFA, wfaDays) / targetWFA) * 40)));
      } else {
        presenceScore = Math.min(100, Math.round((effectivePresenceDays / targetWorkingDays) * 100));
      }
      presenceScore = Math.max(0, presenceScore - (lateDays * 2));

      const defaultTasks = ROLE_DEFAULT_SOP[userRoleKey] || ROLE_DEFAULT_SOP.staff;
      const possibleSOP = presentDays * defaultTasks.length;
      
      const dailyLogs = taskLogMap[u.id] || [];
      let doneSOP = 0;
      dailyLogs.forEach(l => doneSOP += (l.completed_tasks || []).length);

      const userCustomTasks = customTaskMap[u.id] || [];
      const possibleCustom = userCustomTasks.length;
      const doneCustom = userCustomTasks.filter(t => t.completed === true).length;

      const totalPossible = possibleSOP + possibleCustom;
      const totalDone = doneSOP + doneCustom;
      const taskScore = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;
      const finalScore = Math.min(100, Math.round((presenceScore * 0.7) + (taskScore * 0.3)));

      return {
        id: u.id,
        nama: u.nama || u.email,
        role: userRoleKey,
        presentDays,
        lateDays,
        taskScore,
        score: finalScore
      };
    });

    state.leaderboardReportCache.sort((a, b) => b.score - a.score);
    filterLeaderboardReport();

    if (uncompletedContainer) {
      if (uncompletedTasksList.length === 0) {
        uncompletedContainer.innerHTML = "<p class='placeholder-text' style='color:#10b981;'>Seluruh tugas khusus & SOP bulan ini selesai.</p>";
      } else {
        uncompletedContainer.innerHTML = uncompletedTasksList.map(t => {
          const emp = state.allEmployeesCache.find(u => u.id === t.uid);
          const empName = emp ? (emp.nama || emp.email) : "Karyawan";
          return `
            <div class="picker-user-row clean-tap-row" style="cursor:default; margin-bottom:6px;">
              <div class="picker-user-meta">
                <strong class="text-danger">${empName}</strong>
                <small>Tugas: "${t.instruction}" · Target: ${t.target_date || '-'}</small>
              </div>
              <span class="badge-status-work badge-kurang" style="flex-shrink:0;">BELUM</span>
            </div>
          `;
        }).join("");
      }
    }

  } catch (err) {
    container.innerHTML = `<p class='placeholder-text text-danger'>Gagal memuat: ${err.message}</p>`;
  }
}

export function filterLeaderboardReport() {
  const container = document.getElementById("gm-leaderboard-container");
  const q = document.getElementById("search-leaderboard-user")?.value.toLowerCase().trim() || "";
  const roleFilter = document.getElementById("filter-kpi-leaderboard-role")?.value || "all";
  if (!container) return;

  let filtered = (state.leaderboardReportCache || []).filter(u => {
    const matchQuery = !q || (u.nama && u.nama.toLowerCase().includes(q)) || (u.role && u.role.toLowerCase().includes(q));
    const matchRole = (roleFilter === "all") || (u.role === roleFilter);
    return matchQuery && matchRole;
  });

  const badgeEl = document.getElementById("kpi-ranking-count-badge");
  if (badgeEl) badgeEl.innerText = `${filtered.length} Karyawan`;

  if (filtered.length === 0) {
    container.innerHTML = "<p class='placeholder-text'>Tidak ada data performa ditemukan.</p>";
    return;
  }

  container.innerHTML = filtered.map((r, i) => {
    const rankNum = i + 1;
    const rankMedalClass = rankNum <= 3 ? `rank-medal-${rankNum}` : 'rank-medal-neutral';
    
    const displayRole = (ROLE_DISPLAY_NAMES[r.role] || r.role).toUpperCase();
    const gradeClass = r.score > 85 ? 'badge-memuaskan' : (r.score >= 70 ? 'badge-cukup' : 'badge-kurang');
    const scoreColorClass = r.score > 85 ? 'score-text-memuaskan' : (r.score >= 70 ? 'score-text-cukup' : 'score-text-kurang');
    const gradeText = r.score > 85 ? 'Memuaskan' : (r.score >= 70 ? 'Cukup' : 'Kurang');

    return `
      <div class="kpi-rank-card">
        <div class="rank-medal-badge ${rankMedalClass}">${rankNum}</div>
        <div class="kpi-rank-info">
          <div class="kpi-rank-header">
            <strong class="kpi-rank-name">${r.nama}</strong>
            <span class="att-role-badge">${displayRole}</span>
          </div>
          <div class="kpi-rank-sub">
            <span>Hadir: <b>${r.presentDays}h</b></span>
            <span class="meta-dot">·</span>
            <span>Telat: <b>${r.lateDays}x</b></span>
            <span class="meta-dot">·</span>
            <span>SOP: <b>${r.taskScore}%</b></span>
          </div>
        </div>
        <div class="kpi-rank-score-box">
          <strong class="kpi-rank-score-num ${scoreColorClass}">${r.score}%</strong>
          <span class="kpi-rank-grade-pill ${gradeClass}">${gradeText}</span>
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// 6. SERTIFIKAT KPI DIGITAL (LAMAN PENUH / FULL PAGE)
// ==========================================
export function openKPICertificateModal() {
  const user = auth.currentUser;
  if (!user || !state.currentUserData) return;

  const monthStr = getLocalDateWITA().slice(0, 7);

  const nameEl = document.getElementById("cert-employee-name");
  const roleEl = document.getElementById("cert-employee-role");
  const codeEl = document.getElementById("cert-verification-code");

  if (nameEl) nameEl.innerText = state.currentUserData.nama || user.email;
  if (roleEl) roleEl.innerText = (ROLE_DISPLAY_NAMES[state.currentUserData.role] || state.currentUserData.role || 'Staff').toUpperCase();
  if (codeEl) codeEl.innerText = `CERT-${monthStr.replace("-", "")}-${user.uid.slice(0, 6).toUpperCase()}`;

  const currentScore = document.getElementById("kpi-score-badge")?.innerText || "0%";
  const currentPresence = document.getElementById("kpi-attendance-count")?.innerText || "0 Hari";
  const currentStatus = document.getElementById("kpi-status-tag")?.innerText || "Kurang";
  const taskScoreVal = `${state.currentUserTaskScore || 0}%`;

  const scoreEl = document.getElementById("cert-score-val");
  const presenceEl = document.getElementById("cert-presence-val");
  const taskEl = document.getElementById("cert-task-val");
  const badgeEl = document.getElementById("cert-status-badge");

  if (scoreEl) scoreEl.innerText = currentScore;
  if (presenceEl) presenceEl.innerText = currentPresence;
  if (taskEl) taskEl.innerText = taskScoreVal;
  if (badgeEl) badgeEl.innerText = `PRESTASI ${currentStatus.toUpperCase()}`;

  navigateToTab('kpi-cert-page');
}

export function closeKPICertModal() {
  navigateToTab('accounting');
}

export function printKPICertificate() {
  window.print();
}

export function openCrosscheckModal() {
  const user = auth.currentUser;
  if (!user) return;
  const inputReason = document.getElementById("crosscheck-reason-input");
  if (inputReason) inputReason.value = "";
  document.getElementById("crosscheck-modal")?.classList.remove("hidden");
}

export function closeCrosscheckModal() {
  document.getElementById("crosscheck-modal")?.classList.add("hidden");
}

export async function submitKPICrosscheck(e) {
  if (e) e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const reason = document.getElementById("crosscheck-reason-input")?.value.trim();
  if (!reason) return notify("Perhatian", "Tuliskan alasan sanggahan atau koreksi data KPI.");

  showLoading();
  const monthStr = getLocalDateWITA().slice(0, 7);

  try {
    await setDoc(doc(db, "kpi_crosschecks", `${user.uid}_${monthStr}`), {
      uid: user.uid,
      nama: state.currentUserData?.nama || user.email,
      role: state.currentUserData?.role || "staff",
      month: monthStr,
      note: reason,
      status: "Menunggu Audit GM",
      timestamp: serverTimestamp()
    }, { merge: true });

    hideLoading();
    closeCrosscheckModal();
    notify("Terkirim", "Permintaan sanggahan telah diteruskan ke GM.");
    calculateUserKPI(user.uid);
  } catch (err) {
    hideLoading();
    notify("Gagal", err.message);
  }
}
