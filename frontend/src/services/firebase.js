import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
const config = {
  // Conserva la configuracion publica del proyecto original. Las variables de
  // entorno permiten cambiar de proyecto sin modificar el codigo.
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyDIJeloM-Dk2To_0v_mfFKUuyhZebvbFWA",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "db-logistica.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "db-logistica",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:269299016652:web:5662cdd44b1211a84d7369",
};
export const configured = Object.values(config).every(Boolean);
export const auth = configured ? getAuth(initializeApp(config)) : null;
