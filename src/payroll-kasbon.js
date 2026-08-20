/* ==========================================================================
   MYAIWA - PAYROLL, SALARY SLIPS, KASBON & DISBURSEMENT ENGINE
   ========================================================================== */

import { auth, db } from "../firebase-config.js";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  limit 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { 
  state, 
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
  navigateToTab 
} from "./utils.js";

// ==========================================
// 1. KOMPILASI & KALKULASI SLIP GAJI
// ==========================================
export async function compileEmployeeSlip(userId, monthStr) {
  const [userDoc, salDoc, attSnap, reqSnap] = await Promise.all([
    getDoc(doc(db, "users", userId)),
    getDoc(doc(db, "salary_structures", userId)),
    getDocs(query(collection(db, "attendance"), where("uid", "==", userId))),
    getDocs(query(collection(db, "employee_requests"), where("uid", "==", userId)))
  ]);

  const userData = userDoc.exists() ? userDoc.data() : {};
  const salData = salDoc.exists() ? salDoc.data() : { base_salary: 0, role_allowance: 0, meal_daily: 15000, bank_account: "-" };
  const userRoleKey = String(userData.role || 'staff').toLowerCase();
  const roleCfg = state.roleParamsCache[userRoleKey] || DEFAULT_ROLE_PARAMS[userRoleKey] || DEFAULT_ROLE_PARAMS.staff;

  let hadirCount = 0;
  let lateCount = 0;
  let totalOvertimeHours = 0;

  const shiftType = userData.shift || "pagi";
  let baseStart = roleCfg.pagi_start || "07:30";
  let baseEnd = roleCfg.pagi_end || "15:30";

  if (shiftType === "malam") {
    baseStart = roleCfg.malam_start || "13:30";
    baseEnd = roleCfg.malam_end || "21:00";
  } else if (shiftType === "it_flex") {
    baseStart = roleCfg.it_threshold || "10:00";
    baseEnd = "18:00";
  }

  const toleranceMinutes = Number(roleCfg.tolerance ?? 15);
  const lateThresholdTime = calculateLateThresholdTime(baseStart, toleranceMinutes);

  attSnap.forEach(d => {
    const item = d.data();
    if (item.date && item.date.startsWith(monthStr) && item.status === "Hadir") {
      hadirCount++;
      
      if (item.check_in_time && item.check_in_time > lateThresholdTime) {
        lateCount++;
      }

      if (item.check_out_time && baseEnd) {
        const [outH, outM] = item.check_out_time.split(":").map(Number);
        const [endH, endM] = baseEnd.split(":").map(Number);
        const outTotalMin = (outH * 60) + outM;
        const endTotalMin = (endH * 60) + endM;

        if (outTotalMin > endTotalMin + 60) {
          const otHours = Math.floor((outTotalMin - endTotalMin) / 60);
          totalOvertimeHours += otHours;
        }
      }
    }
  });

  let kasbonTotal = 0;
  reqSnap.forEach(d => {
    const r = d.data();
    if (r.type === "Kasbon" && r.status === "Approved") {
      const sisaPokok = (Number(r.amount) || 0) - (Number(r.total_paid) || 0);
      if (sisaPokok > 0) {
        const cicilan = Number(r.monthly_installment) || sisaPokok;
        kasbonTotal += Math.min(sisaPokok, cicilan);
      }
    }
  });

  const base = Number(salData.base_salary) || 0;
  const roleAll = Number(salData.role_allowance ?? (CAREER_ALLOWANCE_PRESETS[userData.career_level || 'Junior'] || 0));
  const meal = (Number(salData.meal_daily) || 15000) * hadirCount;
  const overtimePay = totalOvertimeHours * (Number(roleCfg.overtime_rate) || 25000);
  const latePenaltyTotal = lateCount * (Number(roleCfg.late_penalty) || 10000);
  const thp = Math.max(0, base + roleAll + meal + overtimePay - latePenaltyTotal - kasbonTotal);

  return {
    uid: userId,
    nama: userData.nama || userData.email || "Karyawan",
    role: userRoleKey,
    career_level: userData.career_level || "Junior",
    month: monthStr,
    year: monthStr.slice(0, 4),
    bank: salData.bank_account || "BCA (Auto Transfer)",
    hadir: hadirCount,
    telat: lateCount,
    lemburJam: totalOvertimeHours,
    baseSalary: base,
    roleAllowance: roleAll,
    mealTotal: meal,
    overtimePay: overtimePay,
    latePenaltyTotal: latePenaltyTotal,
    kasbon: kasbonTotal,
    takeHomePay: thp
  };
}

// ==========================================
// 2. SLIP BULAN BERJALAN & KUNCI/TERBITKAN SLIP
// ==========================================
export async function openMyCurrentPayslip() {
  const user = auth.currentUser;
  if (!user) return;

  const currentMonth = new Date().toISOString().slice(0, 7);
  showLoading("Memuat slip gaji bulan berjalan...");

  try {
    const slipDoc = await getDoc(doc(db, "salary_slips_archive", `${user.uid}_${currentMonth}`));
    let slipData;

    if (slipDoc.exists()) {
      slipData = slipDoc.data();
    } else {
      slipData = await compileEmployeeSlip(user.uid, currentMonth);
    }

    hideLoading();
    openPayslipDetail(slipData);
  } catch (err) {
    hideLoading();
    notify("Gagal Memuat Slip", err.message);
  }
}

export async function lockAndPublishMonthlySlips() {
  const monthStr = document.getElementById("publish-month-picker")?.value;
  if (!monthStr) return notify("Perhatian", "Pilih bulan penerbitan slip.");

  const confirmPublish = await showCustomConfirm(
    "Kunci & Terbitkan Slip", 
    `Terbitkan slip gaji resmi untuk periode ${monthStr}? Saldo kasbon aktif akan otomatis dipotong sesuai skema cicilan.`
  );
  if (!confirmPublish) return;

  showLoading("Mengompilasi dan mengarsipkan slip gaji...");

  try {
    const [usersSnap, reqSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "employee_requests"))
    ]);

    let count = 0;

    for (const uDoc of usersSnap.docs) {
      const uid = uDoc.id;
      const slipPayload = await compileEmployeeSlip(uid, monthStr);
      slipPayload.published_at = serverTimestamp();

      for (const rDoc of reqSnap.docs) {
        const r = rDoc.data();
        if (r.uid === uid && r.type === "Kasbon" && r.status === "Approved") {
          const sisaPokok = (Number(r.amount) || 0) - (Number(r.total_paid) || 0);
          if (sisaPokok > 0) {
            const cicilan = Number(r.monthly_installment) || sisaPokok;
            const potonganEfektif = Math.min(sisaPokok, cicilan);
            const totalPaidBaru = (Number(r.total_paid) || 0) + potonganEfektif;
            const isLunas = ((Number(r.amount) || 0) - totalPaidBaru) <= 0;

            await setDoc(doc(db, "employee_requests", rDoc.id), {
              total_paid: totalPaidBaru,
              installment_paid_count: (Number(r.installment_paid_count) || 0) + 1,
              status: isLunas ? "Settled" : "Approved",
              last_deducted_month: monthStr
            }, { merge: true });
          }
        }
      }

      await setDoc(doc(db, "salary_slips_archive", `${uid}_${monthStr}`), slipPayload, { merge: true });
      count++;
    }

    hideLoading();
    notify("Sukses", `Berhasil mengunci dan menerbitkan ${count} slip gaji untuk periode ${monthStr}.`);
  } catch (err) {
    hideLoading();
    notify("Gagal Menerbitkan Slip", err.message);
  }
}

// ==========================================
// 3. RIWAYAT ARSIP SLIP GAJI
// ==========================================
export function populateSlipYearDropdown() {
  const selectYear = document.getElementById("filter-slip-year");
  if (!selectYear) return;

  const currentYear = new Date().getFullYear();
  selectYear.innerHTML = "";

  for (let i = 0; i < 4; i++) {
    const yr = currentYear - i;
    const opt = document.createElement("option");
    opt.value = String(yr);
    opt.innerText = String(yr);
    if (i === 0) opt.selected = true;
    selectYear.appendChild(opt);
  }
}

export async function renderUserSlipHistory() {
  const user = auth.currentUser;
  if (!user) return;

  const yearSelect = document.getElementById("filter-slip-year");
  if (!yearSelect || yearSelect.children.length === 0) {
    populateSlipYearDropdown();
  }

  const selectedYear = document.getElementById("filter-slip-year")?.value || String(new Date().getFullYear());
  const selectedMonth = document.getElementById("filter-slip-month")?.value || "all";
  const container = document.getElementById("user-slip-history-list");
  const countBadge = document.getElementById("history-total-count");

  if (!container) return;
  container.innerHTML = "<p class='placeholder-text'>Memuat arsip slip gaji...</p>";

  try {
    const snap = await getDocs(query(
      collection(db, "salary_slips_archive"),
      where("uid", "==", user.uid),
      where("month", ">=", `${selectedYear}-01`),
      where("month", "<=", `${selectedYear}-12`),
      orderBy("month", "desc"),
      limit(12)
    ));

    let slips = [];
    snap.forEach(d => {
      const item = { id: d.id, ...d.data() };
      if (selectedMonth === "all" || item.month.endsWith(`-${selectedMonth}`)) {
        slips.push(item);
      }
    });

    if (countBadge) countBadge.innerText = `${slips.length} / 12 Dokumen`;

    if (slips.length === 0) {
      container.innerHTML = `<p class='placeholder-text'>Belum ada arsip slip resmi untuk periode ${selectedYear}${selectedMonth !== 'all' ? '-' + selectedMonth : ''}. Silakan cek 'Slip Gaji Bulan Berjalan' untuk estimasi saat ini.</p>`;
      return;
    }

    container.innerHTML = "";
    slips.forEach(slip => {
      const div = document.createElement("div");
      div.className = "picker-user-row";
      div.style.cursor = "pointer";
      div.onclick = () => openPayslipDetail(slip);

      div.innerHTML = `
        <div class="picker-user-meta">
          <strong>Periode: ${slip.month}</strong>
          <small>Take Home Pay: Rp ${Number(slip.takeHomePay).toLocaleString()}</small>
        </div>
        <button class="btn-primary" style="padding:4px 8px; font-size:0.6rem;">Buka Slip</button>
      `;
      container.appendChild(div);
    });
  } catch (e) {
    const fallbackSnap = await getDocs(query(
      collection(db, "salary_slips_archive"),
      where("uid", "==", user.uid),
      limit(24)
    ));

    let slips = [];
    fallbackSnap.forEach(d => {
      const item = { id: d.id, ...d.data() };
      if (item.month && item.month.startsWith(selectedYear)) {
        if (selectedMonth === "all" || item.month.endsWith(`-${selectedMonth}`)) {
          slips.push(item);
        }
      }
    });

    slips.sort((a, b) => b.month.localeCompare(a.month));
    slips = slips.slice(0, 12);

    if (countBadge) countBadge.innerText = `${slips.length} / 12 Dokumen`;

    if (slips.length === 0) {
      container.innerHTML = `<p class='placeholder-text'>Belum ada arsip slip resmi untuk periode ${selectedYear}.</p>`;
      return;
    }

    container.innerHTML = "";
    slips.forEach(slip => {
      const div = document.createElement("div");
      div.className = "picker-user-row";
      div.style.cursor = "pointer";
      div.onclick = () => openPayslipDetail(slip);

      div.innerHTML = `
        <div class="picker-user-meta">
          <strong>Periode: ${slip.month}</strong>
          <small>Take Home Pay: Rp ${Number(slip.takeHomePay).toLocaleString()}</small>
        </div>
        <button class="btn-primary" style="padding:4px 8px; font-size:0.6rem;">Buka Slip</button>
      `;
      container.appendChild(div);
    });
  }
}

// ==========================================
// 4. DETAIL TAMPILAN SLIP GAJI
// ==========================================
export function openPayslipDetail(data) {
  if (!data) return;
  state.currentPayslipCache = data;
  const box = document.getElementById("payslip-page-content-box");
  const sigName = document.getElementById("payslip-sig-name");
  const docIdEl = document.getElementById("slip-meta-doc-id");
  if (!box) return;

  const docCode = `DOC-${data.month.replace("-", "")}-${data.uid.slice(0, 5).toUpperCase()}`;
  if (sigName) sigName.innerText = data.nama || "Karyawan";
  if (docIdEl) docIdEl.innerText = docCode;

  const rawRole = String(data.role || 'staff').toLowerCase();
  const displayRole = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();

  box.innerHTML = `
    <div class="corp-slip-divider"></div>

    <div class="payslip-meta-grid">
      <div class="payslip-meta-item">
        <small>NAMA STAF</small>
        <strong>${data.nama}</strong>
      </div>
      <div class="payslip-meta-item">
        <small>JABATAN / ROLE</small>
        <strong>${displayRole} (${(data.career_level || 'Junior').toUpperCase()})</strong>
      </div>
      <div class="payslip-meta-item">
        <small>PERIODE GAJI</small>
        <strong>${data.month}</strong>
      </div>
      <div class="payslip-meta-item">
        <small>REKENING PENERIMA</small>
        <strong>${data.bank || '-'}</strong>
      </div>
    </div>

    <div class="payslip-section-heading">RINCIAN PENGHASILAN (INCOME)</div>
    <div class="payslip-item-row">
      <span>Gaji Pokok</span>
      <strong>Rp ${(data.baseSalary || 0).toLocaleString()}</strong>
    </div>
    <div class="payslip-item-row">
      <span>Tunjangan Jabatan</span>
      <strong>Rp ${(data.roleAllowance || 0).toLocaleString()}</strong>
    </div>
    <div class="payslip-item-row">
      <span>Uang Makan (${data.hadir || 0} Hari)</span>
      <strong>Rp ${(data.mealTotal || 0).toLocaleString()}</strong>
    </div>
    ${(data.overtimePay > 0) ? `
      <div class="payslip-item-row" style="color:#1A4B8B;">
        <span>Upah Lembur (${data.lemburJam || 0} Jam)</span>
        <strong>+ Rp ${data.overtimePay.toLocaleString()}</strong>
      </div>
    ` : ''}

    <div class="payslip-section-heading">POTONGAN (DEDUCTION)</div>
    <div class="payslip-item-row text-deduct">
      <span>Denda Keterlambatan (${data.telat || 0}x)</span>
      <strong>- Rp ${(data.latePenaltyTotal || 0).toLocaleString()}</strong>
    </div>
    <div class="payslip-item-row text-deduct">
      <span>Pinjaman Kasbon</span>
      <strong>- Rp ${(data.kasbon || 0).toLocaleString()}</strong>
    </div>

    <div class="payslip-total-block">
      <span>GAJI BERSIH (TAKE HOME PAY)</span>
      <strong>Rp ${(data.takeHomePay || 0).toLocaleString()}</strong>
    </div>
  `;

  const btnClaim = document.getElementById("btn-claim-salary-action");
  const claimLabel = document.getElementById("claim-btn-label");

  if (btnClaim && claimLabel) {
    const isPublished = Boolean(data.published_at);
    const isBankRegistered = data.bank && data.bank !== "-" && !data.bank.includes("Belum");

    if (!isPublished) {
      btnClaim.disabled = true;
      btnClaim.style.background = "#8e8e93";
      btnClaim.style.cursor = "not-allowed";
      claimLabel.innerText = "Tahap Administrasi";
    } else if (!isBankRegistered && data.disbursement_method === "transfer") {
      btnClaim.disabled = true;
      btnClaim.style.background = "#ff9500";
      btnClaim.style.cursor = "not-allowed";
      claimLabel.innerText = "Rekening Belum Diverifikasi GM";
    } else if (data.disbursement_status === "Paid" || data.disbursement_status === "Claimed") {
      btnClaim.disabled = true;
      btnClaim.style.background = "#34c759";
      claimLabel.innerText = "Gaji Sudah Dicairkan ✓";
    } else if (data.disbursement_status === "Waiting_Cash_Scan") {
      btnClaim.disabled = false;
      btnClaim.style.background = "var(--text-accent)";
      claimLabel.innerText = `Lihat QR Pencairan (${data.voucher_code || 'Tunai'})`;
      btnClaim.onclick = () => showQRReceipt(data.voucher_code || "AIWA-CASH", data);
    } else if (data.disbursement_status === "Pending_Transfer") {
      btnClaim.disabled = true;
      btnClaim.style.background = "#ff9500";
      claimLabel.innerText = "Menunggu Verifikasi Transfer GM";
    } else {
      btnClaim.disabled = false;
      btnClaim.style.background = "var(--text-accent)";
      claimLabel.innerText = "Tarik Gaji Ini";
      btnClaim.onclick = () => openClaimSalaryPage();
    }
  }

  navigateToTab('payslip-page', true);
}

// ==========================================
// 5. KLAIM & PENCAIRAN GAJI (CASH & TRANSFER)
// ==========================================
export async function openClaimSalaryPage() {
  if (!state.currentPayslipCache) return notify("Perhatian", "Data slip tidak ditemukan.");
  
  if (state.currentPayslipCache.disbursement_status === "Claimed" || state.currentPayslipCache.disbursement_status === "Paid") {
    return notify("Informasi", "Gaji periode ini sudah dicairkan.");
  }

  try {
    const salDoc = await getDoc(doc(db, "salary_structures", state.currentPayslipCache.uid));
    const registeredAcc = salDoc.exists() ? (salDoc.data().bank_account || "-") : "-";
    
    const regLabelEl = document.getElementById("registered-bank-info-label");
    if (regLabelEl) {
      regLabelEl.innerText = registeredAcc !== "-" ? registeredAcc : "Belum didaftarkan oleh GM";
    }
  } catch (e) {
    console.warn("Gagal memuat rekening terdaftar:", e);
  }

  selectDisbursementMethod("cash");
  navigateToTab("claim-salary");
}

export function selectDisbursementMethod(method) {
  state.selectedDisbursementType = method;
  const cardCash = document.getElementById("card-method-cash");
  const cardTransfer = document.getElementById("card-method-transfer");
  const boxCash = document.getElementById("box-cash-detail");
  const boxTransfer = document.getElementById("box-transfer-detail");

  if (method === "cash") {
    cardCash?.classList.add("active-method");
    cardTransfer?.classList.remove("active-method");
    boxCash?.classList.remove("hidden");
    boxTransfer?.classList.add("hidden");
  } else {
    cardTransfer?.classList.add("active-method");
    cardCash?.classList.remove("active-method");
    boxTransfer?.classList.remove("hidden");
    boxCash?.classList.add("hidden");
  }
}

export async function submitSalaryDisbursement() {
  if (!state.currentPayslipCache) return;
  const user = auth.currentUser;
  if (!user) return;

  const now = Date.now();
  const expiresAtMillis = now + (24 * 60 * 60 * 1000);
  const slipKey = `${state.currentPayslipCache.uid}_${state.currentPayslipCache.month}`;
  const voucherCode = `AIWA-${state.currentPayslipCache.month.replace("-", "")}-${Math.floor(1000 + Math.random() * 9000)}`;

  let bankNote = "Pencairan TUNAI di Kantor Finance";

  if (state.selectedDisbursementType === "transfer") {
    const bankName = document.getElementById("transfer-bank-select")?.value;
    const accNum = document.getElementById("transfer-acc-number")?.value.trim();
    const accName = document.getElementById("transfer-acc-name")?.value.trim();

    if (!accNum || !accName) {
      return notify("Perhatian", "Lengkapi nomor rekening dan nama pemilik rekening.");
    }

    showLoading("Memverifikasi kecocokan rekening...");

    try {
      const salDoc = await getDoc(doc(db, "salary_structures", user.uid));
      if (!salDoc.exists() || !salDoc.data().bank_number) {
        hideLoading();
        return notify("Rekening Belum Terdaftar", "Rekening Anda belum didaftarkan di sistem oleh GM. Silakan hubungi GM/HR terlebih dahulu.");
      }

      const regData = salDoc.data();
      const registeredNumber = String(regData.bank_number).trim();

      if (accNum !== registeredNumber) {
        hideLoading();
        return notify(
          "Rekening Tidak Cocok", 
          `Nomor rekening (${accNum}) tidak cocok dengan data resmi yang didaftarkan GM (${regData.bank_name} - ${registeredNumber} a.n ${regData.bank_holder}).`
        );
      }

      bankNote = `Transfer Bank: ${bankName} - ${accNum} a.n ${accName}`;
    } catch (err) {
      hideLoading();
      return notify("Gagal Validasi", err.message);
    }
  }

  showLoading("Memproses pengajuan penarikan...");

  try {
    const claimPayload = {
      uid: user.uid,
      nama: state.currentPayslipCache.nama,
      role: state.currentPayslipCache.role,
      month: state.currentPayslipCache.month,
      amount: state.currentPayslipCache.takeHomePay,
      method: state.selectedDisbursementType,
      voucher_code: voucherCode,
      note: `Pencairan ${state.selectedDisbursementType.toUpperCase()} (Kode: ${voucherCode}) - ${bankNote}`,
      disbursement_status: state.selectedDisbursementType === "cash" ? "Waiting_Cash_Scan" : "Pending_Transfer",
      status: "Pending",
      requested_at: serverTimestamp(),
      requested_millis: now,
      expires_at_millis: expiresAtMillis
    };

    await setDoc(doc(db, "employee_requests", `PAY_${slipKey}`), {
      type: "Tarik Gaji",
      ...claimPayload
    }, { merge: true });

    await setDoc(doc(db, "salary_slips_archive", slipKey), {
      ...state.currentPayslipCache,
      disbursement_status: claimPayload.disbursement_status,
      disbursement_method: state.selectedDisbursementType,
      voucher_code: voucherCode,
      expires_at_millis: expiresAtMillis
    }, { merge: true });

    state.currentPayslipCache.disbursement_status = claimPayload.disbursement_status;
    state.currentPayslipCache.voucher_code = voucherCode;
    state.currentPayslipCache.expires_at_millis = expiresAtMillis;

    hideLoading();

    if (state.selectedDisbursementType === "cash") {
      showQRReceipt(voucherCode, state.currentPayslipCache);
    } else {
      notify("Pengajuan Terkirim", "Nomor rekening terverifikasi cocok! Pengajuan transfer telah diteruskan ke GM (Berlaku 1x24 Jam).");
      navigateToTab("payslip-page");
    }

    openPayslipDetail(state.currentPayslipCache);
    loadHRRequestsList();
  } catch (err) {
    hideLoading();
    notify("Gagal Memproses", err.message);
  }
}

export function showQRReceipt(voucherCode, slipData) {
  const modal = document.getElementById("qr-receipt-modal");
  const codeEl = document.getElementById("claim-voucher-code");
  const qrContainer = document.getElementById("qrcode-container");
  const expiryEl = document.getElementById("qr-expiry-info");

  if (codeEl) codeEl.innerText = voucherCode;

  if (expiryEl && slipData.expires_at_millis) {
    const expDate = new Date(slipData.expires_at_millis);
    const expTimeStr = expDate.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
    const expDateStr = expDate.toLocaleDateString("id-ID", { day: 'numeric', month: 'short' });
    expiryEl.innerHTML = `Batas Berlaku: <b style="color:#ff3b30;">${expDateStr}, ${expTimeStr} WITA (1x24 Jam)</b>`;
  }

  if (qrContainer) {
    qrContainer.innerHTML = "";
    if (window.QRCode) {
      state.qrCodeInstance = new QRCode(qrContainer, {
        text: JSON.stringify({
          app: "MYAIWA_PAYROLL",
          code: voucherCode,
          uid: slipData.uid,
          nama: slipData.nama,
          month: slipData.month,
          thp: slipData.takeHomePay,
          exp: slipData.expires_at_millis
        }),
        width: 160,
        height: 160,
        colorDark: "#1A4B8B",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  modal?.classList.remove("hidden");
}

export function closeQRReceiptModal() {
  document.getElementById("qr-receipt-modal")?.classList.add("hidden");
}

// ==========================================
// 6. SCANNER GM UNTUK VALIDASI TRANSAKSI
// ==========================================
export function openGMScannerModal() {
  const modal = document.getElementById("gm-scanner-modal");
  modal?.classList.remove("hidden");

  if (window.Html5Qrcode) {
    state.html5QrScanner = new Html5Qrcode("reader");
    state.html5QrScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (decodedText) => {
        try {
          const payload = JSON.parse(decodedText);
          if (payload.code) {
            closeGMScannerModal();
            validateScannedOperationalCode(payload.code);
          } else {
            notify("QR Tidak Dikenal", "Format QR Code tidak valid.");
          }
        } catch (e) {
          closeGMScannerModal();
          validateScannedOperationalCode(decodedText);
        }
      },
      () => {}
    ).catch(() => {});
  }
}

export function closeGMScannerModal() {
  if (state.html5QrScanner) {
    state.html5QrScanner.stop()
      .then(() => {
        state.html5QrScanner.clear();
        state.html5QrScanner = null;
      })
      .catch(() => {
        state.html5QrScanner = null;
      });
  }
  document.getElementById("gm-scanner-modal")?.classList.add("hidden");
}

export function validateManualVoucherCode() {
  const code = document.getElementById("input-manual-voucher-code")?.value.trim().toUpperCase();
  if (!code) return notify("Perhatian", "Masukkan kode voucher.");
  closeGMScannerModal();
  validateScannedOperationalCode(code);
}

export async function validateScannedOperationalCode(voucherCode) {
  showLoading("Memvalidasi kode voucher...");

  try {
    const q = query(
      collection(db, "employee_requests"), 
      where("voucher_code", "==", voucherCode)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      hideLoading();
      return notify("Kode Tidak Valid", `Tidak ditemukan pengajuan dengan kode ${voucherCode}.`);
    }

    const targetDoc = snap.docs[0];
    const reqData = targetDoc.data();

    const now = Date.now();
    if (reqData.expires_at_millis && now > reqData.expires_at_millis) {
      await setDoc(doc(db, "employee_requests", targetDoc.id), { status: "Expired", expired_at_millis: now }, { merge: true });
      hideLoading();
      return notify("Kode Kedaluwarsa", "Batas waktu QRIS / Voucher telah habis.");
    }

    if (reqData.status === "Approved") {
      hideLoading();
      return notify("Sudah Divalidasi", `Transaksi ${reqData.type} ${reqData.nama} sudah selesai.`);
    }

    const confirmApprove = await showCustomConfirm(
      `Konfirmasi ${reqData.type}`,
      `Validasi ${reqData.type} untuk ${reqData.nama} sejumlah Rp ${Number(reqData.amount).toLocaleString()}?`
    );

    if (confirmApprove) {
      await approveDisbursement(targetDoc.id, reqData.uid, reqData.month);
    } else {
      hideLoading();
    }
  } catch (err) {
    hideLoading();
    notify("Gagal Validasi", err.message);
  }
}

// ==========================================
// 7. EKSPOR SLIP GAJI (WORD, PDF, GAMBAR)
// ==========================================
export function openShareOptionsModal() {
  document.getElementById("share-options-modal")?.classList.remove("hidden");
}

export function closeShareOptionsModal() {
  document.getElementById("share-options-modal")?.classList.add("hidden");
}

export function printPayslip() {
  window.print();
}

export async function exportPayslipFile(formatType) {
  if (!state.currentPayslipCache) return notify("Perhatian", "Data slip tidak ditemukan.");
  closeShareOptionsModal();

  const data = state.currentPayslipCache;
  const rawRole = String(data.role || 'staff').toLowerCase();
  const displayRole = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();
  const docCode = `DOC-${data.month.replace("-", "")}-${data.uid.slice(0, 5).toUpperCase()}`;
  const fileName = `SLIP_GAJI_${(data.nama || 'Karyawan').replace(/\s+/g, '_')}_${data.month}`;

  showLoading(`Menyiapkan berkas ${formatType.toUpperCase()}...`);

  try {
    if (formatType === "doc") {
      const wordHTML = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>Slip Gaji - ${data.nama}</title>
          <style>
            body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 10pt; color: #0f172a; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .header-table td { vertical-align: top; }
            .title { font-size: 14pt; font-weight: bold; color: #0f172a; }
            .sub { font-size: 7.5pt; font-weight: bold; color: #64748b; margin-top: 2px; }
            .badge { background-color: #dcfce7; color: #16a34a; padding: 3px 8px; font-size: 7.5pt; font-weight: bold; border-radius: 4px; }
            .doc-id { font-size: 7.5pt; color: #94a3b8; margin-top: 4px; font-family: monospace; }
            .divider { border-top: 2.5px solid #1A4B8B; margin: 10px 0; }
            .meta-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; }
            .meta-label { font-size: 7pt; color: #94a3b8; font-weight: bold; }
            .meta-val { font-size: 9.5pt; color: #0f172a; font-weight: bold; }
            .sec-title { font-size: 8pt; font-weight: bold; color: #64748b; padding-top: 12px; }
            .item-row td { padding: 5px 0; font-size: 9pt; }
            .item-deduct td { color: #ef4444; font-weight: 600; padding: 5px 0; font-size: 9pt; }
            .total-box { background-color: #f1f5f9; border-radius: 8px; padding: 10px; }
            .total-label { font-size: 9pt; font-weight: bold; color: #0f172a; }
            .total-amount { font-size: 13pt; font-weight: bold; color: #1A4B8B; text-align: right; }
            .sig-table { margin-top: 30px; font-size: 8pt; color: #64748b; }
            .sig-name { font-size: 9pt; font-weight: bold; color: #0f172a; border-top: 1.5px solid #0f172a; padding-top: 3px; display: inline-block; min-width: 150px; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <div class="title">AIWA RAGIN JAJE</div>
                <div class="sub">PAYROLL DISBURSEMENT SYSTEM · CONFIDENTIAL</div>
              </td>
              <td align="right">
                <span class="badge">TERVERIFIKASI SISTEM</span><br>
                <div class="doc-id">${docCode}</div>
              </td>
            </tr>
          </table>

          <div class="divider"></div>

          <div class="meta-box">
            <table>
              <tr>
                <td width="50%"><span class="meta-label">NAMA STAF</span><br><span class="meta-val">${data.nama}</span></td>
                <td width="50%"><span class="meta-label">JABATAN / ROLE</span><br><span class="meta-val">${displayRole}</span></td>
              </tr>
              <tr>
                <td style="padding-top:6px;"><span class="meta-label">PERIODE GAJI</span><br><span class="meta-val">${data.month}</span></td>
                <td style="padding-top:6px;"><span class="meta-label">REKENING PENERIMA</span><br><span class="meta-val">${data.bank || '-'}</span></td>
              </tr>
            </table>
          </div>

          <div class="sec-title">RINCIAN PENGHASILAN (INCOME)</div>
          <table>
            <tr class="item-row"><td>Gaji Pokok</td><td align="right"><b>Rp ${(data.baseSalary || 0).toLocaleString()}</b></td></tr>
            <tr class="item-row"><td>Tunjangan Jabatan</td><td align="right"><b>Rp ${(data.roleAllowance || 0).toLocaleString()}</b></td></tr>
            <tr class="item-row"><td>Uang Makan (${data.hadir || 0} Hari)</td><td align="right"><b>Rp ${(data.mealTotal || 0).toLocaleString()}</b></td></tr>
            ${(data.overtimePay > 0) ? `<tr class="item-row" style="color:#1A4B8B;"><td>Upah Lembur (${data.lemburJam || 0} Jam)</td><td align="right"><b>+ Rp ${data.overtimePay.toLocaleString()}</b></td></tr>` : ''}
          </table>

          <div class="sec-title">POTONGAN (DEDUCTION)</div>
          <table>
            <tr class="item-deduct"><td>Denda Keterlambatan (${data.telat || 0}x)</td><td align="right">- Rp ${(data.latePenaltyTotal || 0).toLocaleString()}</td></tr>
            <tr class="item-deduct"><td>Pinjaman Kasbon</td><td align="right">- Rp ${(data.kasbon || 0).toLocaleString()}</td></tr>
          </table>

          <div class="total-box" style="margin-top:14px;">
            <table>
              <tr>
                <td class="total-label">GAJI BERSIH (TAKE HOME PAY)</td>
                <td class="total-amount">Rp ${(data.takeHomePay || 0).toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <table class="sig-table">
            <tr>
              <td width="50%">Diterbitkan Resmi,<br><br><br><br><span class="sig-name">Finance & HR Management</span></td>
              <td width="50%" align="right">Penerima Manfaat,<br><br><br><br><span class="sig-name" style="text-align:right;">${data.nama}</span></td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff', wordHTML], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.doc`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      hideLoading();
      notify("Sukses", "Slip gaji berhasil diekspor sebagai file Word (DOC).");
    } 
    else if (formatType === "pdf") {
      if (!window.jspdf) throw new Error("Library jsPDF belum dimuat.");
      const { jsPDF } = window.jspdf;
      const docPdf = new jsPDF("p", "pt", "a4");

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(14);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text("AIWA RAGIN JAJE", 45, 52);

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(7.5);
      docPdf.setTextColor(100, 116, 139);
      docPdf.text("PAYROLL DISBURSEMENT SYSTEM · CONFIDENTIAL", 45, 65);

      docPdf.setFillColor(220, 252, 231);
      docPdf.roundedRect(425, 40, 125, 16, 3, 3, "F");
      docPdf.setFontSize(7.5);
      docPdf.setTextColor(22, 163, 74);
      docPdf.text("TERVERIFIKASI SISTEM", 436, 51);

      docPdf.setFont("courier", "normal");
      docPdf.setFontSize(8);
      docPdf.setTextColor(148, 163, 184);
      docPdf.text(docCode, 550, 66, { align: "right" });

      docPdf.setDrawColor(26, 75, 139);
      docPdf.setLineWidth(2.5);
      docPdf.line(45, 78, 550, 78);

      docPdf.setFillColor(248, 250, 252);
      docPdf.setDrawColor(241, 245, 249);
      docPdf.roundedRect(45, 92, 505, 54, 8, 8, "FD");

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(7);
      docPdf.setTextColor(148, 163, 184);
      docPdf.text("NAMA STAF", 58, 108);
      docPdf.text("JABATAN / ROLE", 300, 108);

      docPdf.setFontSize(9);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text(data.nama, 58, 120);
      docPdf.text(displayRole, 300, 120);

      docPdf.setFontSize(7);
      docPdf.setTextColor(148, 163, 184);
      docPdf.text("PERIODE GAJI", 58, 133);
      docPdf.text("REKENING PENERIMA", 300, 133);

      docPdf.setFontSize(9);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text(data.month, 58, 143);
      docPdf.text(data.bank || "-", 300, 143);

      let y = 172;
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(8);
      docPdf.setTextColor(100, 116, 139);
      docPdf.text("RINCIAN PENGHASILAN (INCOME)", 45, y);

      y += 16;
      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(9);
      docPdf.setTextColor(15, 23, 42);

      const incomeList = [
        ["Gaji Pokok", `Rp ${(data.baseSalary || 0).toLocaleString()}`],
        ["Tunjangan Jabatan", `Rp ${(data.roleAllowance || 0).toLocaleString()}`],
        [`Uang Makan (${data.hadir || 0} Hari)`, `Rp ${(data.mealTotal || 0).toLocaleString()}`]
      ];
      if (data.overtimePay > 0) incomeList.push([`Upah Lembur (${data.lemburJam || 0} Jam)`, `+ Rp ${data.overtimePay.toLocaleString()}`]);

      incomeList.forEach(item => {
        docPdf.text(item[0], 48, y);
        docPdf.setFont("helvetica", "bold");
        docPdf.text(item[1], 548, y, { align: "right" });
        docPdf.setFont("helvetica", "normal");
        y += 16;
      });

      y += 6;
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(8);
      docPdf.setTextColor(100, 116, 139);
      docPdf.text("POTONGAN (DEDUCTION)", 45, y);

      y += 16;
      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(9);
      docPdf.setTextColor(239, 68, 68);

      const deductList = [
        [`Denda Keterlambatan (${data.telat || 0}x)`, `- Rp ${(data.latePenaltyTotal || 0).toLocaleString()}`],
        ["Pinjaman Kasbon", `- Rp ${(data.kasbon || 0).toLocaleString()}`]
      ];

      deductList.forEach(item => {
        docPdf.text(item[0], 48, y);
        docPdf.setFont("helvetica", "bold");
        docPdf.text(item[1], 548, y, { align: "right" });
        docPdf.setFont("helvetica", "normal");
        y += 16;
      });

      y += 10;
      docPdf.setFillColor(241, 245, 249);
      docPdf.roundedRect(45, y, 505, 34, 6, 6, "F");

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(9);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text("GAJI BERSIH (TAKE HOME PAY)", 58, y + 21);

      docPdf.setFontSize(12);
      docPdf.setTextColor(26, 75, 139);
      docPdf.text(`Rp ${(data.takeHomePay || 0).toLocaleString()}`, 540, y + 22, { align: "right" });

      y += 68;
      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(8);
      docPdf.setTextColor(100, 116, 139);
      docPdf.text("Diterbitkan Resmi,", 48, y);
      docPdf.text("Penerima Manfaat,", 400, y);

      y += 35;
      docPdf.setDrawColor(15, 23, 42);
      docPdf.setLineWidth(1.2);
      docPdf.line(48, y, 190, y);
      docPdf.line(400, y, 545, y);

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(8.5);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text("Finance & HR Management", 48, y + 10);
      docPdf.text(data.nama, 400, y + 10);

      docPdf.save(`${fileName}.pdf`);
      hideLoading();
      notify("Sukses", "Slip gaji berhasil diunduh sebagai PDF.");
    }
    else if (formatType === "image") {
      const element = document.getElementById("printable-payslip");
      if (!window.html2canvas) throw new Error("Library HTML2Canvas belum siap.");

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true
      });

      const imgData = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.download = `${fileName}.png`;
      a.href = imgData;
      document.body.appendChild(a);
      a.click();
      a.remove();

      hideLoading();
      notify("Sukses", "Slip gaji berhasil diunduh sebagai gambar PNG.");
    }
  } catch (err) {
    hideLoading();
    notify("Gagal Ekspor", err.message);
  }
}

// ==========================================
// 8. MODUL KASBON & COUNTDOWN QRIS 1 JAM
// ==========================================
export function openKasbonForm(actionType) {
  const formBox = document.getElementById("box-form-kasbon");
  const titleEl = document.getElementById("kasbon-form-title");
  const labelEl = document.getElementById("kasbon-input-label");
  const typeInput = document.getElementById("kasbon-action-type");
  const cicilanBox = document.getElementById("box-cicilan-fields");

  if (!formBox) return;

  if (actionType === "pinjam") {
    const currentKPIStatus = document.getElementById("kpi-status-tag")?.innerText?.trim().toLowerCase() || "kurang";
    const currentKPIScore = document.getElementById("kpi-score-badge")?.innerText?.trim() || "0%";

    if (currentKPIStatus !== "memuaskan") {
      return notify(
        "Akses Kasbon Terkunci",
        `Pengajuan kasbon hanya dapat diakses oleh karyawan dengan performa KPI MEMUASKAN (>85%).\n\nStatus KPI Anda saat ini: ${currentKPIStatus.toUpperCase()} (${currentKPIScore}). Tingkatkan kehadiran dan kepatuhan tugas harian Anda untuk membuka hak fasilitas kasbon.`
      );
    }

    titleEl.innerText = "Formulir Pengajuan Pinjaman Kasbon";
    labelEl.innerText = "TOTAL NOMINAL PINJAMAN (RP)";
    if (cicilanBox) cicilanBox.classList.remove("hidden");
  } else {
    titleEl.innerText = "Formulir Pembayaran / Setoran Kasbon";
    labelEl.innerText = "NOMINAL YANG DIBAYARKAN (RP)";
    if (cicilanBox) cicilanBox.classList.add("hidden");
  }

  typeInput.value = actionType;
  document.getElementById("kasbon-amount-input").value = "";
  document.getElementById("kasbon-notes-input").value = "";
  formBox.classList.remove("hidden");
}

export async function loadKasbonAccountSummary() {
  const user = auth.currentUser;
  if (!user) return;

  const displaySisa = document.getElementById("display-sisa-kasbon");
  const displayPinjaman = document.getElementById("display-total-pinjaman");
  const displayPelunasan = document.getElementById("display-total-pelunasan");
  const historyList = document.getElementById("kasbon-history-list");

  try {
    const snap = await getDocs(query(
      collection(db, "employee_requests"),
      where("uid", "==", user.uid)
    ));

    let totalPinjaman = 0;
    let totalPelunasan = 0;
    let transactions = [];
    const now = Date.now();

    for (const docSnap of snap.docs) {
      const item = { id: docSnap.id, ...docSnap.data() };
      if (item.type === "Kasbon" || item.type === "Bayar Kasbon") {
        
        // HANGUS OTOMATIS JIKA MELEWATI 1 JAM (60 MENIT)
        if (item.status === "Pending" && item.expires_at_millis && now > item.expires_at_millis) {
          item.status = "Expired";
          item.expired_at_millis = item.expires_at_millis;
          setDoc(doc(db, "employee_requests", item.id), { status: "Expired", expired_at_millis: now }, { merge: true }).catch(() => {});
        }

        // HAPUS OTOMATIS SETELAH 1 MENIT DARI STATUS EXPIRED
        if (item.status === "Expired" && item.expired_at_millis && (now - item.expired_at_millis > 60 * 1000)) {
          deleteDoc(doc(db, "employee_requests", item.id)).catch(() => {});
          continue;
        }

        transactions.push(item);

        if (item.type === "Kasbon" && item.status === "Approved") {
          totalPinjaman += Number(item.amount || 0);
          totalPelunasan += Number(item.total_paid || 0);
        } else if (item.type === "Bayar Kasbon" && item.status === "Approved") {
          totalPelunasan += Number(item.amount || 0);
        } else if (item.type === "Kasbon" && item.status === "Settled") {
          totalPinjaman += Number(item.amount || 0);
          totalPelunasan += Number(item.amount || 0);
        }
      }
    }

    const sisaKasbon = Math.max(0, totalPinjaman - totalPelunasan);

    if (displaySisa) displaySisa.innerText = `Rp ${sisaKasbon.toLocaleString()}`;
    if (displayPinjaman) displayPinjaman.innerText = `Rp ${totalPinjaman.toLocaleString()}`;
    if (displayPelunasan) displayPelunasan.innerText = `Rp ${totalPelunasan.toLocaleString()}`;

    if (!historyList) return;
    if (transactions.length === 0) {
      historyList.innerHTML = "<p class='placeholder-text'>Belum ada transaksi kasbon.</p>";
      return;
    }

    transactions.sort((a, b) => (b.requested_millis || 0) - (a.requested_millis || 0));

    historyList.innerHTML = transactions.map(t => {
      const isPinjam = t.type === "Kasbon";
      const color = isPinjam ? "#ff9500" : "#34c759";
      const prefix = isPinjam ? "+ Rp " : "- Rp ";
      const cicilanMeta = isPinjam ? `<small style="display:block; font-size:0.52rem; color:var(--text-accent);">Cicilan: Rp ${Number(t.monthly_installment || t.amount).toLocaleString()} / bln (${t.tenor_months || 1} Bln)</small>` : '';

      let statusDisplayColor = "#ff9500";
      if (t.status === "Approved") statusDisplayColor = "#34c759";
      if (t.status === "Expired" || t.status === "Rejected") statusDisplayColor = "#ff3b30";

      const showQRISBtn = (t.status === "Pending" && t.voucher_code) 
        ? `<button type="button" class="btn-primary" style="padding:4px 8px; font-size:0.58rem; margin-top:4px;" onclick="showKasbonQRISModal('${t.voucher_code}', ${t.expires_at_millis}, ${JSON.stringify(t).replace(/"/g, '&quot;')})">Tampilkan QRIS</button>` 
        : '';

      return `
        <div style="padding: 10px 0; border-bottom: 0.5px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div style="text-align:left;">
            <strong style="font-size: 0.72rem; color: var(--text-primary);">${t.type}</strong>
            <small style="display: block; font-size: 0.58rem; color: var(--text-secondary);">${t.note || '-'}</small>
            ${cicilanMeta}
            <small style="font-size: 0.55rem; color: ${statusDisplayColor}; font-weight: 700; display:block; margin-top:2px;">Status: ${t.status.toUpperCase()}</small>
            ${showQRISBtn}
          </div>
          <strong style="font-size: 0.82rem; color: ${color};">${prefix}${Number(t.amount || 0).toLocaleString()}</strong>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.warn("Gagal load kasbon:", err);
  }
}

export function showKasbonQRISModal(voucherCode, expiresAtMillis, transData) {
  const modal = document.getElementById("qris-kasbon-modal");
  const codeEl = document.getElementById("kasbon-voucher-code-display");
  const qrContainer = document.getElementById("qrcode-kasbon-container");
  const timerEl = document.getElementById("kasbon-countdown-timer");

  if (codeEl) codeEl.innerText = voucherCode;

  if (qrContainer) {
    qrContainer.innerHTML = "";
    if (window.QRCode) {
      state.qrCodeKasbonInstance = new QRCode(qrContainer, {
        text: JSON.stringify({
          app: "MYAIWA_KASBON",
          code: voucherCode,
          uid: transData.uid,
          nama: transData.nama,
          amount: transData.amount,
          type: transData.type,
          exp: expiresAtMillis
        }),
        width: 160,
        height: 160,
        colorDark: "#ff9500",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  if (state.qrCountdownInterval) clearInterval(state.qrCountdownInterval);

  function updateTimer() {
    const remaining = expiresAtMillis - Date.now();
    if (remaining <= 0) {
      clearInterval(state.qrCountdownInterval);
      if (timerEl) timerEl.innerText = "KODE TELAH KEDALUWARSA (EXPIRED)";
      loadKasbonAccountSummary();
      return;
    }
    const mins = Math.floor(remaining / (1000 * 60));
    const secs = Math.floor((remaining % (1000 * 60)) / 1000);
    if (timerEl) {
      timerEl.innerText = `Berlaku: ${String(mins).padStart(2, '0')} Menit ${String(secs).padStart(2, '0')} Detik`;
    }
  }

  updateTimer();
  state.qrCountdownInterval = setInterval(updateTimer, 1000);

  modal?.classList.remove("hidden");
}

export function closeKasbonQRISModal() {
  if (state.qrCountdownInterval) clearInterval(state.qrCountdownInterval);
  document.getElementById("qris-kasbon-modal")?.classList.add("hidden");
}

// ==========================================
// 9. WORKFLOW PERSETUJUAN & APPROVAL PENGAJUAN
// ==========================================
export async function loadHRRequestsList() {
  const listEl = document.getElementById("hr-requests-list");
  if (!listEl) return;

  try {
    const snap = await getDocs(query(collection(db, "employee_requests"), limit(40)));
    listEl.innerHTML = "";
    if (snap.empty) {
      listEl.innerHTML = "<p class='placeholder-text'>Belum ada pengajuan staf.</p>";
      return;
    }

    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    for (const d of snap.docs) {
      const item = d.data();
      const docId = d.id;

      const reqTime = item.requested_millis || (item.requested_at?.toDate ? item.requested_at.toDate().getTime() : 0);

      if ((item.status === "Approved" || item.status === "Expired") && reqTime > 0 && reqTime < oneDayAgo) {
        deleteDoc(doc(db, "employee_requests", docId)).catch(() => {});
        continue;
      }

      let currentItemStatus = item.status;
      if (item.status === "Pending" && item.expires_at_millis && now > item.expires_at_millis) {
        currentItemStatus = "Expired";
        setDoc(doc(db, "employee_requests", docId), { status: "Expired", expired_at_millis: now }, { merge: true }).catch(() => {});
      }

      const div = document.createElement("div");
      div.className = "request-item-row";

      const isPending = currentItemStatus === "Pending";
      const isSalaryClaim = item.type === "Tarik Gaji";

      let statusColor = "#ff9500";
      if (currentItemStatus === "Approved") statusColor = "#34c759";
      if (currentItemStatus === "Rejected" || currentItemStatus === "Expired") statusColor = "#ff3b30";

      div.innerHTML = `
        <div class="request-item-info">
          <strong>${item.nama} [${item.type}]</strong>
          <small class="text-muted-xs">${isSalaryClaim ? 'Take Home Pay: Rp ' + Number(item.amount).toLocaleString() : 'Rp ' + Number(item.amount || 0).toLocaleString()} · ${item.note}</small>
          <small class="mt-1">Status: <b style="color:${statusColor}">${currentItemStatus}</b></small>
        </div>
        <div class="request-action-group">
          ${isPending ? `
            <button type="button" class="btn-approve-action" onclick="approveDisbursement('${docId}', '${item.uid}', '${item.month || ''}')">
              ${isSalaryClaim ? 'Cairkan' : 'Setujui'}
            </button>
            <button type="button" class="btn-reject-action" onclick="updateRequestStatus('${docId}', 'Rejected')">
              Tolak
            </button>
          ` : `<span class="badge-completed" style="background:${statusColor}22; color:${statusColor};">${currentItemStatus}</span>`}
        </div>
      `;
      listEl.appendChild(div);
    }
  } catch (e) {
    listEl.innerHTML = `<p class='placeholder-text' style='color:#ff3b30;'>Gagal memuat pengajuan: ${e.message}</p>`;
  }
}

export async function approveDisbursement(requestId, userId, monthStr) {
  showLoading("Memvalidasi pengajuan...");
  try {
    await setDoc(doc(db, "employee_requests", requestId), { 
      status: "Approved",
      disbursement_status: "Paid",
      approved_at: serverTimestamp() 
    }, { merge: true });

    if (userId && monthStr) {
      await setDoc(doc(db, "salary_slips_archive", `${userId}_${monthStr}`), {
        disbursement_status: "Paid"
      }, { merge: true });
    }

    hideLoading();
    notify("Sukses", "Pengajuan berhasil disetujui / divalidasi.");
    loadHRRequestsList();
    loadKasbonAccountSummary();
  } catch (err) {
    hideLoading();
    notify("Gagal Validasi", err.message);
  }
}

export async function updateRequestStatus(docId, newStatus) {
  showLoading(`Mengubah status pengajuan...`);
  try {
    await setDoc(doc(db, "employee_requests", docId), { status: newStatus }, { merge: true });
    hideLoading();
    notify("Sukses", `Pengajuan berhasil di-${newStatus}.`);
    loadHRRequestsList();
    loadKasbonAccountSummary();
  } catch (e) { 
    hideLoading();
    notify("Gagal", e.message); 
  }
}
