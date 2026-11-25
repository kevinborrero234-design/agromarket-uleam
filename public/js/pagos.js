// ═══ PATRÓN STRATEGY ═══
// Cada forma de pago es una clase con la MISMA interfaz: validar() y procesar().
// El checkout no sabe cómo se paga: solo elige la estrategia y la ejecuta.

class EstrategiaPago {
  validar(contexto) { throw new Error("validar() no implementado"); }
  async procesar(contexto) { throw new Error("procesar() no implementado"); }
}

class PagoEfectivo extends EstrategiaPago {
  validar() { return { ok: true }; }
  async procesar() {
    return { forma_pago: "efectivo", comprobante_url: null };
  }
}

class PagoTransferencia extends EstrategiaPago {
  validar({ archivo }) {
    if (!archivo) return { ok: false, mensaje: "Sube el comprobante de transferencia" };
    if (!archivo.type.startsWith("image/")) return { ok: false, mensaje: "El comprobante debe ser una imagen" };
    if (archivo.size > 5 * 1024 * 1024) return { ok: false, mensaje: "La imagen no debe pesar más de 5 MB" };
    return { ok: true };
  }
  async procesar({ archivo }) {
    const url = await subirImagen(archivo, "comprobantes");
    return { forma_pago: "transferencia", comprobante_url: url };
  }
}

// Registro de estrategias: para agregar un pago nuevo (ej. QR) se crea una
// clase y se registra aquí. No se toca el checkout ni crearPedido().
const ESTRATEGIAS_PAGO = {
  efectivo: new PagoEfectivo(),
  transferencia: new PagoTransferencia()
};