// ── PATRÓN STATE: estados válidos del pedido ──
const TRANSICIONES_VALIDAS = {
  pendiente: ["confirmado", "cancelado"],
  confirmado: ["en_preparacion", "cancelado"],
  en_preparacion: ["en_camino", "listo_para_retirar"],
  en_camino: ["entregado"],
  listo_para_retirar: ["entregado"],
  entregado: [],
  cancelado: []
};

function puedeTransicionar(estadoActual, nuevoEstado) {
  return (TRANSICIONES_VALIDAS[estadoActual] || []).includes(nuevoEstado);
}

// ── Obtener el usuario como OBJETO (con su clase) ──
async function obtenerUsuario(uid) {
  const doc = await db.collection("usuarios").doc(uid).get();
  if (!doc.exists) return null;
  return crearUsuarioDesdeDoc({ uid, ...doc.data() });
}

// ── Proteger páginas según rol ──
function protegerPagina(rolesPermitidos = []) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }
    const usuario = await obtenerUsuario(user.uid);
    if (!usuario || !usuario.activo) {
      await auth.signOut();
      window.location.href = "/login.html";
      return;
    }
    if (rolesPermitidos.length > 0 && !usuario.puedeAcceder(rolesPermitidos)) {
      window.location.href = usuario.rutaInicio(); // evita bucles
      return;
    }
    window.usuarioActual = usuario;
    if (typeof iniciarPagina === "function") iniciarPagina(usuario);
  });
}

async function cerrarSesion() {
  await auth.signOut();
  window.location.href = "/login.html";
}

function mostrarToast(mensaje, tipo = "success") {
  const t = document.createElement("div");
  t.className = `alert alert-${tipo} position-fixed top-0 end-0 m-3`;
  t.style.zIndex = 9999;
  t.textContent = mensaje;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Atajo secreto Ctrl+Shift+A ──
document.addEventListener("keydown", async (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === "A") {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    const usuario = await obtenerUsuario(user.uid);
    if (usuario && usuario.rol === "administrador") {
      window.location.href = "/admin/dashboard.html";
    }
  }
});