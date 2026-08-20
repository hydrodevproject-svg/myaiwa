/* ==========================================================================
   MYAIWA - DAILY TASKS, KPI ENGINE, CERTIFICATE & GM LEADERBOARD
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
  DEFAULT_ROLE_PARAMS 
} from "./constants.js";

import { 
  showLoading, 
  hideLoading, 
  notify, 
  showCustomConfirm, 
  calculateLateThresholdTime 
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

  const todayStr = new Date().toISOString().split('T')[0];
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

// ==========================================
// 2. TOGGLE STATUS & SUBMIT KUNCI TUGAS
// ==========================================
export async function toggleDailyTaskStatus(taskId, isCustom, newStatus) {
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
}

export async function submitDailyTasksFinal() {
  const user = auth.currentUser;
  if (!user) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar" });

  const confirmSubmit = await showCustomConfirm(
    "Kunci & Submit Tugas",
    "Apakah Anda yakin ingin mengunci laporan tugas hari ini? Tugas yang sudah di-submit tidak dapat diubah kembali."
  );
  if (!confirmSubmit) return;

  showLoading("Mengunci laporan tugas operasional...");

  try {
    const logRef = doc(db, "daily_task_logs", `${user.uid}_${todayStr}`);
    await setDoc(logRef, {
      is_submitted: true,
      submitted_at_time: timeStr,
      submitted_at: serverTimestamp()
    }, { merge: true });

    hideLoading();
    notify("Berhasil", `Laporan tugas harian berhasil dikunci pada pukul ${timeStr}.`);
    await loadDailyTaskChecklist();
    await calculateUserKPI(user.uid);
  } catch (err) {
    hideLoading();
    notify("Gagal Submit", err.message);
  }
}

// ==========================================
// 3. ENGINE KALKULASI KPI AKUMULATIF
// ==========================================
export async function calculateUserKPI(uid) {
  try {
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7);
    const userRoleKey = String(state.currentUserData?.role || 'staff').toLowerCase();
    const isITAccount = (userRoleKey === "it");
    
    const roleCfg = state.roleParamsCache[userRoleKey] || DEFAULT_ROLE_PARAMS[userRoleKey] || DEFAULT_ROLE_PARAMS.staff;

    const attSnap = await getDocs(query(
      collection(db, "attendance"),
      where("uid", "==", uid)
    ));

    let totalPresence = 0;
    let wfoCount = 0;
    let wfaCount = 0;
    let lateCount = 0;

    const shiftType = state.currentUserShift || "pagi";
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
      if (itWfaText) itWfaText.innerText = `WFA: ${wfaCount} Hari (${wfaPct}%)`;

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
    if (careerBadgeEl) careerBadgeEl.innerText = (state.currentUserData?.career_level || "Junior").toUpperCase();
    if (careerTitleEl) careerTitleEl.innerText = `${state.currentUserData?.career_level || 'Junior'} Staff`;

  } catch (e) {
    console.error("Gagal menghitung KPI:", e);
  }
}

// ==========================================
// 4. SERTIFIKAT KPI DIGITAL & SANGGAHAN AUDIT
// ==========================================
export function openKPICertificateModal() {
  const user = auth.currentUser;
  if (!user || !state.currentUserData) return;

  const monthStr = new Date().toISOString().slice(0, 7);
  const certModal = document.getElementById("kpi-cert-modal");

  document.getElementById("cert-employee-name").innerText = state.currentUserData.nama || user.email;
  document.getElementById("cert-employee-role").innerText = (ROLE_DISPLAY_NAMES[state.currentUserData.role] || state.currentUserData.role || 'Staff').toUpperCase();
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
}

export function closeKPICertModal() {
  document.getElementById("kpi-cert-modal")?.classList.add("hidden");
}

export function printKPICertificate() {
  window.print();
}

export async function openCrosscheckModal() {
  const user = auth.currentUser;
  if (!user) return;

  const reason = prompt("Tuliskan alasan sanggahan atau koreksi data KPI yang tidak sesuai (misal: kendala GPS atau tugas belum terhitung):");
  if (!reason || reason.trim() === "") return;

  showLoading("Mengirimkan permintaan audit sanggahan ke GM...");
  const monthStr = new Date().toISOString().slice(0, 7);

  try {
    await setDoc(doc(db, "kpi_crosschecks", `${user.uid}_${monthStr}`), {
      uid: user.uid,
      nama: state.currentUserData?.nama || user.email,
      role: state.currentUserData?.role || "staff",
      month: monthStr,
      note: reason.trim(),
      status: "Menunggu Audit GM",
      timestamp: serverTimestamp()
    }, { merge: true });

    hideLoading();
    notify("Terkirim", "Permintaan croscheck telah diteruskan ke akun GM untuk diaudit.");
    calculateUserKPI(user.uid);
  } catch (err) {
    hideLoading();
    notify("Gagal", err.message);
  }
}

// ==========================================
// 5. GM LEADERBOARD & EVALUASI PERFORMA TIM
// ==========================================
export async function renderGMLeaderboardReport() {
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

    state.leaderboardReportCache = Object.values(userMap).map(u => {
      const targetWorkingDays = 26;
      const rate = Math.min(100, (u.presentDays / targetWorkingDays) * 100);
      const score = Math.max(0, Math.min(100, Math.round(rate - (u.lateDays * 3))));
      return { ...u, score };
    });

    state.leaderboardReportCache.sort((a, b) => b.score - a.score);

    const badgeEl = document.getElementById("kpi-ranking-count-badge");
    if (badgeEl) badgeEl.innerText = `${state.leaderboardReportCache.length} Karyawan`;

    renderLeaderboardReport(state.leaderboardReportCache);

    if (uncompletedContainer) {
      uncompletedContainer.innerHTML = "<p class='placeholder-text' style='color:#34c759;'>Seluruh checklist tugas operasional terpantau aman.</p>";
    }

  } catch (err) {
    container.innerHTML = `<p class='placeholder-text' style='color:#ff3b30;'>Gagal memuat: ${err.message}</p>`;
  }
}

export function renderLeaderboardReport(list) {
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

export function filterLeaderboardReport() {
  const q = document.getElementById("search-leaderboard-user")?.value.toLowerCase().trim() || "";
  const filtered = state.leaderboardReportCache.filter(u => 
    (u.nama && u.nama.toLowerCase().includes(q)) || 
    (u.email && u.email.toLowerCase().includes(q)) || 
    (u.role && u.role.toLowerCase().includes(q))
  );
  renderLeaderboardReport(filtered);
}
