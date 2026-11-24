const firebaseConfig = {
  apiKey: "AIzaSyCpm_yN6szv_59zCZlZeM_8qjAZ2SrWeJs",
  authDomain: "agromarket-uleam-4523b.firebaseapp.com",
  projectId: "agromarket-uleam-4523b",
  storageBucket: "agromarket-uleam-4523b.firebasestorage.app",
  messagingSenderId: "411023695198",
  appId: "1:411023695198:web:acb4b56db5a89e193403cf",
  authDomain: "agromarket-uleam-4523b.firebaseapp.com",
  projectId: "agromarket-uleam-4523b",
  appId: "1:411023695198:web:acb4b56db5a89e193403cf"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

const DOMINIOS_PERMITIDOS = ["@uleam.edu.ec", "@live.uleam.edu.ec"];

function esCorreoUleam(correo) {
  return DOMINIOS_PERMITIDOS.some(d => correo.toLowerCase().endsWith(d));
}

// Cloudinary (reemplaza Firebase Storage)
const CLOUDINARY_CLOUD = "mpsrxlfj";
const CLOUDINARY_PRESET = "Agromarket-uleam";