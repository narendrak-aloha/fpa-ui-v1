import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    frappeui({
      frappeProxy: false,
      jinjaBootData: false,
      buildConfig: false,
    }),
    vue(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  optimizeDeps: {
    // frappe-ui ships .vue source, so Vite can't pre-bundle the libraries its
    // components import. Without this, dev loads ~1900 separate module files.
    include: [
      'feather-icons',
      'socket.io-client',
      'frappe-ui > reka-ui',
      'frappe-ui > echarts',
      'frappe-ui > lowlight',
      'frappe-ui > @headlessui/vue',
      'frappe-ui > @popperjs/core',
      'frappe-ui > @vueuse/core',
      'frappe-ui > dayjs/esm',
      'frappe-ui > grid-layout-plus',
      'frappe-ui > @tiptap/vue-3',
      'frappe-ui > @tiptap/core',
      'frappe-ui > @tiptap/starter-kit',
      'frappe-ui > @tiptap/pm/state',
      'frappe-ui > @tiptap/pm/view',
      'frappe-ui > @tiptap/pm/model',
    ],
  },
  server: {
    port: 8080,
    proxy: {
      '^/(app|api|assets|files)': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
