/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    {
      pattern: /hljs+/,
    },
  ],
  theme: {
    extend: {},
    hljs: {
      theme: "rainbow",
    },
  },
  plugins: [require("tailwind-highlightjs")],
};
