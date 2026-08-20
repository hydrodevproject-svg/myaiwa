/* ==========================================================================
   MYAIWA - IT SUPERADMIN, METRICS, AUDIT LOGS, BACKUP & MASS RESTORE
   ========================================================================== */

import { db } from "../firebase-config.js";
import { 
  collection, 
  getDocs, 
  doc, 
  addDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  limit 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { 
  state, 
  ROLE_DISPLAY_NAMES 
} from "./constants.js";

import { 
  showLoading, 
  hideLoading, 
  notify, 
  showCustomConfirm 
} from "./utils.js";

// ==========================================
// 1. METRIK DATABASE & KESEHATAN SERVER
// ==========================================
export async function calculateDatabaseMetrics() {
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

export async function refreshITMetrics() {
  showLoading("Memperbarui metrik...");
  await calculateDatabaseMetrics();
  await loadITUsersList();
  hideLoading();
  notify("Refreshed", "Data metrik kapasitas server berhasil diperbarui.");
}

export function initITPanel() {
  calculateDatabaseMetrics();
  loadITUsersList();
}

// ==========================================
// 2. MANAJEMEN AKUN PENGGUNA IT
// ==========================================
export async function loadITUsersList() {
  const tbody = document.getElementById("it-users-tbody");
  if (!tbody) return;
  try {
    const snap = await getDocs(collection(db, "users"));
    state.itUsersCache = [];
    snap.forEach(d => state.itUsersCache.push({ id: d.id, ...d.data() }));
    renderITUsersTable(state.itUsersCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-danger">Gagal memuat pengguna.</td></tr>`;
  }
}

export function renderITUsersTable(list) {
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

export function filterITUsersList() {
  const q = document.getElementById("it-search-users")?.value.toLowerCase().trim() || "";
  const filtered = state.itUsersCache.filter(u => 
    (u.email && u.email.toLowerCase().includes(q)) || 
    (u.nama && u.nama.toLowerCase().includes(q)) || 
    (u.role && u.role.toLowerCase().includes(q))
  );
  renderITUsersTable(filtered);
}

export async function deleteUserAccount(userId) {
  const isConfirmed = await showCustomConfirm("Hapus Akun", "Apakah Anda yakin ingin menghapus data pengguna ini dari database?");
  if (!isConfirmed) return;

  showLoading("Menghapus akun pengguna...");
  try {
    await deleteDoc(doc(db, "users", userId));
    hideLoading();
    notify("Sukses", "Data pengguna berhasil dihapus.");
    loadITUsersList();
    if (window.loadHRUserOptions) window.loadHRUserOptions();
  } catch (err) {
    hideLoading();
    notify("Gagal Hapus", err.message);
  }
}

// ==========================================
// 3. AUDIT TRAILS & LOG AKTIVITAS
// ==========================================
export async function loadAuditLogs() {
  const container = document.getElementById("it-logs-container");
  if (!container) return;
  
  if (state.rawAuditLogsCache.length > 0) {
    renderAuditLogsList(state.rawAuditLogsCache);
  } else {
    container.innerHTML = "<p class='placeholder-text'>Memuat data riwayat log...</p>";
  }

  try {
    const snap = await getDocs(query(collection(db, "attendance"), limit(50)));
    state.rawAuditLogsCache = [];
    
    snap.forEach(d => {
      state.rawAuditLogsCache.push({ id: d.id, ...d.data() });
    });

    state.rawAuditLogsCache.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    renderAuditLogsList(state.rawAuditLogsCache);
  } catch (e) {
    container.innerHTML = `<p class='placeholder-text' style='color:#ff3b30;'>Gagal memuat: ${e.message}</p>`;
  }
}

export function renderAuditLogsList(list) {
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

export function filterAuditLogs() {
  const q = document.getElementById("log-search-input")?.value.toLowerCase().trim() || "";
  const dateVal = document.getElementById("log-date-filter")?.value || "";

  const filtered = state.rawAuditLogsCache.filter(item => {
    const matchName = !q || (item.nama && item.nama.toLowerCase().includes(q)) || (item.status && item.status.toLowerCase().includes(q));
    const matchDate = !dateVal || item.date === dateVal;
    return matchName && matchDate;
  });

  renderAuditLogsList(filtered);
}

// ==========================================
// 4. BACKUP DATA MASSAL (JSON & EXCEL .XLSX)
// ==========================================
export async function exportDatabaseBackup(format = "json") {
  const targetCol = document.getElementById("export-target-col")?.value || "all";
  showLoading(`Menyiapkan backup data massal (${format.toUpperCase()})...`);

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
        hideLoading();
        return notify("Perhatian", "Tidak ada data pada koleksi yang dipilih.");
      }

      XLSX.writeFile(wb, `BACKUP_MYAIWA_${targetCol.toUpperCase()}_${timestampStr}.xlsx`);
    }

    hideLoading();
    notify("Sukses", `Backup data massal berhasil diunduh (${format.toUpperCase()}).`);
  } catch (err) {
    hideLoading();
    notify("Gagal Backup", err.message);
  }
}

// ==========================================
// 5. PEMBERSIHAN MASSAL (DANGER ZONE)
// ==========================================
export async function executeMassDatabaseWipe() {
  const isConfirmed1 = await showCustomConfirm(
    "Peringatan Keras", 
    "Apakah Anda yakin ingin MENGHAPUS SEMUA DATA transaksi (Absensi, Pengajuan, Slip Gaji, Struktur)? Data akun pengguna akan tetap aman."
  );
  if (!isConfirmed1) return;

  const isConfirmed2 = await showCustomConfirm(
    "Konfirmasi Terakhir", 
    "Aksi ini TIDAK DAPAT DIBATALKAN. Pastikan Anda sudah mengunduh Backup JSON/Excel terlebih dahulu. Lanjutkan pembersihan?"
  );
  if (!isConfirmed2) return;

  showLoading("Membersihkan database secara massal...");

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

    hideLoading();
    notify("Pembersihan Selesai", `Berhasil menghapus ${totalDeleted} dokumen data riwayat.`);
    
    if (window.checkTodayAttendance) window.checkTodayAttendance();
    if (window.calculateUserKPI) window.calculateUserKPI(auth.currentUser?.uid);
    calculateDatabaseMetrics();
    if (window.loadDailyTaskChecklist) window.loadDailyTaskChecklist();
  } catch (err) {
    hideLoading();
    notify("Gagal Membersihkan DB", err.message);
  }
}

// ==========================================
// 6. IMPORT / RESTORE DATABASE DARI FILE
// ==========================================
export async function importDatabaseData(file, targetCol) {
  if (!file) return notify("Perhatian", "Pilih berkas cadangan terlebih dahulu.");

  showLoading("Mengimpor data ke koleksi...");

  try {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        let rows = [];
        if (file.name.endsWith('.json')) {
          rows = JSON.parse(evt.target.result);
          if (!Array.isArray(rows) && rows[targetCol]) {
            rows = rows[targetCol];
          }
        } else {
          if (!window.XLSX) throw new Error("Library XLSX belum dimuat.");
          const wb = XLSX.read(evt.target.result, { type: 'binary' });
          const sheetName = wb.SheetNames[0];
          rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
        }

        if (!Array.isArray(rows) || rows.length === 0) {
          hideLoading();
          return notify("Perhatian", "Format data tidak valid atau kosong.");
        }

        for (const row of rows) {
          const payload = { ...row, imported_at: serverTimestamp() };
          delete payload.id; // Hindari duplikasi field ID internal
          await addDoc(collection(db, targetCol), payload);
        }

        hideLoading();
        notify("Sukses", `Berhasil mengimpor ${rows.length} data ke koleksi '${targetCol}'.`);
        
        const fileInput = document.getElementById("import-file-input");
        const fileLabel = document.getElementById("import-file-label");
        if (fileInput) fileInput.value = "";
        if (fileLabel) fileLabel.innerText = "Belum ada file dipilih";
        
        calculateDatabaseMetrics();
      } catch (readErr) {
        hideLoading();
        notify("Gagal Membaca Berkas", readErr.message);
      }
    };

    if (file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  } catch (err) {
    hideLoading();
    notify("Gagal Import", err.message);
  }
}
