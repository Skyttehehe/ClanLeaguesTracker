import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: "#f6eed8",
        forest: "#204b3a",
        fern: "#93a885",
        ember: "#b03a48",
        vscode: {
          bg: "#191a1b",       // page background
          surface: "#1e1f20",  // card / panel backgrounds
          raised: "#252627",   // table headers, elevated panels
          input: "#2d2e2f",    // form inputs, nested areas
          sep: "#2c2d2e",      // subtle separators
          border: "#363738",   // visible borders / dividers
        },
      },
      fontFamily: {
        display: ["Trebuchet MS", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
