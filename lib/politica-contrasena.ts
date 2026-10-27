// Qué contraseña se acepta. Sin Prisma ni Node: la usa también el formulario
// del navegador para avisar mientras se escribe.
//
// Criterio: largo antes que símbolos raros. Una frase de 10 o más caracteres
// con letras y números es más difícil de adivinar que "P@ss1!" y más fácil de
// recordar para el equipo.

export const LARGO_MINIMO = 10;

export const REGLAS_CONTRASENA = [
  `Al menos ${LARGO_MINIMO} caracteres`,
  "Al menos una letra y un número",
  "Que no contenga tu nombre de usuario ni la palabra Pagasa",
  "Que no sea una de las contraseñas más comunes",
];

// Las que se prueban primero en cualquier ataque, y las obvias de aquí.
const COMUNES = [
  "contraseña", "contrasena", "password", "passw0rd", "qwerty", "abc123", "123456", "12345678",
  "123456789", "1234567890", "admin", "administrador", "bienvenido", "cambiarahora", "mantenimiento",
  "kinogas", "gaslp", "hermosillo", "sonora", "mexico", "iloveyou", "letmein", "welcome",
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// null = aceptada; si no, el motivo en español para mostrarlo tal cual.
export function problemaDeContrasena(contrasena: string, username?: string | null): string | null {
  if (contrasena.length < LARGO_MINIMO) return `La contraseña debe tener al menos ${LARGO_MINIMO} caracteres.`;
  if (contrasena.length > 200) return "La contraseña es demasiado larga.";
  if (!/\p{L}/u.test(contrasena) || !/\d/.test(contrasena)) return "La contraseña debe tener al menos una letra y un número.";
  const n = normalizar(contrasena);
  if (username && username.length >= 3 && n.includes(normalizar(username))) {
    return "La contraseña no puede contener tu nombre de usuario.";
  }
  if (n.includes("pagasa")) return "La contraseña no puede contener la palabra Pagasa.";
  // Común = la contraseña es una de la lista con a lo mucho números o
  // signos alrededor ("Password2026!", "admin12345").
  const nucleo = n.replace(/[^a-z]/g, "");
  if (COMUNES.some((c) => nucleo === c || n === c)) return "Esa contraseña es de las más comunes. Elige otra.";
  if (/^(.)\1+$/.test(contrasena) || /^(0123456789|1234567890|9876543210)/.test(contrasena)) {
    return "Esa contraseña es demasiado fácil de adivinar.";
  }
  return null;
}
