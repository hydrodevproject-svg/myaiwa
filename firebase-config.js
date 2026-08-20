/**
 * FIREBASE CONFIGURATION & INITIALIZATION - MYAIWA
 * AIWA RAGIN JAJE SYSTEM
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, browserLocalPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// KONFIGURASI FIREBASE PROJECT ASLI MYAIWA
export const firebaseConfig = {
  apiKey: "AIzaSyA67u5upmU5aGI-Sl31nSMSOXXqATIsBpU",
  authDomain: "myaiwa-68f12.firebaseapp.com",
  projectId: "myaiwa-68f12",
  storageBucket: "myaiwa-68f12.firebasestorage.app",
  messagingSenderId: "1049648457684",
  appId: "1:1049648457684:web:2f30c922852210f9fd9841",
  measurementId: "G-LJ6D9FXM4X"
};

// INSTANS UTAMA (SINGLETON)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// INSTANS AUTH DENGAN LOCAL STORAGE PERSISTENCE
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Auth persistence setup:", err);
});

// INSTANS FIRESTORE DENGAN MULTI-TAB CACHE
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// INSTANS SEKUNDER (UNTUK PENDAFTARAN USER TANPA LOGOUT USER AKTIF)
export const secondaryApp = getApps().some(a => a.name === "SecondaryAuthApp") 
  ? getApp("SecondaryAuthApp") 
  : initializeApp(firebaseConfig, "SecondaryAuthApp");
export const secondaryAuth = getAuth(secondaryApp);
