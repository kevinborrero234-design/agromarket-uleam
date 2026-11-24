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