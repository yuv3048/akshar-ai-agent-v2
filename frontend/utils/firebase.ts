import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const app = apiKey ? (getApps().length ? getApp() : initializeApp({
  apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ai-agent-3efdb.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ai-agent-3efdb",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ai-agent-3efdb.firebasestorage.app",
  appId: import.meta.env.VITE_FIREBASE_APP_ID
})) : null;
export const auth = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();
export const firebaseEnabled = Boolean(auth);