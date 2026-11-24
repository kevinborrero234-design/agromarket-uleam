// Clase base: lo que TODO usuario tiene en común
class Usuario {
  constructor({ uid, nombre, apellido, correo, rol, activo = true }) {
    this.uid = uid;
    this.nombre = nombre;
    this.apellido = apellido;
    this.correo = correo;
    this.rol = rol;
    this.activo = activo;
  }

  nombreCompleto() {
    return `${this.nombre} ${this.apellido}`;
  }

  // Polimorfismo: cada subclase redefine estos métodos
  rutaInicio() { return "/catalogo.html"; }
  puedeAcceder(rolesPermitidos) { return rolesPermitidos.includes(this.rol); }
}

class Cliente extends Usuario {
  constructor(datos) { super({ ...datos, rol: "cliente" }); }
  rutaInicio() { return "/catalogo.html"; }
}

class Administrador extends Usuario {
  constructor(datos) { super({ ...datos, rol: "administrador" }); }
  rutaInicio() { return "/admin/dashboard.html"; }
  // El admin puede entrar a cualquier sección
  puedeAcceder() { return true; }
}

class Repartidor extends Usuario {
  constructor(datos) { super({ ...datos, rol: "repartidor" }); }
  rutaInicio() { return "/repartidor/entregas.html"; }
}

// Fábrica: convierte un documento de Firestore en el objeto correcto
function crearUsuarioDesdeDoc(datos) {
  const mapa = { cliente: Cliente, administrador: Administrador, repartidor: Repartidor };
  const Clase = mapa[datos.rol] || Cliente;
  return new Clase(datos);
}