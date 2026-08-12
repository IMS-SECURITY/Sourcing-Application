// Firebase browser client (Phase 1: wiring only, not yet used by the app).
// Safe to import from React components and browser-only code.
// The values below are PUBLIC identifiers by design — Firebase security comes
// from Firestore/Storage rules + Auth domain allowlist, not from hiding these.
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

// Guard against double-init during HMR / SSR.
export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth: Auth = getAuth(firebaseApp);

export const firestore: Firestore = getApps().length
  ? getFirestore(getApp())
  : initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });

export const googleProvider = new GoogleAuthProvider();
