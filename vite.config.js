import react from '@vitejs/plugin-react'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'

const isPrivilegedKey = (value) => {
  if (!value) return false
  if (value.startsWith('sb_secret_')) return true

  const segments = value.split('.')
  if (segments.length !== 3) return false
  try {
    const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'))
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const publicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY

  if (isPrivilegedKey(publicKey)) {
    throw new Error('A privileged Supabase key cannot be used in a VITE_ browser variable.')
  }

  return { plugins: [react()] }
})
