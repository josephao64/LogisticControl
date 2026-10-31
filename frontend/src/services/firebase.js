import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
const config = {
  // Credenciales públicas de Firebase para el proyecto logisticcontroldb
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyAZxBOjSBJdFaPZX1UIZqeeOpcXhW0ljWg",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "logisticcontroldb.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "logisticcontroldb",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:808421489954:web:c9ce296c158e0dcebb397b",
};
export const configured = Object.values(config).every(Boolean);
export const auth = configured ? getAuth(initializeApp(config)) : null;
