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

// ═══════════ PEDIDOS ═══════════
function redondear2(n) { return Math.round(n * 100) / 100; }

// Crea el pedido con una TRANSACCIÓN:
// valida stock, descuenta, registra la bitácora y guarda el pedido, o no hace nada.
async function crearPedido(d) {
  const pedidoRef = db.collection("pedidos").doc();   // el id se genera antes
  const esDelivery = d.tipo === "delivery";

  await db.runTransaction(async (t) => {
    // 1) LECTURAS (Firestore exige leer todo antes de escribir)
    const refs = d.items.map(i => db.collection("productos").doc(i.producto_id));
    const docs = await Promise.all(refs.map(r => t.get(r)));
    const zonaDoc = esDelivery
      ? await t.get(db.collection("zonas_delivery").doc(d.zona_id))
      : null;

    if (esDelivery && (!zonaDoc.exists || !zonaDoc.data().activo)) {
      throw new Error("La zona de entrega seleccionada no está disponible");
    }

    // 2) VALIDAR y calcular con los datos REALES de la base, no con los del carrito
    const detalles = [];
    let subtotal = 0;
    docs.forEach((doc, i) => {
      const item = d.items[i];
      if (!doc.exists || !doc.data().activo) {
        throw new Error(`"${item.nombre}" ya no está disponible`);
      }
      const p = doc.data();
      if (p.stock_actual < item.cantidad) {
        throw new Error(`Stock insuficiente de "${p.nombre}": quedan ${p.stock_actual} ${p.unidad}`);
      }
      const sub = redondear2(p.precio * item.cantidad);
      subtotal = redondear2(subtotal + sub);
      detalles.push({
        producto_id: doc.id,
        nombre_producto: p.nombre,      // nombre COPIADO, no referencia
        cantidad: item.cantidad,
        precio_unitario: p.precio,      // precio CONGELADO al momento del pedido
        subtotal: sub,
        unidad: p.unidad
      });
    });

    const tarifa = esDelivery ? zonaDoc.data().tarifa : 0;
    const direccion = esDelivery
      ? `${zonaDoc.data().nombre} — Piso ${d.piso} — ${d.aula}` + (d.referencia ? ` (${d.referencia})` : "")
      : "Retiro en el Agro Market";

    // 3) ESCRITURAS
    detalles.forEach((det, i) => {
      t.update(refs[i], { stock_actual: redondear2(docs[i].data().stock_actual - det.cantidad) });
      t.set(db.collection("movimientos_stock").doc(), {
        producto_id: det.producto_id,
        tipo: "salida",
        cantidad: det.cantidad,
        motivo: "Pedido " + pedidoRef.id,
        usuario_id: d.usuario.uid,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    t.set(pedidoRef, {
      cliente_id: d.usuario.uid,
      cliente_nombre: d.usuario.nombreCompleto(),
      tipo: d.tipo,
      estado: "pendiente",
      subtotal,
      tarifa_envio: tarifa,
      total: redondear2(subtotal + tarifa),
      zona_id: esDelivery ? d.zona_id : null,
      direccion_entrega: direccion,
      forma_pago: d.pago.forma_pago,
      comprobante_url: d.pago.comprobante_url,
      repartidor_id: null,
      notas: d.notas || "",
      detalles,                                  // array embebido
      historial: [{                              // array append-only
        estado_nuevo: "pendiente",
        fecha: new Date().toISOString(),
        nota: "Pedido creado",
        usuario_id: d.usuario.uid
      }],
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });
  });

  return pedidoRef.id;
}

async function listarPedidosCliente(uid) {
  const snap = await db.collection("pedidos").where("cliente_id", "==", uid).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));
}