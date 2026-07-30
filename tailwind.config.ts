import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#054095",
          dark: "#032a63",
        },
        accent: {
          DEFAULT: "#D53F00",
          light: "#F7A540",
        },
        ink: "#4B4F58",
      },
    },
  },
  plugins: [],
} satisfies Config;
