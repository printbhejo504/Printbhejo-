import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        tools: "tools.html",
        "word-to-pdf": "word-to-pdf.html",
        "pdf-to-word": "pdf-to-word.html",
        "image-to-pdf": "image-to-pdf.html",
        "passport-photo": "passport-photo.html",
      },
    },
  },
});
