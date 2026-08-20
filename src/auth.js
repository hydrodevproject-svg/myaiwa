/* ==========================================================================
   MYAIWA - AUTHENTICATION, USER PROFILE & ACCESS CONTROL
   ========================================================================== */

import { auth, db, secondaryAuth } from "../firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { state, ROLE_DISPLAY_NAMES, DEFAULT_ROLE_PARAMS } from "./constants.js";
import { 
  showLoading, 
  hideLoading, 
  notify, 
  showCustomConfirm, 
  getDynamicGreeting, 
  applyUserAvatar, 
  navigateToTab 
} from "./utils.js";

// ==========================================
// 1. SINKRONISASI PARAMETER ROLE DARI DATABASE
// ==========================================
export async function loadSystemParameters() {
  try {
    const docSnap = await getDoc(doc(db, "app_settings", "parameters_roles"));
    if (docSnap.exists()) {
      state.roleParamsCache = { ...state.roleParamsCache, ...docSnap.data() };
    }
    updateAllShiftCardsTimeDisplay();
  } catch (e) {
    console.warn("Load config params error:", e);
  }
}

export function updateAllShiftCardsTimeDisplay() {
  const roles = ["staff", "admin", "logistik", "it", "gm"];

  roles.forEach(roleKey => {
    const cfg = state.roleParamsCache[roleKey] || DEFAULT_ROLE_PARAMS[roleKey] || DEFAULT_ROLE_PARAMS.staff;

    const subPagi = document.getElementById(`sub-shift-${roleKey}-pagi`);
    const subMalam = document.getElementById(`sub-shift-${roleKey}-malam`);
    
    if (subPagi) subPagi.innerText = `${cfg.pagi_start || "07:30"} - ${cfg.pagi_end || "15:30"}`;
    if (subMalam) subMalam.innerText = `${cfg.malam_start || "13:30"} - ${cfg.malam_end || "21:00"}`;
  });

  const subIt = document.getElementById("sub-shift-it-flex");
  const subGm = document.getElementById("sub-shift-gm-regular");

  const itCfg = state.roleParamsCache.it || DEFAULT_ROLE_PARAMS.it;
  const gmCfg = state.roleParamsCache.gm || DEFAULT_ROLE_PARAMS.gm;

  if (subIt) subIt.innerText = `Maks Masuk: ${itCfg.it_threshold || "10:00"}`;
  if (subGm) subGm.innerText = `${gmCfg.pagi_start || "08:00"} - ${gmCfg.pagi_end || "17:00"}`;
}

// ==========================================
// 2. AUTH STATE OBSERVER & INISIALISASI AKUN
// ==========================================
export function initAuthObserver(onUserLoadedCallback) {
  const sectionLogin = document.getElementById("section-login");
  const sectionDashboard = document.getElementById("section-dashboard");
  const mainHeader = document.getElementById("main-header");
  const bottomNav = document.getElementById("bottom-nav");

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      sectionLogin?.classList.add("hidden");
      sectionDashboard?.classList.remove("hidden");
      mainHeader?.classList.remove("hidden");
      bottomNav?.classList.remove("hidden");
      navigateToTab("beranda", false);

      const btnText = document.getElementById("btn-login-text");
      const btnSpinner = document.getElementById("btn-login-spinner");
      const btnSubmit = document.getElementById("btn-login-submit");
      if (btnText) btnText.innerText = "Masuk Sistem";
      if (btnSpinner) btnSpinner.classList.add("hidden");
      if (btnSubmit) btnSubmit.disabled = false;

      document.getElementById("header-user-email").innerText = user.email || "";
      document.getElementById("dashboard-user-name").innerText = user.email?.split('@')[0] || "Karyawan";
      document.getElementById("dashboard-greeting").innerText = getDynamicGreeting();

      try {
        await loadSystemParameters();

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          state.currentUserData = userDoc.data();
          state.currentUserShift = state.currentUserData.shift || "pagi";
          state.currentUserWorkMode = state.currentUserData.work_mode || "wfo";

          const rawRole = String(state.currentUserData.role || 'staff').toLowerCase();
          const displayRole = ROLE_DISPLAY_NAMES[rawRole] || rawRole;

          const userName = state.currentUserData.nama || user.email;
          document.getElementById("header-user-name").innerText = userName;
          document.getElementById("dashboard-user-name").innerText = userName;
          document.getElementById("dashboard-user-role-badge").innerText = `JABATAN: ${displayRole.toUpperCase()}`;

          let shiftBadgeText = `SHIFT ${state.currentUserShift.toUpperCase()}`;
          if (rawRole === "it") shiftBadgeText = "SHIFT IT";
          else if (rawRole === "gm") shiftBadgeText = "GM REGULAR";
          else if (rawRole === "staff") shiftBadgeText = (state.currentUserShift === "malam") ? "SHIFT MALAM" : "SHIFT PAGI";
          else if (rawRole === "admin") shiftBadgeText = `ADMIN · ${state.currentUserShift.toUpperCase()}`;
          else if (rawRole === "logistik") shiftBadgeText = `LOGISTIK · ${state.currentUserShift.toUpperCase()}`;

          document.getElementById("dashboard-shift-badge").innerText = shiftBadgeText;
          document.getElementById("dashboard-mode-label").innerText = state.currentUserWorkMode.toUpperCase();

          const userShiftModeBadge = document.getElementById("user-shift-mode-badge");
          if (userShiftModeBadge) {
            userShiftModeBadge.innerText = `${shiftBadgeText} · MODE ${state.currentUserWorkMode.toUpperCase()}`;
          }

          document.getElementById("page-user-name").innerText = userName;
          document.getElementById("page-user-email").innerText = user.email;
          document.getElementById("profile-full-name").value = state.currentUserData.nama || "";
          document.getElementById("profile-phone").value = state.currentUserData.phone || "";
          document.getElementById("profile-address").value = state.currentUserData.alamat || "";

          if (state.currentUserData.avatar_url) {
            applyUserAvatar(state.currentUserData.avatar_url);
          }

          renderRoleQuickActions(rawRole);
        }

        if (onUserLoadedCallback) {
          await onUserLoadedCallback(user, state.currentUserData);
        }
      } catch (err) {
        console.warn("Koneksi background data:", err);
      }
    } else {
      state.currentUserData = null;
      sectionLogin?.classList.remove("hidden");
      sectionDashboard?.classList.add("hidden");
      mainHeader?.classList.add("hidden");
      bottomNav?.classList.add("hidden");
    }
  });
}

// ==========================================
// 3. PROSES LOGIN & LOGOUT
// ==========================================
export async function loginUser(email, password) {
  const btnText = document.getElementById("btn-login-text");
  const btnSpinner = document.getElementById("btn-login-spinner");
  const btnSubmit = document.getElementById("btn-login-submit");

  if (btnText) btnText.innerText = "Memproses...";
  if (btnSpinner) btnSpinner.classList.remove("hidden");
  if (btnSubmit) btnSubmit.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (btnText) btnText.innerText = "Masuk Sistem";
    if (btnSpinner) btnSpinner.classList.add("hidden");
    if (btnSubmit) btnSubmit.disabled = false;
    
    let msg = "Email atau password salah.";
    if (error.code === "auth/network-request-failed") {
      msg = "Koneksi internet bermasalah. Periksa jaringan Anda.";
    } else if (error.code === "auth/too-many-requests") {
      msg = "Terlalu banyak percobaan gagal. Coba lagi beberapa saat.";
    }
    notify("Gagal Login", msg);
    throw error;
  }
}

export async function triggerLogout() {
  const confirmLogout = await showCustomConfirm("Keluar Akun", "Apakah Anda yakin ingin keluar dari sistem?");
  if (confirmLogout) {
    showLoading("Keluar dari akun...");
    try {
      await signOut(auth);
    } finally {
      hideLoading();
    }
  }
}

// ==========================================
// 4. MENU AKSI CEPAT DASHBOARD PER ROLE
// ==========================================
export function renderRoleQuickActions(role) {
  const container = document.getElementById("dashboard-role-actions");
  if (!container) return;

  const cardTugas = `
    <div class="hr-icon-card" onclick="navigateToTab('tugas')">
      <div class="hr-icon-bubble bg-soft-mint">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4"></path>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
      </div>
      <strong>Tugas & SOP</strong>
      <small>Checklist Harian</small>
    </div>
  `;

  const cardAbsen = `
    <div class="hr-icon-card" onclick="navigateToTab('absensi')">
      <div class="hr-icon-bubble bg-telegram-subtle">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 00-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 00-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>
      </div>
      <strong>Presensi GPS</strong>
      <small>Check-In/Out</small>
    </div>
  `;

  const cardGaji = `
    <div class="hr-icon-card" onclick="navigateToTab('gaji')">
      <div class="hr-icon-bubble bg-soft-mint">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg>
      </div>
      <strong>Gaji</strong>
      <small>Slip & Riwayat</small>
    </div>
  `;

  const cardKasbon = `
    <div class="hr-icon-card" onclick="navigateToTab('kasbon')">
      <div class="hr-icon-bubble bg-soft-amber">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </div>
      <strong>Kasbon</strong>
      <small>Pinjam & Bayar</small>
    </div>
  `;

  const cardCuti = `
    <div class="hr-icon-card" onclick="openEmployeeRequestPage('Cuti')">
      <div class="hr-icon-bubble bg-soft-purple">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <strong>Ajukan Cuti</strong>
      <small>Izin / Libur</small>
    </div>
  `;

  const cardHR = `
    <div class="hr-icon-card" onclick="navigateToTab('hr')">
      <div class="hr-icon-bubble bg-tiktok-cyan">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </div>
      <strong>Modul HR</strong>
      <small>Shift & Parameter</small>
    </div>
  `;

  const cardLaporan = `
    <div class="hr-icon-card" onclick="navigateToTab('accounting')">
      <div class="hr-icon-bubble bg-soft-amber">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
      </div>
      <strong>Laporan KPI</strong>
      <small>Finalisasi & Cert</small>
    </div>
  `;

  const cardRecruitment = `
    <div class="hr-icon-card" onclick="navigateToTab('users')">
      <div class="hr-icon-bubble bg-soft-mint">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
      </div>
      <strong>Recruitment</strong>
      <small>Daftar Staf</small>
    </div>
  `;

  const cardIT = `
    <div class="hr-icon-card" onclick="navigateToTab('it')">
      <div class="hr-icon-bubble bg-tiktok-pink">
        <svg class="icon-inline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      </div>
      <strong>Panel IT</strong>
      <small>Sistem Database</small>
    </div>
  `;

  switch (role) {
    case "staff":
    case "logistik":
      container.innerHTML = cardTugas + cardAbsen + cardGaji + cardKasbon + cardCuti;
      break;
    case "admin":
      container.innerHTML = cardTugas + cardHR + cardLaporan + cardAbsen + cardGaji + cardKasbon + cardCuti;
      break;
    case "gm":
      container.innerHTML = cardTugas + cardHR + cardLaporan + cardRecruitment + cardAbsen + cardGaji + cardKasbon + cardCuti;
      break;
    case "it":
      container.innerHTML = cardTugas + cardIT + cardHR + cardLaporan + cardAbsen + cardGaji + cardKasbon;
      break;
    default:
      container.innerHTML = cardTugas + cardAbsen + cardGaji + cardKasbon + cardCuti;
  }
}

// ==========================================
// 5. CROPPER & FOTO PROFIL
// ==========================================
export function openCropperModal(file, type) {
  state.currentCropType = type;
  const reader = new FileReader();
  reader.onload = (e) => {
    const cropModal = document.getElementById("crop-modal");
    const cropImg = document.getElementById("cropper-target-img");
    cropImg.src = e.target.result;
    cropModal.classList.remove("hidden");

    if (state.cropperInstance) state.cropperInstance.destroy();
    if (window.Cropper) {
      state.cropperInstance = new Cropper(cropImg, {
        aspectRatio: 1,
        viewMode: 1,
        autoCropArea: 1
      });
    }
  };
  reader.readAsDataURL(file);
}

export async function applyAndSaveCrop() {
  if (!state.cropperInstance) return;
  const btn = document.getElementById("btn-apply-crop");
  if (btn) {
    btn.innerText = "Memproses...";
    btn.disabled = true;
  }
  showLoading("Menyimpan foto...");

  try {
    const canvas = state.cropperInstance.getCroppedCanvas({ 
      width: 120, 
      height: 120, 
      imageSmoothingQuality: "medium" 
    });
    const base64 = canvas.toDataURL("image/jpeg", 0.5);

    const user = auth.currentUser;
    if (user) {
      await setDoc(doc(db, "users", user.uid), { avatar_url: base64 }, { merge: true });
      if (state.currentUserData) state.currentUserData.avatar_url = base64;
      applyUserAvatar(base64);
      notify("Sukses", "Foto profil berhasil diperbarui!");
    }
    document.getElementById('crop-modal')?.classList.add('hidden');
  } catch (err) { 
    notify("Gagal", err.message); 
  } finally { 
    hideLoading();
    if (btn) {
      btn.innerText = "Gunakan & Simpan"; 
      btn.disabled = false; 
    }
  }
}

// ==========================================
// 6. UPDATE DATA PROFIL & PASSWORD AKUN
// ==========================================
export async function updateUserProfile(name, phone, address) {
  const user = auth.currentUser;
  if (!user) return;

  showLoading("Menyimpan data profil...");
  try {
    await setDoc(doc(db, "users", user.uid), {
      nama: name,
      phone: phone,
      alamat: address
    }, { merge: true });

    if (state.currentUserData) {
      state.currentUserData.nama = name;
      state.currentUserData.phone = phone;
      state.currentUserData.alamat = address;
    }

    document.getElementById("header-user-name").innerText = name;
    document.getElementById("page-user-name").innerText = name;
    document.getElementById("dashboard-user-name").innerText = name;

    hideLoading();
    notify("Sukses", "Data profil Anda berhasil diperbarui!");
  } catch (err) {
    hideLoading();
    notify("Gagal", err.message);
  }
}

export async function changeUserPassword(currentPass, newPass, confirmPass) {
  const user = auth.currentUser;
  if (!user) return;

  if (newPass !== confirmPass) return notify("Perhatian", "Konfirmasi password baru tidak cocok.");
  if (newPass.length < 6) return notify("Perhatian", "Password baru minimal 6 karakter.");

  showLoading("Memperbarui password...");
  try {
    const cred = EmailAuthProvider.credential(user.email, currentPass);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPass);

    hideLoading();
    notify("Sukses", "Password akun berhasil diubah.");
    document.getElementById("form-direct-change-pass")?.reset();
    navigateToTab('profile');
  } catch (err) {
    hideLoading();
    notify("Gagal Ubah Password", err.message);
  }
}

// ==========================================
// 7. PENDAFTARAN AKUN (SECONDARY AUTH)
// ==========================================
export async function createUserAccount(name, email, pass, role) {
  showLoading("Mendaftarkan akun karyawan...");
  try {
    const res = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    await setDoc(doc(db, "users", res.user.uid), {
      nama: name,
      email: email,
      role: role,
      shift: role === "it" ? "it_flex" : "pagi",
      work_mode: role === "it" ? "wfa" : "wfo",
      career_level: "Junior",
      created_at: serverTimestamp()
    });
    await signOut(secondaryAuth);

    const displayRole = (ROLE_DISPLAY_NAMES[role] || role).toUpperCase();
    hideLoading();
    notify("Sukses", `Akun ${name} (${displayRole}) berhasil didaftarkan!`);
    document.getElementById("form-create-user")?.reset();
    
    if (window.loadHRUserOptions) window.loadHRUserOptions();
  } catch (err) {
    hideLoading();
    notify("Gagal Pendaftaran", err.message);
  }
}

export async function createITUserAccount(name, email, pass, role) {
  showLoading("Mendaftarkan akun sistem...");
  try {
    const res = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    await setDoc(doc(db, "users", res.user.uid), {
      nama: name,
      email: email,
      role: role,
      shift: role === "it" ? "it_flex" : "pagi",
      work_mode: role === "it" ? "wfa" : "wfo",
      career_level: "Junior",
      created_at: serverTimestamp()
    });
    await signOut(secondaryAuth);

    hideLoading();
    notify("Sukses", `Akun untuk ${name} berhasil dibuat!`);
    document.getElementById("form-it-create-user")?.reset();
    
    if (window.loadITUsersList) window.loadITUsersList();
    if (window.loadHRUserOptions) window.loadHRUserOptions();
  } catch (err) {
    hideLoading();
    notify("Gagal Registrasi IT", err.message);
  }
}
