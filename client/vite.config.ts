import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // "/players": "http://localhost:4000",
      "/leagues": "http://localhost:4000",
      "/teams": "http://localhost:4000",
      "/nfl": "http://localhost:4000",
      "/api": "http://localhost:4000",
    }
  }
})
