/* ==========================================================================
   MYAIWA - GPS ATTENDANCE, REPORT GENERATOR, GM MANAGEMENT & KPI SYNC
   ========================================================================== */

import { auth, db } from "../firebase-config.js";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { 
  MERCHANT_LOCATION, 
  MONOTONE_ICONS, 
  ROLE_DISPLAY_NAMES, 
  DEFAULT_ROLE_PARAMS, 
  state 
} from "./constants.js";

import { 
  showLoading, 
  hideLoading, 
  notify, 
  showCustomConfirm, 
  navigateToTab,
  getLocalDateWITA,
  getLocalTimeWITA,
  calculateLateThresholdTime,
  openCustomPicker
} from "./utils.js";

// ==========================================
// 1. HELPER RADIUS & FORMULA HAVERSINE GPS
// ==========================================
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function isOutsideShiftHours() {
  const userRoleKey = String(state.currentUserData?.role || 'staff').toLowerCase();
  const roleCfg = state.roleParamsCache[userRoleKey] || DEFAULT_ROLE_PARAMS[userRoleKey] || DEFAULT_ROLE_PARAMS.staff;

  const currentHour = new Date().getHours();
  const shift = {
    pagi: { start: parseInt(roleCfg.pagi_start) || 7, end: parseInt(roleCfg.pagi_end) || 16 },
    malam: { start: parseInt(roleCfg.malam_start) || 13, end: parseInt(roleCfg.malam_end) || 21 },
    it_flex: { start: 8, end: 23 }
  }[state.currentUserShift] || { start: 7, end: 16 };

  return currentHour < shift.start || currentHour >= shift.end;
}

// ==========================================
// 2. VALIDASI POSISI GPS & STATUS RADIUS
// ==========================================
export function validateUserPositionAndSchedule(userLat, userLng, accuracyMeters = 0) {
  const rawDistance = calculateDistance(userLat, userLng, MERCHANT_LOCATION.lat, MERCHANT_LOCATION.lng);
  const effectiveDistance = Math.max(0, rawDistance - (accuracyMeters / 2));

  const radiusBox = document.getElementById("gps-radius-status-box");
  const btnAbsen = document.getElementById("btn-trigger-attendance");
  
  const userRoleKey = String(state.currentUserData?.role || 'staff').toLowerCase();
  const isITAccount = (userRoleKey === "it");
  const roleCfg = state.roleParamsCache[userRoleKey] || DEFAULT_ROLE_PARAMS[userRoleKey] || DEFAULT_ROLE_PARAMS.staff;
  const maxRadiusAllowed = roleCfg.radius_meter || MERCHANT_LOCATION.maxRadiusMeters;

  const isInsideOutlet = (effectiveDistance <= maxRadiusAllowed);
  const isITQuotaExceeded = isITAccount && !isInsideOutlet && (state.currentMonthITWfaCount >= 10);
  
  const isRadiusExempt = (state.currentUserWorkMode === "wfa" || (isITAccount && !isITQuotaExceeded));
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
      if (isOutTime) reasonText.push(`Di luar jam shift ${state.currentUserShift.toUpperCase()}`);

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
          : `STAFF IT · DI LUAR OUTLET (MODE WFA SISA ${10 - state.currentMonthITWfaCount} HARI - ${Math.round(rawDistance)}m)`;
      } else if (isRadiusExempt) {
        modeText = `MODE ${state.currentUserWorkMode.toUpperCase()} (Bebas Radius)`;
      }

      radiusBox.innerHTML = `
        <div class="radius-icon">${MONOTONE_ICONS.location}</div>
        <div class="radius-text">
          <strong>${modeText}</strong>
          <span>${state.currentUserShift === 'it_flex' ? 'SHIFT IT' : 'Shift ' + state.currentUserShift.toUpperCase()} · Silakan lakukan presensi</span>
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

  if (state.maplibreMap && window.maplibregl) {
    if (state.userMarker) state.userMarker.remove();
    state.userMarker = new maplibregl.Marker({ color: '#ff3b30' })
      .setLngLat([userLng, userLat])
      .setPopup(new maplibregl.Popup().setHTML(`<b>Posisi Anda</b><br>Jarak: ${Math.round(rawDistance)}m`))
      .addTo(state.maplibreMap);

    state.maplibreMap.flyTo({ center: [userLng, userLat], zoom: 17 });
  }
}

// ==========================================
// 3. INISIALISASI PETA MAPLIBRE & GPS
// ==========================================
export function initMapLibre() {
  const mapContainer = document.getElementById("maplibre-view");
  if (!mapContainer || !window.maplibregl) return;
  if (state.maplibreMap) { 
    state.maplibreMap.resize(); 
    return; 
  }

  try {
    state.maplibreMap = new maplibregl.Map({
      container: 'maplibre-view',
      style: 'https://demotiles.maplibre.org/style.json',
      center: [MERCHANT_LOCATION.lng, MERCHANT_LOCATION.lat],
      zoom: 16
    });

    new maplibregl.Marker({ color: '#1A4B8B' })
      .setLngLat([MERCHANT_LOCATION.lng, MERCHANT_LOCATION.lat])
      .setPopup(new maplibregl.Popup().setHTML("<b>AIWA RAGIN JAJE</b><br>Jl. Pendidikan No.28, Aikmel"))
      .addTo(state.maplibreMap);

    getGPSLocation(true);
  } catch (e) { 
    console.warn("MapLibre load error:", e); 
  }
}

export function getGPSLocation(isSilent = false) {
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
      state.userGPSLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      validateUserPositionAndSchedule(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      resetGPSButtonState();
    },
    () => {
      navigator.geolocation.getCurrentPosition(
        (fallbackPos) => {
          state.userGPSLocation = { lat: fallbackPos.coords.latitude, lng: fallbackPos.coords.longitude };
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

export function resetGPSButtonState() {
  const spinnerEl = document.getElementById("gps-spinner-monotone");
  const iconEl = document.getElementById("gps-icon-monotone");
  const textEl = document.getElementById("gps-btn-text");

  if (spinnerEl && iconEl && textEl) {
    spinnerEl.classList.add("hidden");
    iconEl.classList.remove("hidden");
    textEl.innerText = "CEK GPS";
  }
}

export function refreshMapLibreGPS() { 
  getGPSLocation(false); 
}

// ==========================================
// 4. EKSEKUSI PRESENSI PRIBADI
// ==========================================
export async function executeGPSAttendance() {
  const user = auth.currentUser;
  if (!user) return;

  if (!state.userGPSLocation) {
    notify("GPS Belum Siap", "Tekan tombol 'CEK GPS' terlebih dahulu.");
    getGPSLocation(false);
    return;
  }

  const userRoleKey = String(state.currentUserData?.role || 'staff').toLowerCase();
  const isITAccount = (userRoleKey === "it");
  const roleCfg = state.roleParamsCache[userRoleKey] || DEFAULT_ROLE_PARAMS[userRoleKey] || DEFAULT_ROLE_PARAMS.staff;
  const maxRadiusAllowed = roleCfg.radius_meter || MERCHANT_LOCATION.maxRadiusMeters;

  const distance = calculateDistance(state.userGPSLocation.lat, state.userGPSLocation.lng, MERCHANT_LOCATION.lat, MERCHANT_LOCATION.lng);
  const isInsideOutlet = distance <= maxRadiusAllowed;

  if (isITAccount && !isInsideOutlet && state.currentMonthITWfaCount >= 10) {
    notify("Kuota WFA Habis", "Batas maksimal 10 hari WFA (40%) telah tercapai. Anda wajib melakukan presensi WFO di outlet.");
    return;
  }

  const isRadiusExempt = (state.currentUserWorkMode === "wfa" || isITAccount);
  if (!isRadiusExempt && !isInsideOutlet) {
    notify("Ditolak", `Di luar radius toko (${Math.round(distance)}m). Maks: ${maxRadiusAllowed}m`);
    return;
  }

  let recordedMode = state.currentUserWorkMode;
  if (isITAccount) {
    recordedMode = isInsideOutlet ? "wfo" : "wfa";
  }

  showLoading("Memproses verifikasi presensi...");

  const todayStr = getLocalDateWITA();
  const timeStr = getLocalTimeWITA();
  const docUniqueId = `${user.uid}_${todayStr}`;

  try {
    const docRef = doc(db, "attendance", docUniqueId);
    const existingSnap = await getDoc(docRef);

    if (!existingSnap.exists()) {
      await setDoc(docRef, {
        uid: user.uid,
        nama: document.getElementById("header-user-name")?.innerText || state.currentUserData?.nama || user.email,
        role: userRoleKey,
        date: todayStr,
        check_in_time: timeStr,
        check_in_gps: state.userGPSLocation,
        shift: state.currentUserShift,
        mode: recordedMode,
        distance_meter: Math.round(distance),
        status: "Hadir",
        timestamp: serverTimestamp()
      });
      hideLoading();
      notify("Sukses", `Check-In berhasil [Mode: ${recordedMode.toUpperCase()}] pada pukul ${timeStr}`);
    } else {
      const data = existingSnap.data();
      if (data.check_in_time && data.check_out_time) {
        hideLoading();
        notify("Selesai", "Anda sudah menyelesaikan presensi Check-In dan Check-Out untuk hari ini.");
        return;
      }

      await setDoc(docRef, {
        check_out_time: timeStr,
        check_out_gps: state.userGPSLocation,
        updated_at: serverTimestamp()
      }, { merge: true });

      hideLoading();
      notify("Sukses", `Check-Out berhasil pada pukul ${timeStr}`);
    }
    
    await checkTodayAttendance();
    if (window.calculateUserKPI) {
      await window.calculateUserKPI(user.uid);
    }
  } catch (e) { 
    hideLoading();
    notify("Gagal Presensi", e.message); 
  }
}

// ==========================================
// 5. STATUS PRESENSI HARI INI
// ==========================================
export async function checkTodayAttendance() {
  const user = auth.currentUser;
  if (!user) return;
  const todayStr = getLocalDateWITA();
  const btnAbsen = document.getElementById("btn-trigger-attendance");
  const checkinEl = document.getElementById("today-checkin-time");
  const checkoutEl = document.getElementById("today-checkout-time");
  const docUniqueId = `${user.uid}_${todayStr}`;

  try {
    const docSnap = await getDoc(doc(db, "attendance", docUniqueId));

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (checkinEl) checkinEl.innerText = data.check_in_time || "--:--";
      if (checkoutEl) checkoutEl.innerText = data.check_out_time || "--:--";

      if (data.check_in_time && !data.check_out_time) {
        if (btnAbsen) {
          btnAbsen.querySelector("span").innerText = "Proses Check-Out Pulang";
          btnAbsen.disabled = false;
        }
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
  } catch (e) { 
    console.error("Error checkTodayAttendance:", e); 
  }
}

export function updateHomeLiveStatus(isPresent, isFinished) {
  const statusEl = document.getElementById("dashboard-today-status");
  const dotEl = document.getElementById("live-work-indicator");
  if (!statusEl || !dotEl) return;

  if (isFinished) {
    statusEl.innerText = "Selesai (Check-Out)";
    statusEl.style.color = "var(--text-secondary)";
    dotEl.className = "status-dot dot-offline";
  } else if (isPresent) {
    statusEl.innerText = "Aktif Bekerja";
    statusEl.style.color = "#10b981";
    dotEl.className = "status-dot dot-online";
  } else {
    statusEl.innerText = "Belum Presensi";
    statusEl.style.color = "#f59e0b";
    dotEl.className = "status-dot dot-offline";
  }
}

// ==========================================
// 6. RIWAYAT PRESENSI PRIBADI
// ==========================================
export async function loadAttendanceHistory() {
  const user = auth.currentUser;
  const listEl = document.getElementById("attendance-history-list");
  if (!user || !listEl) return;
  
  try {
    const q = query(
      collection(db, "attendance"), 
      where("uid", "==", user.uid)
    );
    const snap = await getDocs(q);
    listEl.innerHTML = "";
    
    if (snap.empty) {
      listEl.innerHTML = "<p class='placeholder-text'>Belum ada riwayat.</p>";
      return;
    }

    let items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    items = items.slice(0, 15);

    const badgeEl = document.getElementById("attendance-count-badge");
    if (badgeEl) badgeEl.innerText = `${items.length} Hari Terakhir`;

    items.forEach(item => {
      const div = document.createElement("div");
      div.className = "picker-user-row";
      div.style.cursor = "default";
      div.innerHTML = `
        <div class="picker-user-meta">
          <strong>${item.date} [${(item.mode || 'wfo').toUpperCase()}]</strong>
          <small>Masuk: ${item.check_in_time || '-'} | Keluar: ${item.check_out_time || '-'}${item.keterangan ? ' | Ket: ' + item.keterangan : ''}</small>
        </div>
        <span class='badge-status-work' style='background:rgba(16, 185, 129, 0.12); color:#10b981;'>${item.status || 'Hadir'}</span>
      `;
      listEl.appendChild(div);
    });
  } catch (e) {
    listEl.innerHTML = "<p class='placeholder-text' style='color:#ef4444;'>Gagal memuat riwayat.</p>";
  }
}

// ==========================================
// 7. GENERATOR LAPORAN ABSENSI (GM / ADMIN)
// ==========================================
export async function populateReportUserDropdown() {
  const selectEl = document.getElementById("report-select-user");
  const modalSelectEl = document.getElementById("manual-att-user");
  if (!selectEl) return;

  if (!state.allEmployeesCache || state.allEmployeesCache.length === 0) {
    try {
      const snap = await getDocs(collection(db, "users"));
      state.allEmployeesCache = [];
      snap.forEach(docSnap => {
        state.allEmployeesCache.push({ id: docSnap.id, ...docSnap.data() });
      });
    } catch (e) {
      console.warn("Gagal memuat list users:", e);
    }
  }

  const currentVal = selectEl.value;
  selectEl.innerHTML = `<option value="all">Semua Karyawan (Seluruh Tim)</option>`;

  if (modalSelectEl) {
    modalSelectEl.innerHTML = `<option value="" disabled selected>-- Pilih Karyawan --</option>`;
  }

  state.allEmployeesCache.forEach(u => {
    const rawRole = String(u.role || 'staff').toLowerCase();
    const roleLabel = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();
    const nameLabel = `${u.nama || u.email} [${roleLabel}]`;

    const opt = document.createElement("option");
    opt.value = u.id;
    opt.innerText = nameLabel;
    selectEl.appendChild(opt);

    if (modalSelectEl) {
      const optModal = document.createElement("option");
      optModal.value = u.id;
      optModal.innerText = nameLabel;
      modalSelectEl.appendChild(optModal);
    }
  });

  selectEl.value = currentVal || "all";
}

export async function openTargetUserPicker() {
  if (!state.allEmployeesCache || state.allEmployeesCache.length === 0) {
    await populateReportUserDropdown();
  }

  const currentVal = document.getElementById("report-select-user")?.value || "all";

  const pickerItems = [
    { value: "all", label: "Semua Karyawan (Seluruh Tim)", sub: "Tampilkan rekap semua divisi" }
  ];

  state.allEmployeesCache.forEach(u => {
    const rawRole = String(u.role || 'staff').toLowerCase();
    const roleLabel = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();
    pickerItems.push({
      value: u.id,
      label: u.nama || u.email,
      sub: `${u.email || '-'} · ${roleLabel}`
    });
  });

  openCustomPicker({
    title: "Pilih Target Karyawan",
    subtitle: "Pilih staf yang ingin dilihat absensinya",
    items: pickerItems,
    selectedValue: currentVal,
    onSelect: (val, label) => {
      const inputEl = document.getElementById("report-select-user");
      const labelEl = document.getElementById("label-report-selected-user");
      if (inputEl) inputEl.value = val;
      if (labelEl) labelEl.innerText = label;
      
      generateAdminAttendanceReport();
    }
  });
}

export function onReportPeriodTypeChange() {
  const type = document.getElementById("report-period-type")?.value || "daily";
  const boxDaily = document.getElementById("box-report-daily");
  const boxMonthly = document.getElementById("box-report-monthly");

  if (type === "daily") {
    boxDaily?.classList.remove("hidden");
    boxMonthly?.classList.add("hidden");
  } else {
    boxMonthly?.classList.remove("hidden");
    boxDaily?.classList.add("hidden");
  }
}

export async function generateAdminAttendanceReport() {
  const targetUid = document.getElementById("report-select-user")?.value || "all";
  const periodType = document.getElementById("report-period-type")?.value || "daily";
  const dailyDate = document.getElementById("report-filter-date")?.value || getLocalDateWITA();
  const monthlyPeriod = document.getElementById("report-filter-month")?.value || getLocalDateWITA().slice(0, 7);

  const container = document.getElementById("admin-attendance-report-results");
  if (!container) return;

  showLoading("Mengambil dan mengompilasi laporan absensi...");

  try {
    let q;
    // Query tunggal pada field 'date' untuk menghindari kebutuhan Composite Index di Firestore
    if (periodType === "daily") {
      q = query(collection(db, "attendance"), where("date", "==", dailyDate));
    } else {
      q = query(
        collection(db, "attendance"),
        where("date", ">=", `${monthlyPeriod}-01`),
        where("date", "<=", `${monthlyPeriod}-31`)
      );
    }

    const snap = await getDocs(q);
    state.generatedReportCache = [];

    const uniqueMap = new Map();
    snap.forEach(d => {
      const itemData = { id: d.id, ...d.data() };
      // Filter karyawan di memori JavaScript
      if (targetUid === "all" || itemData.uid === targetUid) {
        uniqueMap.set(d.id, itemData);
      }
    });

    state.generatedReportCache = Array.from(uniqueMap.values());
    state.generatedReportCache.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (a.nama || "").localeCompare(b.nama || ""));

    hideLoading();
    renderAdminAttendanceReport(state.generatedReportCache, {
      periodType,
      targetUid,
      dateLabel: periodType === "daily" ? dailyDate : monthlyPeriod
    });
  } catch (err) {
    hideLoading();
    container.innerHTML = `<p class='placeholder-text text-danger'>Gagal memuat laporan: ${err.message}</p>`;
  }
}

export function renderAdminAttendanceReport(list, meta) {
  const container = document.getElementById("admin-attendance-report-results");
  const summaryBox = document.getElementById("admin-report-summary-box");

  if (!container) return;

  let countHadir = 0;
  let countTelat = 0;
  let countIzin = 0;
  let countSakit = 0;
  let countAlpa = 0;

  list.forEach(item => {
    const st = item.status || "Hadir";
    if (st === "Hadir") {
      countHadir++;
      const rawRole = String(item.role || 'staff').toLowerCase();
      const roleCfg = state.roleParamsCache[rawRole] || DEFAULT_ROLE_PARAMS[rawRole] || DEFAULT_ROLE_PARAMS.staff;
      const baseStart = (item.shift === "malam") ? (roleCfg.malam_start || "13:30") : (roleCfg.pagi_start || "07:30");
      const lateThreshold = calculateLateThresholdTime(baseStart, roleCfg.tolerance || 15);
      
      if (item.check_in_time && item.check_in_time > lateThreshold) {
        countTelat++;
      }
    } else if (st === "Izin") countIzin++;
    else if (st === "Sakit") countSakit++;
    else if (st === "Alpa") countAlpa++;
  });

  // 1. RENDER KARTU RINGKASAN STATISTIK
  if (summaryBox) {
    summaryBox.innerHTML = `
      <div class="att-stat-grid-main">
        <div class="att-stat-chip stat-hadir">
          <small>Total Hadir</small>
          <strong>${countHadir} Hari</strong>
        </div>
        <div class="att-stat-chip stat-telat">
          <small>Total Terlambat</small>
          <strong>${countTelat} Kali</strong>
        </div>
      </div>
      <div class="att-stat-pills-row">
        <div class="att-mini-pill">
          <span>Izin</span>
          <strong>${countIzin}</strong>
        </div>
        <div class="att-mini-pill">
          <span>Sakit</span>
          <strong>${countSakit}</strong>
        </div>
        <div class="att-mini-pill pill-alpa">
          <span>Alpa</span>
          <strong>${countAlpa}</strong>
        </div>
      </div>
    `;
    summaryBox.classList.remove("hidden");
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="placeholder-text">
        Tidak ada catatan absensi untuk <b>${meta.dateLabel}</b>.
      </div>
    `;
    return;
  }

  // 2. RENDER DAFTAR KARTU LOG ABSENSI
  container.innerHTML = `
    <div class="report-items-wrapper">
      ${list.map(item => {
        const rawRole = String(item.role || 'staff').toLowerCase();
        const displayRole = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();
        const itemDataEscaped = JSON.stringify(item).replace(/"/g, '&quot;');
        
        const rawRoleCfg = state.roleParamsCache[rawRole] || DEFAULT_ROLE_PARAMS[rawRole] || DEFAULT_ROLE_PARAMS.staff;
        const baseStart = (item.shift === "malam") ? (rawRoleCfg.malam_start || "13:30") : (rawRoleCfg.pagi_start || "07:30");
        const lateThreshold = calculateLateThresholdTime(baseStart, rawRoleCfg.tolerance || 15);
        const isLate = (item.status === "Hadir" && item.check_in_time && item.check_in_time > lateThreshold);

        let statusClass = "status-badge-hadir";
        let statusLabel = item.status || "Hadir";
        if (isLate) {
          statusClass = "status-badge-telat";
          statusLabel = "Hadir (Telat)";
        } else if (item.status === "Izin") {
          statusClass = "status-badge-izin";
        } else if (item.status === "Sakit") {
          statusClass = "status-badge-sakit";
        } else if (item.status === "Alpa") {
          statusClass = "status-badge-alpa";
        }

        return `
          <div class="att-log-card">
            <div class="att-log-top">
              <div class="att-user-header">
                <strong>${item.nama || 'Karyawan'}</strong>
                <div class="att-meta-tags">
                  <span class="att-role-badge">${displayRole}</span>
                  <span class="att-shift-tag">${item.date || '-'}</span>
                  <span class="att-shift-tag">${(item.shift || 'PAGI').toUpperCase()} [${(item.mode || 'wfo').toUpperCase()}]</span>
                </div>
              </div>
              <span class="att-status-pill ${statusClass}">${statusLabel}</span>
            </div>

            <div class="att-time-strip">
              <div class="att-time-col">
                <svg class="icon-inline" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                </svg>
                <span>In: <strong>${item.check_in_time || '--:--'}</strong></span>
              </div>

              <div class="att-divider-dot"></div>

              <div class="att-time-col">
                <svg class="icon-inline" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Out: <strong>${item.check_out_time || '--:--'}</strong></span>
              </div>
            </div>

            ${item.keterangan ? `<span class="att-note-text">Ket: "${item.keterangan}"</span>` : ''}

            <div class="att-actions-row">
              <button type="button" class="btn-att-edit" onclick="openEditAttendanceModal('${itemDataEscaped}')">
                <svg class="icon-inline" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>Edit</span>
              </button>
              <button type="button" class="btn-att-delete" onclick="deleteAttendanceRecord('${item.id}', '${item.uid}')">
                <svg class="icon-inline" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Hapus</span>
              </button>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ==========================================
// 8. TAMBAH ABSENSI MANUAL (GM)
// ==========================================
export function openAddAttendanceModal() {
  const modal = document.getElementById("add-attendance-modal");
  if (!modal) return notify("Error", "Modal tambah absensi belum tersedia.");
  
  populateReportUserDropdown();
  document.getElementById("manual-att-date").value = getLocalDateWITA();
  document.getElementById("manual-att-checkin").value = "07:30:00";
  document.getElementById("manual-att-checkout").value = "15:30:00";
  document.getElementById("manual-att-note").value = "Ditambahkan manual oleh GM";
  modal.classList.remove("hidden");
}

export function closeAddAttendanceModal() {
  document.getElementById("add-attendance-modal")?.classList.add("hidden");
}

export async function saveManualAttendance(e) {
  if (e) e.preventDefault();

  const uid = document.getElementById("manual-att-user")?.value;
  const dateStr = document.getElementById("manual-att-date")?.value;
  const shift = document.getElementById("manual-att-shift")?.value || "pagi";
  const mode = document.getElementById("manual-att-mode")?.value || "wfo";
  const checkin = document.getElementById("manual-att-checkin")?.value.trim();
  const checkout = document.getElementById("manual-att-checkout")?.value.trim();
  const status = document.getElementById("manual-att-status")?.value || "Hadir";
  const note = document.getElementById("manual-att-note")?.value.trim();

  if (!uid) return notify("Perhatian", "Pilih karyawan terlebih dahulu.");
  if (!dateStr) return notify("Perhatian", "Tentukan tanggal absensi.");

  const emp = state.allEmployeesCache.find(u => u.id === uid);
  const employeeName = emp ? (emp.nama || emp.email) : "Karyawan";
  const employeeRole = emp ? String(emp.role || 'staff').toLowerCase() : "staff";
  const docUniqueId = `${uid}_${dateStr}`;

  showLoading("Menyimpan data absensi manual...");

  try {
    await setDoc(doc(db, "attendance", docUniqueId), {
      uid: uid,
      nama: employeeName,
      role: employeeRole,
      date: dateStr,
      check_in_time: checkin || null,
      check_out_time: checkout || null,
      shift: shift,
      mode: mode,
      status: status,
      keterangan: note || "Manual GM",
      created_by_gm: true,
      timestamp: serverTimestamp()
    }, { merge: true });

    if (window.calculateUserKPI) {
      await window.calculateUserKPI(uid);
    }

    hideLoading();
    closeAddAttendanceModal();
    notify("Sukses", `Data absensi untuk ${employeeName} tanggal ${dateStr} berhasil disimpan & KPI diperbarui.`);

    generateAdminAttendanceReport();
  } catch (err) {
    hideLoading();
    notify("Gagal Tambah", err.message);
  }
}

// ==========================================
// 9. EDIT & HAPUS ABSENSI OLEH GM
// ==========================================
export function openEditAttendanceModal(itemJsonString) {
  const item = typeof itemJsonString === "string" ? JSON.parse(itemJsonString) : itemJsonString;
  if (!item) return;

  const modal = document.getElementById("edit-attendance-modal");
  if (!modal) return;

  document.getElementById("edit-att-id").value = item.id;
  document.getElementById("edit-att-uid").value = item.uid || "";
  document.getElementById("edit-att-name").value = item.nama || "";
  document.getElementById("edit-att-date").value = item.date || "";
  document.getElementById("edit-att-checkin").value = item.check_in_time || "";
  document.getElementById("edit-att-checkout").value = item.check_out_time || "";
  document.getElementById("edit-att-status").value = item.status || "Hadir";
  document.getElementById("edit-att-note").value = item.keterangan || "";

  modal.classList.remove("hidden");
}

export function closeEditAttendanceModal() {
  document.getElementById("edit-attendance-modal")?.classList.add("hidden");
}

export async function saveEditedAttendance(e) {
  if (e) e.preventDefault();

  const docId = document.getElementById("edit-att-id").value;
  const uid = document.getElementById("edit-att-uid").value;
  const checkin = document.getElementById("edit-att-checkin").value.trim();
  const checkout = document.getElementById("edit-att-checkout").value.trim();
  const status = document.getElementById("edit-att-status").value;
  const note = document.getElementById("edit-att-note").value.trim();

  if (!docId) return notify("Error", "ID Dokumen tidak ditemukan.");

  showLoading("Menyimpan koreksi absensi...");

  try {
    await setDoc(doc(db, "attendance", docId), {
      check_in_time: checkin || null,
      check_out_time: checkout || null,
      status: status,
      keterangan: note || null,
      edited_at: serverTimestamp()
    }, { merge: true });

    if (uid && window.calculateUserKPI) {
      await window.calculateUserKPI(uid);
    }

    hideLoading();
    closeEditAttendanceModal();
    notify("Sukses", "Data absensi diperbarui & KPI disinkronkan.");

    generateAdminAttendanceReport();
    if (auth.currentUser?.uid === uid) {
      await checkTodayAttendance();
    }
  } catch (err) {
    hideLoading();
    notify("Gagal Simpan", err.message);
  }
}

export async function deleteAttendanceRecord(docId, uid) {
  const isConfirmed = await showCustomConfirm("Hapus Absensi", "Hapus data absensi ini secara permanen? KPI bulanan karyawan akan langsung dikalkulasi ulang.");
  if (!isConfirmed) return;

  showLoading("Menghapus data absensi...");
  try {
    await deleteDoc(doc(db, "attendance", docId));

    if (uid && window.calculateUserKPI) {
      await window.calculateUserKPI(uid);
    }

    hideLoading();
    notify("Sukses", "Data absensi dihapus & KPI diperbarui.");
    generateAdminAttendanceReport();
    if (auth.currentUser?.uid === uid) {
      await checkTodayAttendance();
    }
  } catch (e) { 
    hideLoading();
    notify("Gagal", e.message); 
  }
}

// ==========================================
// 10. PENGAJUAN SAKIT & IZIN (KARYAWAN)
// ==========================================
export function openLeaveFormPage(leaveType) {
  state.pendingLeaveType = leaveType;
  document.getElementById('leave-page-header-title').innerText = `Formulir Pengajuan ${leaveType}`;
  document.getElementById('leave-badge-type').innerText = leaveType.toUpperCase();
  document.getElementById('leave-attachment-label').innerText = leaveType === 'Sakit' ? 'UNGGAH BUKTI (SURAT DOKTER / RESEP)' : 'UNGGAH DOKUMEN / BUKTI KEPERLUAN';
  
  const todayStr = getLocalDateWITA();
  document.getElementById('leave-start-date').value = todayStr;
  document.getElementById('leave-end-date').value = todayStr;
  document.getElementById('leave-reason-text').value = '';
  document.getElementById('leave-file-input').value = '';
  document.getElementById('leave-file-label-display').innerText = 'Belum ada file dipilih';
  calculateLeaveDays();

  navigateToTab('leave-form');
}

export function calculateLeaveDays() {
  const start = document.getElementById('leave-start-date')?.value;
  const end = document.getElementById('leave-end-date')?.value;
  if (!start || !end) return;

  const d1 = new Date(start);
  const d2 = new Date(end);
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
  const durationDisplay = document.getElementById('leave-duration-display');
  if (durationDisplay) durationDisplay.value = `${diffDays} Hari`;
}

export async function submitLeaveRequest(startDate, endDate, duration, reason) {
  const user = auth.currentUser;
  if (!user) return;

  showLoading("Mengirimkan pengajuan izin/sakit...");
  const docUniqueId = `${user.uid}_${startDate}`;

  try {
    await setDoc(doc(db, "attendance", docUniqueId), {
      uid: user.uid,
      nama: document.getElementById("header-user-name")?.innerText || state.currentUserData?.nama || user.email,
      role: String(state.currentUserData?.role || 'staff').toLowerCase(),
      date: startDate,
      end_date: endDate,
      duration: duration,
      status: state.pendingLeaveType,
      keterangan: reason,
      timestamp: serverTimestamp()
    }, { merge: true });

    if (window.calculateUserKPI) {
      await window.calculateUserKPI(user.uid);
    }

    hideLoading();
    notify("Berhasil", `Pengajuan ${state.pendingLeaveType} berhasil dikirim.`);
    navigateToTab('absensi');
    checkTodayAttendance();
  } catch (err) { 
    hideLoading();
    notify("Gagal", err.message); 
  }
}
