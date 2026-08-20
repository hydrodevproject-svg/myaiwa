/* ==========================================================================
   MYAIWA - DYNAMIC VIEW & COMPONENT LOADER
   ========================================================================== */

const VIEW_MAP = [
  { targetId: "view-auth-login", file: "./views/auth-login.html" },
  { targetId: "view-tab-beranda", file: "./views/tab-beranda.html" },
  { targetId: "view-tab-tugas", file: "./views/tab-tugas.html" },
  { targetId: "view-tab-absensi", file: "./views/tab-absensi.html" },
  { targetId: "view-tab-gaji", file: "./views/tab-gaji.html" },
  { targetId: "view-tab-kasbon", file: "./views/tab-kasbon.html" },
  { targetId: "view-tab-hr", file: "./views/tab-hr.html" },
  { targetId: "view-tab-accounting", file: "./views/tab-accounting.html" },
  { targetId: "view-tab-users", file: "./views/tab-users.html" },
  { targetId: "view-tab-it", file: "./views/tab-it.html" },
  { targetId: "view-tab-profile", file: "./views/tab-profile.html" },
  { targetId: "view-sub-pages", file: "./views/sub-pages.html" },
  { targetId: "view-modals", file: "./views/modals.html" }
];

export async function loadAllViews() {
  const promises = VIEW_MAP.map(async ({ targetId, file }) => {
    const el = document.getElementById(targetId);
    if (!el) return;
    try {
      const res = await fetch(file);
      if (!res.ok) throw new Error(`Gagal memuat ${file}`);
      el.innerHTML = await res.text();
    } catch (err) {
      console.error(err);
      el.innerHTML = `<p class="placeholder-text text-danger">Gagal memuat komponen: ${file}</p>`;
    }
  });

  await Promise.all(promises);
}
