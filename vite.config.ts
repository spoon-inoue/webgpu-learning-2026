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
      input: getInputs(),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@mod': path.resolve(__dirname, './src/modules'),
    },
  },
} satisfies UserConfig

function getInputs() {
  const list: [string, string][] = []
  for (const file of globSync('src/**/*.html')) {
    const key = file.slice('src/'.length, file.length - '.html'.length)
    if (!key.includes('components')) {
      list.push([key, path.resolve(__dirname, file)])
    }
  }
  if (0 < list.length) {
    return Object.fromEntries(list)
  }
}
