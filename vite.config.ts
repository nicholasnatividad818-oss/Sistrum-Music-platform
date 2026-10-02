import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {usableEnv} from './src/lib/env';
import {sistrumApiPlugin} from './server/devApiPlugin';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = usableEnv(env.SISTRUM_SUPABASE_URL) || usableEnv(env.VITE_SUPABASE_URL);
  const supabaseKey =
    usableEnv(env.SISTRUM_SUPABASE_PUBLISHABLE_KEY) ||
    usableEnv(env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    usableEnv(env.VITE_SUPABASE_ANON_KEY) ||
    usableEnv(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (supabaseUrl && !process.env.SISTRUM_SUPABASE_URL) process.env.SISTRUM_SUPABASE_URL = supabaseUrl;
  if (supabaseKey && !process.env.SISTRUM_SUPABASE_PUBLISHABLE_KEY) {
    process.env.SISTRUM_SUPABASE_PUBLISHABLE_KEY = supabaseKey;
  }

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [react(), tailwindcss(), sistrumApiPlugin(path.resolve(__dirname))],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
