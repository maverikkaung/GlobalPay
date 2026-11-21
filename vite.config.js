import react from '@vitejs/plugin-react'
import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import { getSupabaseBrowserConfig } from './src/supabase-config.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_SUPABASE_')
  const { reason } = getSupabaseBrowserConfig(env)

  if (reason === 'privileged-key') {
    throw new Error('A privileged Supabase key cannot be used in a VITE_ browser variable.')
  }
  if (reason === 'invalid-url') {
    throw new Error('Use an HTTPS Supabase URL or a local loopback development URL.')
  }

  return {
    plugins: [react()],
    envPrefix: [],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? ''),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? ''),
    },
  }
})
