/* ==========================================================================
   SRC/PAYROLL-KASBON.JS - LOGIKA FINANCE (GAJI, KASBON & SLIP)
   MYAIWA - AIWA RAGIN JAJE SYSTEM
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
  onSnapshot,
  serverTimestamp, 
  query, 
  where, 
  limit,
  writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { 
  state, 
  ROLE_DISPLAY_NAMES, 
  DEFAULT_ROLE_PARAMS, 
  CAREER_ALLOWANCE_PRESETS,
  PAYROLL_TERMS 
} from "./constants.js";

import { 
  showLoading, 
  hideLoading, 
  notify, 
  showCustomConfirm, 
  calculateLateThresholdTime, 
  navigateToTab,
  openHRSubPage,
  formatRupiah,
  getLocalDateWITA 
} from "./utils.js";

let isSubmittingKasbonLock = false;
let hrRequestsCountdownTimer = null;
let kasbonHistoryCountdownTimer = null;
let activeQRISSnapshotUnsub = null;

function formatShortDateTime(millis) {
  if (!millis) return "-";
  const d = new Date(millis);
  const dateStr = d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  const timeStr = d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).replace(/\./g, ':');
  return `${dateStr}, ${timeStr} WITA`;
}

// ==========================================
// 1. KOMPILASI SLIP GAJI (BEBAS COMPOSITE INDEX)
// ==========================================
export async function compileEmployeeSlip(userId, monthStr, customTerm = null) {
  const [userDoc, salDoc, attSnap, reqSnap] = await Promise.all([
    getDoc(doc(db, "users", userId)),
    getDoc(doc(db, "salary_structures", userId)),
    getDocs(query(
      collection(db, "attendance"),
      where("uid", "==", userId)
    )),
    getDocs(query(
      collection(db, "employee_requests"), 
      where("uid", "==", userId)
    ))
  ]);

  const userData = userDoc.exists() ? userDoc.data() : {};
  const salData = salDoc.exists() ? salDoc.data() : { base_salary: 0, role_allowance: 0, meal_daily: 15000, bank_account: "-", payroll_term: "termin_1" };
  const userRoleKey = String(userData.role || 'staff').toLowerCase();
  const roleCfg = state.roleParamsCache[userRoleKey] || DEFAULT_ROLE_PARAMS[userRoleKey] || DEFAULT_ROLE_PARAMS.staff;

  const payrollTermKey = customTerm || salData.payroll_term || userData.payroll_term || "termin_1";
  const terminConfig = PAYROLL_TERMS[payrollTermKey] || PAYROLL_TERMS.termin_1;

  let hadirCount = 0;
  let lateCount = 0;
  let totalOvertimeHours = 0;

  const toleranceMinutes = Number(roleCfg.tolerance ?? 15);

  attSnap.forEach(d => {
    const item = d.data();
    if (item.date && item.date.startsWith(monthStr) && item.status === "Hadir") {
      hadirCount++;
      
      const itemShift = item.shift || "pagi";
      let baseStart = roleCfg.pagi_start || "07:30";
      let baseEnd = roleCfg.pagi_end || "15:30";

      if (itemShift === "malam") {
        baseStart = roleCfg.malam_start || "13:30";
        baseEnd = roleCfg.malam_end || "21:00";
      } else if (itemShift === "it_flex") {
        baseStart = roleCfg.it_threshold || "10:00";
        baseEnd = "18:00";
      }

      const lateThresholdTime = calculateLateThresholdTime(baseStart, toleranceMinutes);

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
    payroll_term: payrollTermKey,
    termin_label: terminConfig.name,
    bank: salData.bank_account || `${salData.bank_name || 'BCA'} - ${salData.bank_number || '-'} a.n ${salData.bank_holder || userData.nama || '-'}`,
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
// 2. SLIP BULAN BERJALAN & KUNCI SLIP
// ==========================================
export async function openMyCurrentPayslip() {
  const user = auth.currentUser;
  if (!user) return notify("Perhatian", "Silakan login terlebih dahulu.");

  const currentMonth = getLocalDateWITA().slice(0, 7);
  showLoading();

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const salDoc = await getDoc(doc(db, "salary_structures", user.uid));
    const userTerm = salDoc.exists() ? (salDoc.data().payroll_term || "termin_1") : (userDoc.data()?.payroll_term || "termin_1");

    let slipDoc = await getDoc(doc(db, "salary_slips_archive", `${user.uid}_${currentMonth}_${userTerm}`));
    if (!slipDoc.exists()) {
      slipDoc = await getDoc(doc(db, "salary_slips_archive", `${user.uid}_${currentMonth}`));
    }

    let slipData;
    if (slipDoc.exists()) {
      slipData = slipDoc.data();
    } else {
      slipData = await compileEmployeeSlip(user.uid, currentMonth, userTerm);
    }

    openPayslipDetail(slipData);
  } catch (err) {
    notify("Gagal Memuat Slip", err.message);
  } finally {
    hideLoading();
  }
}

export async function lockAndPublishMonthlySlips() {
  const monthStr = document.getElementById("publish-month-picker")?.value;
  const targetTerm = document.getElementById("publish-termin-picker")?.value || "all";

  if (!monthStr) return notify("Perhatian", "Pilih bulan penerbitan slip.");

  const termText = targetTerm === "all" ? "Semua Termin (Termin 1 & 2)" : (targetTerm === "termin_2" ? "Khusus Termin 2 (Tgl 15)" : "Khusus Termin 1 (Tgl 1)");
  const confirmPublish = await showCustomConfirm(
    "Kunci & Terbitkan Slip", 
    `Terbitkan slip gaji resmi periode ${monthStr} untuk [${termText}]?`
  );
  if (!confirmPublish) return;

  showLoading();

  try {
    const [usersSnap, salSnap, reqSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "salary_structures")),
      getDocs(collection(db, "employee_requests"))
    ]);

    const salMap = {};
    salSnap.forEach(d => salMap[d.id] = d.data());

    const batch = writeBatch(db);
    let count = 0;
    const nowTimestamp = serverTimestamp();

    for (const uDoc of usersSnap.docs) {
      const uid = uDoc.id;
      const uData = uDoc.data();
      const sData = salMap[uid] || {};
      const userTerm = sData.payroll_term || uData.payroll_term || "termin_1";

      if (targetTerm !== "all" && userTerm !== targetTerm) continue;

      const slipPayload = await compileEmployeeSlip(uid, monthStr, userTerm);
      slipPayload.published_at = nowTimestamp;

      for (const rDoc of reqSnap.docs) {
        const r = rDoc.data();
        if (r.uid === uid && r.type === "Kasbon" && r.status === "Approved") {
          const sisaPokok = (Number(r.amount) || 0) - (Number(r.total_paid) || 0);
          if (sisaPokok > 0) {
            const cicilan = Number(r.monthly_installment) || sisaPokok;
            const potonganEfektif = Math.min(sisaPokok, cicilan);
            const totalPaidBaru = (Number(r.total_paid) || 0) + potonganEfektif;
            const isLunas = ((Number(r.amount) || 0) - totalPaidBaru) <= 0;

            const reqRef = doc(db, "employee_requests", rDoc.id);

            if (isLunas) {
              batch.delete(reqRef);
            } else {
              batch.update(reqRef, {
                total_paid: totalPaidBaru,
                installment_paid_count: (Number(r.installment_paid_count) || 0) + 1,
                status: "Approved",
                last_deducted_month: monthStr,
                last_deducted_termin: userTerm
              });
            }
          }
        }
      }

      const slipRefTerm = doc(db, "salary_slips_archive", `${uid}_${monthStr}_${userTerm}`);
      const slipRefBase = doc(db, "salary_slips_archive", `${uid}_${monthStr}`);
      batch.set(slipRefTerm, slipPayload, { merge: true });
      batch.set(slipRefBase, slipPayload, { merge: true });
      count++;
    }

    if (count === 0) {
      hideLoading();
      return notify("Perhatian", "Tidak ada data karyawan yang cocok dengan termin yang dipilih.");
    }

    await batch.commit();
    hideLoading();
    notify("Sukses", `Berhasil mengunci dan menerbitkan ${count} slip gaji periode ${monthStr} (${termText}).`);
  } catch (err) {
    hideLoading();
    notify("Gagal Menerbitkan Slip", err.message);
  }
}

// ==========================================
// 3. RIWAYAT ARSIP SLIP GAJI
// ==========================================
export async function renderUserSlipHistory() {
  const user = auth.currentUser;
  const container = document.getElementById("user-slip-history-container") || document.getElementById("user-slip-history-list");
  if (!container) return;

  if (!user) {
    container.innerHTML = "<p class='placeholder-text'>Silakan login untuk melihat arsip slip.</p>";
    return;
  }

  container.innerHTML = "<p class='placeholder-text'>Memuat arsip slip gaji...</p>";

  try {
    const snap = await getDocs(query(
      collection(db, "salary_slips_archive"),
      where("uid", "==", user.uid),
      limit(30)
    ));

    if (snap.empty) {
      container.innerHTML = "<p class='placeholder-text'>Belum ada arsip slip gaji resmi.</p>";
      return;
    }

    let slips = [];
    snap.forEach(d => slips.push({ id: d.id, ...d.data() }));
    slips.sort((a, b) => (b.month || "").localeCompare(a.month || ""));

    container.innerHTML = slips.map(slip => {
      const termLabel = slip.termin_label || (slip.payroll_term === "termin_2" ? "Termin 2 (Tgl 15)" : "Termin 1 (Tgl 1)");
      const thpVal = slip.takeHomePay !== undefined ? slip.takeHomePay : (slip.thp || 0);

      return `
        <div class="picker-user-row" style="margin-bottom: 6px; cursor: pointer;" onclick="openPayslipDetail(${JSON.stringify(slip).replace(/"/g, '&quot;')})">
          <div class="picker-user-meta">
            <strong>Periode: ${slip.month || "-"} · <span style="color:var(--text-accent);">${termLabel}</span></strong>
            <small>Take Home Pay: <b>${formatRupiah(thpVal)}</b></small>
          </div>
          <button type="button" class="btn-primary" style="padding:4px 8px; font-size:0.6rem; flex-shrink:0;">Buka Slip</button>
        </div>
      `;
    }).join("");
  } catch (e) {
    container.innerHTML = `<p class='placeholder-text text-danger'>Gagal memuat: ${e.message}</p>`;
  }
}

export function openPayslipDetail(data) {
  if (!data) return;
  state.currentPayslipCache = data;

  const rawRole = String(data.role || 'staff').toLowerCase();
  const displayRole = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();
  const termLabel = data.termin_label || (data.payroll_term === "termin_2" ? "Termin 2 (Tanggal 15)" : "Termin 1 (Tanggal 1)");
  const thpVal = data.takeHomePay !== undefined ? data.takeHomePay : (data.thp || 0);

  state.activeCalculatedTHP = thpVal;
  state.activeSlipPeriod = data.month || getLocalDateWITA().slice(0, 7);

  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  setTxt("payslip-termin-badge", termLabel.toUpperCase());
  setTxt("payslip-period-label", `Periode: ${data.month || '-'} (${termLabel})`);
  setTxt("payslip-employee-meta", `${data.nama || 'Karyawan'} [${displayRole}]`);

  setTxt("slip-val-base", formatRupiah(data.baseSalary || data.base_salary || 0));
  setTxt("slip-label-meal", `Uang Makan (${data.hadir || data.hadir_days || 0} Hari):`);
  setTxt("slip-val-meal", formatRupiah(data.mealTotal || data.meal_total || 0));
  setTxt("slip-val-allowance", formatRupiah(data.roleAllowance || data.allowance || 0));
  setTxt("slip-val-overtime", formatRupiah(data.overtimePay || data.overtime || 0));

  setTxt("slip-label-late", `Keterlambatan (${data.telat || data.late_count || 0}x):`);
  setTxt("slip-val-late", formatRupiah(data.latePenaltyTotal || data.late_penalty || 0));
  setTxt("slip-val-kasbon", formatRupiah(data.kasbon || data.kasbon_deduction || 0));
  setTxt("slip-val-thp", formatRupiah(thpVal));

  navigateToTab('payslip-page', true);
}

// ==========================================
// 4. KLAIM & PENCAIRAN GAJI
// ==========================================
export async function openClaimSalaryPage() {
  if (!state.currentPayslipCache) return notify("Perhatian", "Data slip tidak ditemukan.");
  
  if (state.currentPayslipCache.disbursement_status === "Claimed" || state.currentPayslipCache.disbursement_status === "Paid") {
    return notify("Informasi", "Gaji periode ini sudah dicairkan.");
  }

  try {
    const salDoc = await getDoc(doc(db, "salary_structures", state.currentPayslipCache.uid));
    const registeredAcc = salDoc.exists() ? (salDoc.data().bank_account || `${salDoc.data().bank_name} - ${salDoc.data().bank_number}`) : "-";
    
    const regLabelEl = document.getElementById("claim-bank-account-target");
    if (regLabelEl) {
      regLabelEl.innerText = registeredAcc !== "-" ? registeredAcc : "Belum didaftarkan oleh GM";
    }

    const totalEl = document.getElementById("claim-total-amount-display");
    if (totalEl) totalEl.innerText = formatRupiah(state.currentPayslipCache.takeHomePay || state.currentPayslipCache.thp || 0);

    const periodEl = document.getElementById("claim-period-display");
    if (periodEl) periodEl.innerText = `Periode: ${state.currentPayslipCache.month}`;
  } catch (e) {
    console.warn("Gagal memuat rekening terdaftar:", e);
  }

  selectDisbursementMethod("transfer");
  navigateToTab("claim-salary");
}

export function selectDisbursementMethod(method) {
  state.selectedDisbursementType = method;
  const cardCash = document.getElementById("method-card-tunai");
  const cardTransfer = document.getElementById("method-card-transfer");
  const boxTransfer = document.getElementById("box-claim-bank-info");

  if (method === "tunai") {
    cardCash?.classList.add("active-method");
    cardTransfer?.classList.remove("active-method");
    boxTransfer?.classList.add("hidden");
  } else {
    cardTransfer?.classList.add("active-method");
    cardCash?.classList.remove("active-method");
    boxTransfer?.classList.remove("hidden");
  }
}

export async function submitSalaryDisbursement(e) {
  if (e) e.preventDefault();
  if (!state.currentPayslipCache) return;
  const user = auth.currentUser;
  if (!user) return;

  const now = Date.now();
  const expiresAtMillis = now + (24 * 60 * 60 * 1000);
  const termSuffix = state.currentPayslipCache.payroll_term === "termin_2" ? "T2" : "T1";
  const slipKey = `${state.currentPayslipCache.uid}_${state.currentPayslipCache.month}_${state.currentPayslipCache.payroll_term || 'termin_1'}`;
  const voucherCode = `AIWA-${(state.currentPayslipCache.month || '202608').replace("-", "")}-${termSuffix}-${Math.floor(1000 + Math.random() * 9000)}`;

  showLoading();

  try {
    const claimPayload = {
      uid: user.uid,
      nama: state.currentPayslipCache.nama,
      role: state.currentPayslipCache.role,
      month: state.currentPayslipCache.month,
      payroll_term: state.currentPayslipCache.payroll_term || "termin_1",
      termin_label: state.currentPayslipCache.termin_label || "Termin 1",
      amount: state.currentPayslipCache.takeHomePay || state.currentPayslipCache.thp,
      method: state.selectedDisbursementType || "transfer",
      voucher_code: voucherCode,
      note: `Pencairan ${(state.selectedDisbursementType || 'transfer').toUpperCase()} (${state.currentPayslipCache.termin_label || 'Termin 1'})`,
      disbursement_status: state.selectedDisbursementType === "tunai" ? "Waiting_Cash_Scan" : "Pending_Transfer",
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
      disbursement_method: claimPayload.method,
      voucher_code: voucherCode,
      expires_at_millis: expiresAtMillis
    }, { merge: true });

    state.currentPayslipCache.disbursement_status = claimPayload.disbursement_status;
    state.currentPayslipCache.voucher_code = voucherCode;
    state.currentPayslipCache.expires_at_millis = expiresAtMillis;

    hideLoading();

    if (claimPayload.method === "tunai") {
      showQRReceipt(voucherCode, state.currentPayslipCache);
    } else {
      notify("Pengajuan Terkirim", "Pengajuan transfer telah diteruskan ke GM.");
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
    expiryEl.innerHTML = `Batas Berlaku: <b style="color:#ef4444;">${expDateStr}, ${expTimeStr} WITA (1x24 Jam)</b>`;
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
          term: slipData.payroll_term || "termin_1",
          thp: slipData.takeHomePay || slipData.thp,
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
// 5. SISTEM KASBON DENGAN PLAFON TIERING
// ==========================================
export function getKasbonTierLimits(userData) {
  const level = String(userData.career_level || "Junior").toLowerCase();
  const rawRole = String(userData.role || "staff").toLowerCase();
  const baseSalary = Number(userData.salary_base ?? (userData.base_salary ?? 2500000));

  let maxPercent = 0.30;
  let maxTenor = 1;

  if (rawRole === "it") {
    maxPercent = 0.80;
    maxTenor = 3;
  } else if (level.includes("lead") || rawRole === "gm") {
    maxPercent = 0.70;
    maxTenor = 3;
  } else if (level.includes("senior")) {
    maxPercent = 0.50;
    maxTenor = 2;
  }

  const maxPlafon = Math.floor(baseSalary * maxPercent);
  return { maxPlafon, maxTenor, maxPercent, levelTitle: rawRole === "it" ? "IT Specialist" : (userData.career_level || "Junior") };
}

export function openKasbonForm(actionType) {
  const formBox = document.getElementById("box-form-kasbon");
  const titleEl = document.getElementById("kasbon-form-title");
  const labelEl = document.getElementById("kasbon-amount-label");
  const typeInput = document.getElementById("kasbon-action-type");
  const cicilanBox = document.getElementById("box-kasbon-tenor-wrapper");
  const tenorSelect = document.getElementById("kasbon-tenor-months");
  const submitBtn = document.getElementById("btn-submit-kasbon-form");
  const uData = state.currentUserData || {};
  const userRole = String(uData.role || "staff").toLowerCase();

  if (!formBox) return;

  if (actionType === "pinjam") {
    const isITAccount = userRole === "it";
    const currentKPIStatus = document.getElementById("kpi-status-tag")?.innerText?.trim().toLowerCase() || "memuaskan";
    const currentKPIScore = document.getElementById("kpi-score-badge")?.innerText?.trim() || "100%";

    if (!isITAccount && currentKPIStatus === "kurang") {
      return notify(
        "Akses Kasbon Terkunci",
        `Pengajuan pinjaman kasbon membutuhkan performa kehadiran KPI yang baik.\n\nStatus KPI Anda saat ini: ${currentKPIStatus.toUpperCase()} (${currentKPIScore}).`
      );
    }

    const { maxPlafon, maxTenor, levelTitle } = getKasbonTierLimits(uData);

    if (titleEl) titleEl.innerText = `Pengajuan Pinjaman Kasbon [${levelTitle}]`;
    if (labelEl) labelEl.innerText = `NOMINAL PINJAMAN (MAKS ${formatRupiah(maxPlafon)})`;
    if (cicilanBox) cicilanBox.classList.remove("hidden");

    if (tenorSelect) {
      tenorSelect.innerHTML = "";
      for (let m = 1; m <= maxTenor; m++) {
        const opt = document.createElement("option");
        opt.value = String(m);
        opt.innerText = m === 1 ? "1 Bulan (Lunas Langsung)" : `${m} Bulan (${m}x Potong Gaji)`;
        tenorSelect.appendChild(opt);
      }
    }

    if (submitBtn) submitBtn.innerText = "Kirim Pengajuan Kasbon";
  } else {
    const sisaKasbonAktif = Number(state.currentUserKasbonBalance ?? 0);
    const balanceText = document.getElementById("kasbon-current-balance-display")?.innerText || "Rp 0";
    const balanceParsed = parseInt(balanceText.replace(/[^0-9]/g, "")) || 0;

    if (sisaKasbonAktif <= 0 && balanceParsed <= 0) {
      return notify("Informasi", "Anda tidak memiliki kasbon aktif.");
    }

    if (titleEl) titleEl.innerText = "Formulir Setor Kasbon";
    if (labelEl) labelEl.innerText = "NOMINAL SETORAN (RP)";
    if (cicilanBox) cicilanBox.classList.add("hidden");
    if (submitBtn) submitBtn.innerText = "Kirim Setoran Kasbon";
  }

  if (typeInput) typeInput.value = actionType;
  const amtInput = document.getElementById("kasbon-amount-input");
  const noteInput = document.getElementById("kasbon-notes-input");
  if (amtInput) amtInput.value = "";
  if (noteInput) noteInput.value = "";

  calculateKasbonInstallment();
  formBox.classList.remove("hidden");
  formBox.scrollIntoView({ behavior: "smooth" });
}

export function closeKasbonForm() {
  document.getElementById("box-form-kasbon")?.classList.add("hidden");
}

export function calculateKasbonInstallment() {
  const amount = Number(document.getElementById("kasbon-amount-input")?.value || 0);
  const tenor = Number(document.getElementById("kasbon-tenor-months")?.value || 1);
  const monthlyDisplay = document.getElementById("kasbon-monthly-installment");
  if (!monthlyDisplay) return;

  const installment = Math.ceil(amount / tenor);
  monthlyDisplay.value = formatRupiah(installment);
}

export async function submitKasbonTransaction(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  if (isSubmittingKasbonLock) return;

  const user = auth.currentUser;
  if (!user) return;

  const uData = state.currentUserData || {};
  const actionType = document.getElementById("kasbon-action-type")?.value || "pinjam";
  const amount = Number(document.getElementById("kasbon-amount-input")?.value || 0);
  const tenor = Number(document.getElementById("kasbon-tenor-months")?.value || 1);
  const notes = document.getElementById("kasbon-notes-input")?.value.trim();
  const submitBtn = document.getElementById("btn-submit-kasbon-form");

  if (amount < 10000) return notify("Perhatian", "Nominal minimal transaksi adalah Rp 10.000.");
  if (!notes) return notify("Perhatian", "Tuliskan keterangan keperluan.");

  if (actionType === "pinjam") {
    const { maxPlafon, levelTitle } = getKasbonTierLimits(uData);
    if (amount > maxPlafon) {
      return notify(
        "Melebihi Plafon Maksimal",
        `Batas pinjaman kasbon untuk level ${levelTitle} adalah ${formatRupiah(maxPlafon)}.\nSilakan sesuaikan nominal yang Anda ajukan.`
      );
    }
  }

  isSubmittingKasbonLock = true;
  if (submitBtn) submitBtn.disabled = true;
  showLoading();

  try {
    const todayStr = getLocalDateWITA();
    const typeLabel = actionType === "pinjam" ? "Kasbon" : "Bayar Kasbon";
    const now = Date.now();
    const expiresAtMillis = now + (60 * 60 * 1000);
    const prefixCode = actionType === "pinjam" ? "KB" : "BYR";
    const voucherCode = `${prefixCode}-${todayStr.replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const transPayload = {
      uid: user.uid,
      nama: uData.nama || user.email,
      role: String(uData.role || "staff").toLowerCase(),
      career_level: uData.career_level || "Junior",
      type: typeLabel,
      amount: amount,
      tenor_months: actionType === "pinjam" ? tenor : 1,
      monthly_installment: actionType === "pinjam" ? Math.ceil(amount / tenor) : 0,
      installment_paid_count: 0,
      total_paid: 0,
      note: notes,
      voucher_code: voucherCode,
      status: "Pending",
      requested_at: serverTimestamp(),
      requested_millis: now,
      expires_at_millis: expiresAtMillis
    };

    const docRef = await addDoc(collection(db, "employee_requests"), transPayload);

    closeKasbonForm();
    hideLoading();

    openKasbonQRISPage(voucherCode, expiresAtMillis, transPayload, docRef.id);
    loadKasbonAccountSummary();
  } catch (err) {
    hideLoading();
    notify("Gagal Transaksi", err.message);
  } finally {
    setTimeout(() => {
      isSubmittingKasbonLock = false;
      if (submitBtn) submitBtn.disabled = false;
    }, 800);
  }
}

export async function loadKasbonAccountSummary() {
  const user = auth.currentUser;
  if (!user) return;

  const displaySisa = document.getElementById("kasbon-current-balance-display");
  const displayPinjaman = document.getElementById("kasbon-total-borrowed-display");
  const displayPelunasan = document.getElementById("kasbon-total-repaid-display");
  const historyList = document.getElementById("kasbon-history-list");

  try {
    const snap = await getDocs(query(
      collection(db, "employee_requests"),
      where("uid", "==", user.uid)
    ));

    let totalPinjaman = 0;
    let totalPelunasan = 0;
    let rawItems = [];
    const now = Date.now();
    const batch = writeBatch(db);
    let hasExpiredBatch = false;

    for (const docSnap of snap.docs) {
      const item = { id: docSnap.id, ...docSnap.data() };
      if (item.type === "Kasbon" || item.type === "Bayar Kasbon") {
        
        // Auto-Expired QRIS
        if (item.status === "Pending" && item.expires_at_millis && now > item.expires_at_millis) {
          item.status = "Expired";
          item.expired_at_millis = item.expires_at_millis;
          batch.update(doc(db, "employee_requests", item.id), { status: "Expired", expired_at_millis: now });
          hasExpiredBatch = true;
        }

        // Auto-Delete Rejected dalam 1 Menit
        if (item.status === "Rejected") {
          const deleteAt = (item.rejected_at_millis || item.requested_millis || now) + 60000;
          if (now >= deleteAt) {
            deleteDoc(doc(db, "employee_requests", item.id)).catch(() => {});
            continue;
          }
        }

        // Akumulasi Total Pinjaman & Pelunasan
        if (item.type === "Kasbon" && (item.status === "Approved" || item.status === "Settled")) {
          totalPinjaman += Number(item.amount || 0);
          totalPelunasan += Number(item.total_paid || 0);
        } else if (item.type === "Bayar Kasbon" && (item.status === "Approved" || item.status === "Settled")) {
          totalPelunasan += Number(item.amount || 0);
        }

        rawItems.push(item);
      }
    }

    if (hasExpiredBatch) {
      batch.commit().catch(console.warn);
    }

    const sisaKasbon = Math.max(0, totalPinjaman - totalPelunasan);
    state.currentUserKasbonBalance = sisaKasbon;

    // HAPUS PERMANEN DOKUMEN JIKA SALDO LUNAS TOTAL
    if (sisaKasbon === 0 && totalPinjaman > 0) {
      const cleanupBatch = writeBatch(db);
      let countDeleted = 0;

      rawItems.forEach(item => {
        if (item.status === "Approved" || item.status === "Settled") {
          cleanupBatch.delete(doc(db, "employee_requests", item.id));
          countDeleted++;
        }
      });

      if (countDeleted > 0) {
        await cleanupBatch.commit();
      }

      totalPinjaman = 0;
      totalPelunasan = 0;
      rawItems = rawItems.filter(item => item.status !== "Approved" && item.status !== "Settled");
    }

    if (displaySisa) displaySisa.innerText = formatRupiah(sisaKasbon);
    if (displayPinjaman) displayPinjaman.innerText = formatRupiah(totalPinjaman);
    if (displayPelunasan) displayPelunasan.innerText = formatRupiah(totalPelunasan);

    if (!historyList) return;

    const transactions = rawItems.filter(t => {
      if (sisaKasbon === 0 && (t.status === "Approved" || t.status === "Settled")) {
        return false;
      }
      return true;
    });

    if (transactions.length === 0) {
      historyList.innerHTML = "<p class='placeholder-text'>Belum ada transaksi kasbon aktif.</p>";
      return;
    }

    transactions.sort((a, b) => (b.requested_millis || 0) - (a.requested_millis || 0));

    historyList.innerHTML = transactions.map(t => {
      const isPinjam = t.type === "Kasbon";
      const isPending = t.status === "Pending";
      const isRejected = t.status === "Rejected";
      const amountColor = isPinjam ? "#f59e0b" : "#10b981";
      const prefix = isPinjam ? "+ " : "- ";
      const formattedTime = formatShortDateTime(t.requested_millis || t.timestamp?.toMillis?.());

      let badgeBg = "rgba(16, 185, 129, 0.12)";
      let badgeColor = "#10b981";
      let statusLabel = t.status.toUpperCase();

      if (isPending) {
        badgeBg = "rgba(245, 158, 11, 0.15)";
        badgeColor = "#f59e0b";
      } else if (isRejected) {
        badgeBg = "rgba(239, 68, 68, 0.15)";
        badgeColor = "#ef4444";
        const deleteAt = (t.rejected_at_millis || t.requested_millis || Date.now()) + 60000;
        const remainSec = Math.max(0, Math.ceil((deleteAt - Date.now()) / 1000));
        statusLabel = `REJECTED (${remainSec}s)`;
      } else if (t.status === "Expired") {
        badgeBg = "rgba(239, 68, 68, 0.15)";
        badgeColor = "#ef4444";
      }

      const clickHandler = isPending 
        ? `onclick="openKasbonQRISPage('${t.voucher_code}', ${t.expires_at_millis}, ${JSON.stringify(t).replace(/"/g, '&quot;')}, '${t.id}')"`
        : '';

      const pendingHint = isPending ? `<small class="text-accent font-700" style="font-size:0.58rem; margin-top:2px;">• Sentuh untuk lihat QR</small>` : '';

      return `
        <div class="picker-user-row" style="margin-bottom:6px; cursor:${isPending ? 'pointer' : 'default'}; justify-content:space-between; align-items:center;" ${clickHandler}>
          <div class="picker-user-meta" style="flex:1;">
            <div style="display:flex; align-items:center; gap:6px;">
              <strong>${t.type === "Kasbon" ? "Pinjaman Kasbon" : "Setoran Kasbon"}</strong>
              <span class="badge-status-work" style="background:${badgeBg}; color:${badgeColor}; font-size:0.52rem; padding:2px 5px;">${statusLabel}</span>
            </div>
            <small>${t.note || '-'} · <b style="color:var(--text-primary);">${formattedTime}</b></small>
            ${pendingHint}
          </div>
          <strong style="font-size:0.85rem; color:${amountColor}; flex-shrink:0;">${prefix}${formatRupiah(t.amount || 0)}</strong>
        </div>
      `;
    }).join("");

    if (kasbonHistoryCountdownTimer) clearInterval(kasbonHistoryCountdownTimer);
    if (transactions.some(t => t.status === "Rejected")) {
      kasbonHistoryCountdownTimer = setInterval(() => {
        loadKasbonAccountSummary();
      }, 1000);
    }

  } catch (err) {
    console.warn("Gagal load kasbon:", err);
  }
}

// ==========================================
// 6. LAMAN PENUH QRIS KASBON & REALTIME APPROVAL
// ==========================================
export function openKasbonQRISPage(voucherCode, expiresAtMillis, transData, docId = null) {
  const titleEl = document.getElementById("qris-page-type-title");
  const codeEl = document.getElementById("qris-page-voucher-code");
  const amtEl = document.getElementById("qris-page-amount");
  const timerEl = document.getElementById("qris-page-countdown-timer");
  const qrContainer = document.getElementById("qrcode-kasbon-page-container");

  if (titleEl) titleEl.innerText = transData.type === "Kasbon" ? "QRIS Pinjaman Kasbon" : "QRIS Setoran Kasbon";
  if (codeEl) codeEl.innerText = voucherCode || "-";
  if (amtEl) amtEl.innerText = formatRupiah(transData.amount || 0);

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
        width: 180,
        height: 180,
        colorDark: "#1a4b8b",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  if (state.qrCountdownInterval) clearInterval(state.qrCountdownInterval);
  if (activeQRISSnapshotUnsub) {
    activeQRISSnapshotUnsub();
    activeQRISSnapshotUnsub = null;
  }

  if (docId) {
    activeQRISSnapshotUnsub = onSnapshot(doc(db, "employee_requests", docId), (dSnap) => {
      if (dSnap.exists()) {
        const d = dSnap.data();
        if (d.status === "Approved") {
          if (activeQRISSnapshotUnsub) activeQRISSnapshotUnsub();
          if (state.qrCountdownInterval) clearInterval(state.qrCountdownInterval);
          notify("Transaksi Berhasil", `Transaksi ${transData.type} sebesar ${formatRupiah(transData.amount)} telah disetujui GM.`);
          navigateToTab("gaji");
          loadKasbonAccountSummary();
        } else if (d.status === "Rejected") {
          if (activeQRISSnapshotUnsub) activeQRISSnapshotUnsub();
          if (state.qrCountdownInterval) clearInterval(state.qrCountdownInterval);
          notify("Pengajuan Ditolak", "Pengajuan kasbon Anda tidak disetujui.");
          navigateToTab("gaji");
          loadKasbonAccountSummary();
        }
      }
    });
  }

  function updateTimer() {
    const remaining = expiresAtMillis - Date.now();
    if (remaining <= 0) {
      clearInterval(state.qrCountdownInterval);
      if (activeQRISSnapshotUnsub) activeQRISSnapshotUnsub();
      if (timerEl) timerEl.innerText = "KODE TELAH KEDALUWARSA";
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

  navigateToTab("qris-kasbon-page");
}

export function closeKasbonQRISModal() {
  if (state.qrCountdownInterval) clearInterval(state.qrCountdownInterval);
  if (activeQRISSnapshotUnsub) {
    activeQRISSnapshotUnsub();
    activeQRISSnapshotUnsub = null;
  }
  navigateToTab("gaji");
}

// ==========================================
// 7. SCANNER GM FULL-PAGE & WAITING TRANSITION
// ==========================================
export function openGMScannerModal() {
  navigateToTab('gm-scanner-page');

  const waitScreen = document.getElementById("scanner-waiting-screen");
  const camBox = document.getElementById("scanner-camera-container");
  if (waitScreen) waitScreen.classList.add("hidden");
  if (camBox) camBox.classList.remove("hidden");

  if (window.Html5Qrcode) {
    if (state.html5QrScanner) {
      state.html5QrScanner.stop().catch(() => {}).finally(() => {
        state.html5QrScanner = null;
        startActiveCameraStream();
      });
    } else {
      startActiveCameraStream();
    }
  }
}

function startActiveCameraStream() {
  state.html5QrScanner = new Html5Qrcode("reader");
  state.html5QrScanner.start(
    { facingMode: "environment" },
    { fps: 10, aspectRatio: 1.0, qrbox: { width: 220, height: 220 } },
    (decodedText) => {
      const waitScreen = document.getElementById("scanner-waiting-screen");
      const camBox = document.getElementById("scanner-camera-container");
      if (camBox) camBox.classList.add("hidden");
      if (waitScreen) waitScreen.classList.remove("hidden");

      if (state.html5QrScanner) {
        state.html5QrScanner.stop().then(() => {
          state.html5QrScanner = null;
        }).catch(() => { state.html5QrScanner = null; });
      }

      setTimeout(() => {
        try {
          const payload = JSON.parse(decodedText);
          if (payload.code) {
            validateScannedOperationalCode(payload.code);
          } else {
            notify("QR Tidak Dikenal", "Format QR Code tidak valid.");
            closeGMScannerModal();
          }
        } catch (e) {
          validateScannedOperationalCode(decodedText);
        }
      }, 700);
    },
    () => {}
  ).catch((err) => {
    console.warn("Gagal membuka kamera:", err);
  });
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
  navigateToTab('hr');
  openHRSubPage('hr-requests');
}

export function validateManualVoucherCode() {
  const code = document.getElementById("input-manual-voucher-code")?.value.trim().toUpperCase();
  if (!code) return notify("Perhatian", "Masukkan kode voucher transaksi.");
  
  const waitScreen = document.getElementById("scanner-waiting-screen");
  const camBox = document.getElementById("scanner-camera-container");
  if (camBox) camBox.classList.add("hidden");
  if (waitScreen) waitScreen.classList.remove("hidden");

  if (state.html5QrScanner) {
    state.html5QrScanner.stop().catch(() => {}).finally(() => {
      state.html5QrScanner = null;
    });
  }

  setTimeout(() => {
    validateScannedOperationalCode(code);
  }, 400);
}

export async function validateScannedOperationalCode(voucherCode) {
  showLoading();

  try {
    const q = query(
      collection(db, "employee_requests"), 
      where("voucher_code", "==", voucherCode)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      hideLoading();
      closeGMScannerModal();
      return notify("Kode Tidak Valid", `Tidak ditemukan pengajuan dengan kode ${voucherCode}.`);
    }

    const targetDoc = snap.docs[0];
    const reqData = targetDoc.data();

    const now = Date.now();
    if (reqData.expires_at_millis && now > reqData.expires_at_millis) {
      await setDoc(doc(db, "employee_requests", targetDoc.id), { status: "Expired", expired_at_millis: now }, { merge: true });
      hideLoading();
      closeGMScannerModal();
      return notify("Kode Kedaluwarsa", "Batas waktu QRIS / Voucher telah habis.");
    }

    if (reqData.status === "Approved") {
      hideLoading();
      closeGMScannerModal();
      return notify("Sudah Divalidasi", `Transaksi ${reqData.type} ${reqData.nama} sudah selesai.`);
    }

    hideLoading();
    const confirmApprove = await showCustomConfirm(
      `Konfirmasi ${reqData.type}`,
      `Validasi & Setujui ${reqData.type} untuk ${reqData.nama} sejumlah ${formatRupiah(reqData.amount)} (${reqData.termin_label || 'Termin 1'})?`
    );

    if (confirmApprove) {
      await approveDisbursement(targetDoc.id, reqData.uid, reqData.month, reqData.payroll_term);
      notify("Transaksi Berhasil", `Transaksi ${reqData.type} untuk ${reqData.nama} berhasil disetujui.`);
      closeGMScannerModal();
    } else {
      closeGMScannerModal();
    }
  } catch (err) {
    hideLoading();
    closeGMScannerModal();
    notify("Gagal Validasi", err.message);
  }
}

export function printPayslip() {
  window.print();
}

export async function exportPayslipFile(formatType) {
  if (!state.currentPayslipCache) return notify("Perhatian", "Data slip tidak ditemukan.");

  const data = state.currentPayslipCache;
  const rawRole = String(data.role || 'staff').toLowerCase();
  const displayRole = (ROLE_DISPLAY_NAMES[rawRole] || rawRole).toUpperCase();
  const termSuffix = data.payroll_term === "termin_2" ? "T2" : "T1";
  const docCode = `DOC-${(data.month || "2026-08").replace("-", "")}-${termSuffix}-${(data.uid || "USER").slice(0, 4).toUpperCase()}`;
  const termLabel = data.termin_label || (data.payroll_term === "termin_2" ? "Termin 2 (Tanggal 15)" : "Termin 1 (Tanggal 1)");
  const fileName = `SLIP_GAJI_${(data.nama || 'Karyawan').replace(/\s+/g, '_')}_${data.month}_${termSuffix}`;
  const thpVal = data.takeHomePay !== undefined ? data.takeHomePay : (data.thp || 0);

  showLoading();

  try {
    if (formatType === "doc") {
      const wordHTML = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>Slip Gaji - ${data.nama}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 10pt; color: #0f172a; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .title { font-size: 14pt; font-weight: bold; color: #0f172a; }
            .divider { border-top: 2px solid #1A4B8B; margin: 10px 0; }
            .item-row td { padding: 5px 0; font-size: 9pt; }
            .item-deduct td { color: #ef4444; font-weight: 600; padding: 5px 0; font-size: 9pt; }
            .total-amount { font-size: 13pt; font-weight: bold; color: #1A4B8B; text-align: right; }
          </style>
        </head>
        <body>
          <div class="title">AIWA RAGIN JAJE</div>
          <div style="font-size:8pt; color:#64748b;">PAYROLL DISBURSEMENT SYSTEM · ${docCode}</div>
          <div class="divider"></div>
          <p><b>Nama:</b> ${data.nama} | <b>Jabatan:</b> ${displayRole} | <b>Periode:</b> ${data.month} (${termLabel})</p>
          <table>
            <tr class="item-row"><td>Gaji Pokok</td><td align="right"><b>${formatRupiah(data.baseSalary || 0)}</b></td></tr>
            <tr class="item-row"><td>Tunjangan Jabatan</td><td align="right"><b>${formatRupiah(data.roleAllowance || 0)}</b></td></tr>
            <tr class="item-row"><td>Uang Makan (${data.hadir || 0} Hari)</td><td align="right"><b>${formatRupiah(data.mealTotal || 0)}</b></td></tr>
            <tr class="item-deduct"><td>Denda Keterlambatan (${data.telat || 0}x)</td><td align="right">- ${formatRupiah(data.latePenaltyTotal || 0)}</td></tr>
            <tr class="item-deduct"><td>Pinjaman Kasbon</td><td align="right">- ${formatRupiah(data.kasbon || 0)}</td></tr>
            <tr><td style="padding-top:10px; font-weight:bold;">GAJI BERSIH (THP)</td><td class="total-amount">${formatRupiah(thpVal)}</td></tr>
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
      docPdf.text("AIWA RAGIN JAJE", 45, 52);

      docPdf.setFontSize(8);
      docPdf.setTextColor(100, 116, 139);
      docPdf.text(`PAYROLL DISBURSEMENT · ${docCode}`, 45, 66);

      docPdf.setDrawColor(26, 75, 139);
      docPdf.setLineWidth(2);
      docPdf.line(45, 78, 550, 78);

      docPdf.setFontSize(9);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text(`Nama: ${data.nama} | Role: ${displayRole} | Periode: ${data.month} (${termLabel})`, 45, 100);

      let y = 130;
      const incomeList = [
        ["Gaji Pokok", formatRupiah(data.baseSalary || 0)],
        ["Tunjangan Jabatan", formatRupiah(data.roleAllowance || 0)],
        [`Uang Makan (${data.hadir || 0} Hari)`, formatRupiah(data.mealTotal || 0)],
        [`Denda Keterlambatan (${data.telat || 0}x)`, `- ${formatRupiah(data.latePenaltyTotal || 0)}`],
        ["Pinjaman Kasbon", `- ${formatRupiah(data.kasbon || 0)}`]
      ];

      incomeList.forEach(item => {
        docPdf.text(item[0], 48, y);
        docPdf.text(item[1], 548, y, { align: "right" });
        y += 18;
      });

      y += 15;
      docPdf.setFont("helvetica", "bold");
      docPdf.text("GAJI BERSIH (TAKE HOME PAY)", 48, y);
      docPdf.text(formatRupiah(thpVal), 548, y, { align: "right" });

      docPdf.save(`${fileName}.pdf`);
      hideLoading();
      notify("Sukses", "Slip gaji berhasil diunduh sebagai PDF.");
    }
    else if (formatType === "image") {
      if (!window.html2canvas) throw new Error("Library html2canvas belum dimuat.");
      const slipEl = document.getElementById("printable-payslip-area");
      if (!slipEl) throw new Error("Elemen slip tidak ditemukan.");

      const canvas = await html2canvas(slipEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff"
      });

      const imgUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = imgUrl;
      a.download = `${fileName}.png`;
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
// 8. WORKFLOW PENGAJUAN & VALIDASI GM
// ==========================================
export async function loadHRRequestsList() {
  const listEl = document.getElementById("hr-requests-list");
  if (!listEl) return;

  try {
    const snap = await getDocs(query(collection(db, "employee_requests"), limit(50)));
    listEl.innerHTML = "";
    if (snap.empty) {
      listEl.innerHTML = "<p class='placeholder-text'>Belum ada pengajuan staf.</p>";
      return;
    }

    const now = Date.now();
    let requests = [];

    for (const d of snap.docs) {
      const item = { id: d.id, ...d.data() };

      if (item.status === "Pending" && item.expires_at_millis && now > item.expires_at_millis) {
        item.status = "Expired";
        setDoc(doc(db, "employee_requests", d.id), { status: "Expired", expired_at_millis: now }, { merge: true }).catch(() => {});
      }

      if (item.status === "Rejected") {
        const deleteAt = (item.rejected_at_millis || item.requested_millis || now) + 60000;
        if (now >= deleteAt) {
          deleteDoc(doc(db, "employee_requests", d.id)).catch(() => {});
          continue;
        }
      }

      const isLunas = item.type === "Kasbon" && item.status === "Approved" && (((Number(item.amount) || 0) - (Number(item.total_paid) || 0)) <= 0);
      if (item.status === "Settled" || isLunas) {
        deleteDoc(doc(db, "employee_requests", d.id)).catch(() => {});
        continue;
      }

      requests.push(item);
    }

    if (requests.length === 0) {
      listEl.innerHTML = "<p class='placeholder-text'>Tidak ada antrean pengajuan aktif.</p>";
      return;
    }

    requests.sort((a, b) => (b.requested_millis || 0) - (a.requested_millis || 0));

    listEl.innerHTML = requests.map(item => {
      const isPending = item.status === "Pending";
      const isApproved = item.status === "Approved";
      const isRejected = item.status === "Rejected";
      const isSalaryClaim = item.type === "Tarik Gaji";
      const formattedTime = formatShortDateTime(item.requested_millis || item.timestamp?.toMillis?.());

      let statusColor = "#f59e0b";
      let statusLabel = item.status;

      if (isApproved) {
        statusColor = "#10b981";
      } else if (isRejected) {
        statusColor = "#ef4444";
        const deleteAt = (item.rejected_at_millis || item.requested_millis || Date.now()) + 60000;
        const remainSec = Math.max(0, Math.ceil((deleteAt - Date.now()) / 1000));
        statusLabel = `Rejected (${remainSec}s)`;
      } else if (item.status === "Expired") {
        statusColor = "#ef4444";
      }

      const clickHandler = isApproved && item.type === "Kasbon"
        ? `onclick="openKasbonPaymentDetailModal(${JSON.stringify(item).replace(/"/g, '&quot;')})"`
        : '';

      const approvedHint = isApproved && item.type === "Kasbon" 
        ? `<small style="color:var(--text-accent); font-weight:700; margin-top:2px;">• Ketuk untuk rincian pembayaran</small>` 
        : '';

      return `
        <div class="request-item-row" style="cursor:${isApproved && item.type === 'Kasbon' ? 'pointer' : 'default'};" ${clickHandler}>
          <div class="request-item-info">
            <strong>${item.nama} [${item.type}]</strong>
            <small class="text-muted-xs">${formatRupiah(item.amount || 0)} · ${item.note || ''}</small>
            <small class="mt-1">Waktu: <b style="color:var(--text-primary);">${formattedTime}</b></small>
            <small>Status: <b style="color:${statusColor}">${statusLabel}</b></small>
            ${approvedHint}
          </div>
          <div class="request-action-group">
            ${isPending ? `
              <button type="button" class="btn-approve-action" onclick="approveDisbursement('${item.id}', '${item.uid}', '${item.month || ''}', '${item.payroll_term || ''}')">
                ${isSalaryClaim ? 'Cairkan' : 'Setujui'}
              </button>
              <button type="button" class="btn-reject-action" onclick="updateRequestStatus('${item.id}', 'Rejected')">
                Tolak
              </button>
            ` : `<span class="badge-completed" style="background:${statusColor}22; color:${statusColor};">${statusLabel}</span>`}
          </div>
        </div>
      `;
    }).join("");

    if (hrRequestsCountdownTimer) clearInterval(hrRequestsCountdownTimer);
    if (requests.some(r => r.status === "Rejected")) {
      hrRequestsCountdownTimer = setInterval(() => {
        loadHRRequestsList();
      }, 1000);
    }

  } catch (e) {
    listEl.innerHTML = `<p class='placeholder-text' style='color:#ef4444;'>Gagal memuat pengajuan: ${e.message}</p>`;
  }
}

export async function approveDisbursement(requestId, userId, monthStr, payrollTerm = "termin_1") {
  showLoading();
  try {
    const targetDocSnap = await getDoc(doc(db, "employee_requests", requestId));
    const reqData = targetDocSnap.exists() ? targetDocSnap.data() : {};

    await setDoc(doc(db, "employee_requests", requestId), { 
      status: "Approved",
      disbursement_status: "Paid",
      approved_at: serverTimestamp(),
      approved_millis: Date.now()
    }, { merge: true });

    if (userId && monthStr) {
      const termKey = payrollTerm || "termin_1";
      await Promise.all([
        setDoc(doc(db, "salary_slips_archive", `${userId}_${monthStr}_${termKey}`), { disbursement_status: "Paid" }, { merge: true }),
        setDoc(doc(db, "salary_slips_archive", `${userId}_${monthStr}`), { disbursement_status: "Paid" }, { merge: true })
      ]);
    }

    if (reqData.type === "Bayar Kasbon" && reqData.uid) {
      const userReqSnap = await getDocs(query(
        collection(db, "employee_requests"),
        where("uid", "==", reqData.uid)
      ));

      let userBorrowed = 0;
      let userRepaid = 0;
      let activeLoanDocs = [];

      userReqSnap.forEach(d => {
        const item = d.data();
        if (item.type === "Kasbon" && (item.status === "Approved" || item.status === "Settled" || d.id === requestId)) {
          userBorrowed += Number(item.amount || 0);
          activeLoanDocs.push(d.id);
        } else if (item.type === "Bayar Kasbon" && (item.status === "Approved" || item.status === "Settled" || d.id === requestId)) {
          userRepaid += Number(item.amount || 0);
          activeLoanDocs.push(d.id);
        }
      });

      if (userBorrowed > 0 && (userBorrowed - userRepaid) <= 0) {
        const delBatch = writeBatch(db);
        activeLoanDocs.forEach(id => delBatch.delete(doc(db, "employee_requests", id)));
        await delBatch.commit();
      }
    }

    hideLoading();
    notify("Sukses", "Pengajuan berhasil disetujui.");
    loadHRRequestsList();
    loadKasbonAccountSummary();
  } catch (err) {
    hideLoading();
    notify("Gagal Validasi", err.message);
  }
}

export async function updateRequestStatus(docId, newStatus) {
  showLoading();
  try {
    let payload = { 
      status: newStatus,
      updated_at: serverTimestamp() 
    };

    if (newStatus === "Rejected") {
      payload.rejected_at_millis = Date.now();
    }

    await setDoc(doc(db, "employee_requests", docId), payload, { merge: true });
    hideLoading();
    notify("Sukses", `Pengajuan berhasil di-${newStatus}.`);
    loadHRRequestsList();
    loadKasbonAccountSummary();
  } catch (e) { 
    hideLoading();
    notify("Gagal", e.message); 
  }
}

// ==========================================
// 9. LAMAN PENUH DETAIL RIWAYAT PEMBAYARAN KASBON
// ==========================================
export function openKasbonPaymentDetailModal(data) {
  if (!data) return;

  const totalAmount = Number(data.amount || 0);
  const totalPaid = Number(data.total_paid || 0);
  const remaining = Math.max(0, totalAmount - totalPaid);
  const tenor = Number(data.tenor_months || 1);
  const installment = Number(data.monthly_installment || Math.ceil(totalAmount / tenor));
  const paidCount = Number(data.installment_paid_count || 0);
  const formattedTime = formatShortDateTime(data.requested_millis || data.timestamp?.toMillis?.());

  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

  setTxt("page-kasbon-employee-name", `Kasbon: ${data.nama || 'Karyawan'}`);
  setTxt("page-kasbon-code", `KODE: ${data.voucher_code || '-'}`);
  setTxt("page-kasbon-total-amount", formatRupiah(totalAmount));
  setTxt("page-kasbon-timestamp", `Tanggal Pengajuan: ${formattedTime}`);
  setTxt("page-kasbon-paid", formatRupiah(totalPaid));
  setTxt("page-kasbon-remaining", formatRupiah(remaining));
  setTxt("page-kasbon-tenor", `Tenor: ${tenor} Bulan`);
  setTxt("page-kasbon-installment", `${formatRupiah(installment)} / bln`);
  setTxt("page-kasbon-installment-progress", `Progres: ${paidCount} / ${tenor} Kali Angsuran`);
  setTxt("page-kasbon-note", `"${data.note || 'Keperluan operasional'}"`);

  navigateToTab('kasbon-detail-page');
}

export function closeKasbonPaymentDetailModal() {
  navigateToTab('hr');
  openHRSubPage('hr-requests');
}
