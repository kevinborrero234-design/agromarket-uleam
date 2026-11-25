// ── USUARIOS ──
async function crearUsuarioDB(uid, { nombre, apellido, correo, rol = "cliente" }) {
  await db.collection("usuarios").doc(uid).set({
    nombre, apellido, correo, rol,
    activo: true,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ── IMÁGENES con Cloudinary ──
async function subirImagen(archivo, carpeta) {
  const form = new FormData();
  form.append("file", archivo);
  form.append("upload_preset", CLOUDINARY_PRESET);
  form.append("folder", carpeta);

  const resp = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: "POST", body: form }
  );
  if (!resp.ok) throw new Error("No se pudo subir la imagen");
  const data = await resp.json();
  return data.secure_url;
}

// ═══════════ UTILIDADES ═══════════
// Escapa texto antes de meterlo en HTML (evita inyección de código)
function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function slug(texto) {
  return texto.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
}

// ═══════════ CATEGORÍAS Y ZONAS ═══════════
async function listarCategorias() {
  const snap = await db.collection("categorias").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

async function listarZonas() {
  const snap = await db.collection("zonas_delivery").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// Se ejecuta UNA vez desde la consola del navegador (como administrador)
async function cargarDatosIniciales() {
  const categorias = ["Verduras", "Frutas", "Lácteos", "Hortalizas", "Otros"];
  const zonas = [
    { nombre: "Bloque A", tarifa: 0.50 },
    { nombre: "Bloque B", tarifa: 0.50 },
    { nombre: "Bloque C", tarifa: 0.75 },
    { nombre: "Bloque D", tarifa: 0.75 }
  ];
  const batch = db.batch();
  // El id sale del nombre: si lo ejecutas dos veces, no se duplican
  categorias.forEach(n =>
    batch.set(db.collection("categorias").doc(slug(n)), { nombre: n, activo: true }));
  zonas.forEach(z =>
    batch.set(db.collection("zonas_delivery").doc(slug(z.nombre)),
      { nombre: z.nombre, tarifa: z.tarifa, activo: true }));
  await batch.commit();
  console.log("✅ Categorías y zonas cargadas");
}

// ═══════════ PRODUCTOS ═══════════
// Sin orderBy: ordenamos en JS para no necesitar índices (Error 5 del PDF)
async function listarProductos(soloActivos = false) {
  let consulta = db.collection("productos");
  if (soloActivos) consulta = consulta.where("activo", "==", true);
  const snap = await consulta.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

async function registrarMovimiento(productoId, tipo, cantidad, motivo, usuarioId) {
  await db.collection("movimientos_stock").add({
    producto_id: productoId, tipo, cantidad, motivo,
    usuario_id: usuarioId,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function crearProducto(datos, usuarioId) {
  const ref = await db.collection("productos").add({
    ...datos,
    activo: true,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  });
  if (datos.stock_actual > 0) {
    await registrarMovimiento(ref.id, "entrada", datos.stock_actual, "Stock inicial", usuarioId);
  }
  return ref.id;
}

async function actualizarProducto(id, cambios) {
  await db.collection("productos").doc(id).update(cambios);
}

// Entrada de stock con transacción (reposición)
async function agregarStock(productoId, cantidad, motivo, usuarioId) {
  const ref = db.collection("productos").doc(productoId);
  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    t.update(ref, { stock_actual: (doc.data().stock_actual || 0) + cantidad });
  });
  await registrarMovimiento(productoId, "entrada", cantidad, motivo, usuarioId);
}

async function obtenerProducto(id) {
  const doc = await db.collection("productos").doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}