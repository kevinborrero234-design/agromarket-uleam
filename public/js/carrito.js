const CLAVE_CARRITO = "agromarket_carrito";

const redondear = (n) => Math.round(n * 100) / 100;

// Paso mínimo según la unidad: unidades y atados enteros, el resto admite decimales
function pasoDe(unidad) {
  return (unidad === "unidad" || unidad === "atado") ? 1 : 0.25;
}

// ENCAPSULAMIENTO: las páginas no tocan el arreglo ni localStorage,
// solo llaman a los métodos de esta clase
class Carrito {
  constructor() {
    this.items = this._cargar();
  }

  _cargar() {
    try { return JSON.parse(localStorage.getItem(CLAVE_CARRITO)) || []; }
    catch (e) { return []; }
  }

  _guardar() {
    try { localStorage.setItem(CLAVE_CARRITO, JSON.stringify(this.items)); } catch (e) {}
    window.dispatchEvent(new Event("carrito-cambio"));
  }

  agregar(producto, cantidad) {
    if (isNaN(cantidad) || cantidad <= 0) {
      return { ok: false, mensaje: "Ingresa una cantidad válida" };
    }
    const existente = this.items.find(i => i.producto_id === producto.id);
    const nueva = redondear((existente ? existente.cantidad : 0) + cantidad);

    if (nueva > producto.stock_actual) {
      return { ok: false, mensaje: `Solo hay ${producto.stock_actual} ${producto.unidad} disponibles` };
    }
    if (existente) {
      existente.cantidad = nueva;
      existente.stock_max = producto.stock_actual;
    } else {
      this.items.push({
        producto_id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        unidad: producto.unidad,
        imagen_url: producto.imagen_url || null,
        cantidad: redondear(cantidad),
        stock_max: producto.stock_actual
      });
    }
    this._guardar();
    return { ok: true, mensaje: `${producto.nombre} agregado al carrito` };
  }

  cambiarCantidad(productoId, cantidad) {
    const item = this.items.find(i => i.producto_id === productoId);
    if (!item) return { ok: false, mensaje: "Producto no encontrado" };
    if (isNaN(cantidad) || cantidad < pasoDe(item.unidad)) {
      return { ok: false, mensaje: "Cantidad mínima: " + pasoDe(item.unidad) };
    }
    if (cantidad > item.stock_max) {
      return { ok: false, mensaje: `Solo hay ${item.stock_max} ${item.unidad} disponibles` };
    }
    item.cantidad = redondear(cantidad);
    this._guardar();
    return { ok: true };
  }

  quitar(productoId) {
    this.items = this.items.filter(i => i.producto_id !== productoId);
    this._guardar();
  }

  vaciar() {
    this.items = [];
    this._guardar();
  }

  subtotal() {
    return redondear(this.items.reduce((s, i) => s + i.precio * i.cantidad, 0));
  }

  cantidadItems() {
    return this.items.length;
  }

  // Compara el carrito con el catálogo ACTUAL (precios y stock pueden haber cambiado)
  // mapa: { idProducto: producto }
  sincronizar(mapa) {
    const avisos = [];
    this.items = this.items.filter(it => {
      const p = mapa[it.producto_id];
      if (!p || !p.activo || p.stock_actual <= 0) {
        avisos.push(`"${it.nombre}" ya no está disponible y se quitó del carrito`);
        return false;
      }
      it.precio = p.precio;
      it.unidad = p.unidad;
      it.imagen_url = p.imagen_url || null;
      it.stock_max = p.stock_actual;
      if (it.cantidad > p.stock_actual) {
        it.cantidad = p.stock_actual;
        avisos.push(`Ajustamos "${it.nombre}" a ${p.stock_actual} ${p.unidad} (stock disponible)`);
      }
      return true;
    });
    this._guardar();
    return avisos;
  }
}