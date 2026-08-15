import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Roboto si está instalada en el equipo; si no, la del sistema. Ya no
        // se descarga de Google al compilar (ver app/layout.tsx).
        sans: ["Roboto", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Los tres azules de grupopagasa.com.mx: la barra de navegación
        // (#054095), los botones de llamada a la acción (#00258E) y los
        // títulos de sección (#0264BB).
        primary: {
          DEFAULT: "#054095",
          dark: "#032a63",
          deep: "#00258E",
          bright: "#0264BB",
        },
        accent: {
          DEFAULT: "#D53F00",
          light: "#F7A540",
          bright: "#FF5823",
        },
        ink: "#111318",
      },
    },
  },
  plugins: [],
} satisfies Config;
