/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16201c",
        moss: "#3f6b57",
        mint: "#d7f2e5",
        coral: "#ef7b68",
        cloud: "#f7faf8",
      },
      boxShadow: {
        panel: "0 18px 60px rgba(22, 32, 28, 0.12)",
      },
    },
  },
  plugins: [],
}
