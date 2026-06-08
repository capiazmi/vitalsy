import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: {
        // better-auth ships optional kysely sqlite/d1 dialects we don't use
        // (we use the Prisma adapter). Keep them external so the server bundle
        // never statically analyses the mismatched kysely build.
        external: [
          /^@sentry\//,
          'kysely',
          /^@better-auth\/kysely-adapter/,
          // OCR libs load from node_modules at runtime (workers/wasm/native-ish)
          'tesseract.js',
          'jimp',
          '@anthropic-ai/sdk',
          'ollama',
          'nodemailer',
        ],
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
