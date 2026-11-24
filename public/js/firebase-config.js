// Reemplaza con los valores de TU proyecto (Configuración → Tus apps → Web)
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "agromarket-uleam.firebaseapp.com",
  projectId: "agromarket-uleam",
  appId: "TU_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

const DOMINIO_ULEAM = "@live.uleam.edu.ec";

// Cloudinary (reemplaza Firebase Storage)
const CLOUDINARY_CLOUD = "mpsrxlfj";
const CLOUDINARY_PRESET = "Agromarket-uleam";