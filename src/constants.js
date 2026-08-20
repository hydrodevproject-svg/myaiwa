/* ==========================================================================
   MYAIWA - CONSTANTS & GLOBAL RUNTIME STATE
   ========================================================================== */

// 1. KOORDINAT TOKO AIWA RAGIN JAJE (AIKMEL)
export const MERCHANT_LOCATION = {
  lat: -8.568346, 
  lng: 116.530922, 
  maxRadiusMeters: 100 
};

// 2. ROLE LABEL DISPLAY MAPPER
export const ROLE_DISPLAY_NAMES = {
  staff: "Staff Outlet",
  admin: "Staff Admin",
  logistik: "Staff Logistik",
  it: "Staff It",
  gm: "gm"
};

// 3. PRESET DEFAULT TUNJANGAN JABATAN
export const CAREER_ALLOWANCE_PRESETS = {
  Junior: 0,
  Middle: 150000,
  Senior: 350000,
  Lead: 750000
};

// 4. TEMPLATE SOP KERJA TOKO BAHAN KUE (AIWA RAGIN JAJE)
export const ROLE_DEFAULT_SOP = {
  staff: [
    "Cek kebersihan etalase, rak display, dan wadah repack bahan kue",
    "Periksa ketersediaan stok display & request restock ke logistik jika menipis",
    "Pastikan label harga & tanggal kedaluwarsa (EXP) tertera jelas pada kemasan",
    "Rekapitulasi total transaksi kasir dan serah terima kas/QRIS saat pergantian shift"
  ],
  logistik: [
    "Pemeriksaan fisik & tanggal kedaluwarsa bahan baku yang masuk dari supplier",
    "Penataan stok gudang dengan metode FIFO (First In, First Out) & FEFO (First Expired, First Out)",
    "Pengecekan suhu & kelembapan ruang simpan (mentega, cokelat, ragi/yeast, & dairy)",
    "Distribusi cepat bahan kue ke area etalase outlet sesuai form kebutuhan staf kasir"
  ],
  admin: [
    "Verifikasi pencocokan nota penjualan fisik/QRIS dengan rekapan kasir outlet",
    "Input faktur pembelian barang masuk dari supplier & jadwalkan jatuh tempo nota",
    "Pemeriksaan berkas pengajuan staf (kasbon, izin, lembur) untuk validasi GM",
    "Rekapitulasi laporan margin harian & mutasi stok keluar-masuk sistem"
  ],
  it: [
    "Monitoring kestabilan koneksi database transaksi toko & sistem presensi",
    "Pemeriksaan performa aplikasi Myaiwa & pencadangan data massal berkala",
    "Audit keamanan akun staf serta sinkronisasi log audit sistem",
    "Optimalisasi kecepatan respon antarmuka dan penanganan kendala teknis tim"
  ],
  gm: [
    "Evaluasi laporan omset harian, margin produk terlaris, & pergerakan stok lambat",
    "Validasi persetujuan pengajuan staf & otorisasi pencairan payroll/kasbon",
    "Inspeksi mendadak kelayakan penyimpanan bahan kue di gudang & display outlet",
    "Supervisi kepatuhan SOP harian, absensi GPS, dan performa KPI seluruh tim"
  ]
};

// 5. PARAMETER ROLE DEFAULT
export const DEFAULT_ROLE_PARAMS = {
  staff: { pagi_start: "07:30", pagi_end: "15:30", malam_start: "13:30", malam_end: "21:00", it_threshold: "10:00", tolerance: 15, late_penalty: 10000, overtime_rate: 25000, radius_meter: 100 },
  admin: { pagi_start: "08:00", pagi_end: "16:00", malam_start: "13:30", malam_end: "21:00", it_threshold: "10:00", tolerance: 15, late_penalty: 10000, overtime_rate: 25000, radius_meter: 100 },
  logistik: { pagi_start: "07:00", pagi_end: "15:00", malam_start: "13:00", malam_end: "21:00", it_threshold: "10:00", tolerance: 15, late_penalty: 10000, overtime_rate: 25000, radius_meter: 100 },
  it: { pagi_start: "08:00", pagi_end: "16:00", malam_start: "13:30", malam_end: "21:00", it_threshold: "10:00", tolerance: 15, late_penalty: 10000, overtime_rate: 25000, radius_meter: 100 },
  gm: { pagi_start: "08:00", pagi_end: "17:00", malam_start: "13:30", malam_end: "21:00", it_threshold: "10:00", tolerance: 30, late_penalty: 0, overtime_rate: 0, radius_meter: 200 }
};

// 6. MONOTONE ICONS
export const MONOTONE_ICONS = {
  warning: '<svg class="icon-inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
  location: '<svg class="icon-inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 00-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 00-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>'
};

// 7. SHARED RUNTIME STATE & CACHES
export const state = {
  itUsersCache: [],
  allEmployeesCache: [],
  rawAuditLogsCache: [],
  careerPathListCache: [],
  leaderboardReportCache: [],
  adminAttendanceCache: [],
  currentPayslipCache: null,
  cropperInstance: null,
  currentCropType: "",
  userGPSLocation: null,
  maplibreMap: null,
  userMarker: null,

  selectedDisbursementType: "cash",
  qrCodeInstance: null,
  qrCodeKasbonInstance: null,
  html5QrScanner: null,
  activePickerContext: "shift",

  currentMonthITWfaCount: 0,
  qrCountdownInterval: null,

  currentActiveTab: "beranda",
  isHRSubpageOpen: false,
  isITSubpageOpen: false,
  lastBackPressTime: 0,
  pendingLeaveType: "Sakit",
  pendingEmployeeRequestType: "Kasbon",

  currentUserShift: "pagi",
  currentUserWorkMode: "wfo",
  currentUserData: null,
  roleParamsCache: JSON.parse(JSON.stringify(DEFAULT_ROLE_PARAMS))
};
