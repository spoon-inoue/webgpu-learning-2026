import type { UserConfig } from 'vite'
import glsl from 'vite-plugin-glsl'
import path from 'path'
import { globSync } from 'fs'

export default {
  root: 'src/',
  publicDir: '../public',
  server: { host: true },
  base: '/webgpu-learning-2026/',
  plugins: [glsl()],
  build: {
    outDir: '../dist',
    rollupOptions: {
      input: Object.fromEntries(
        globSync('src/**/*.html').map((file) => [file.slice('src/'.length, file.length - '.html'.length), path.resolve(__dirname, file)]),
      ),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@mod': path.resolve(__dirname, './src/modules'),
    },
  },
} satisfies UserConfig
