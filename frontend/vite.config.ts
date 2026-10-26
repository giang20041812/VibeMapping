import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Đọc .env ở thư mục gốc dự án; chỉ biến có tiền tố VITE_ được đưa ra trình duyệt
  envDir: '..',
  server: {
    port: 5173,
    host: true, // Allow network access for testing on Samsung/Android devices in same Wi-Fi
  },
});
