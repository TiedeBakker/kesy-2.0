import type { Config } from "tailwindcss";
// Importeer de typography plugin (indien nodig, vaak herkent tailwind het ook via require)
const typography = require('@tailwindcss/typography');

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // Zorg dat de map waar je RichTextEditorModal.tsx staat hier ook bij staat!
  ],
  theme: {
    extend: {
      // Je bestaande Slate-kleuren en thema-instellingen
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  // HIER MOET DE PLUGIN WORDEN TOEGEVOEGD
  plugins: [
    typography,
  ],
};
export default config;