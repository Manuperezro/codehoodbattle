import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Ensures the production build in dist/ works everywhere:
 * 1. GitHub Pages via GitHub Actions (dist/ root)
 * 2. GitHub Pages via 'Deploy from branch: main / (root)' (using prebuilt ./dist/assets/app.js)
 * 3. Direct local double-click in File Explorer (file:// protocol)
 */
function universalStaticBuildPlugin(): Plugin {
  return {
    name: 'universal-static-build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk' && file.isEntry) {
          const cleaned = file.code.replace(/export\s*\{[^}]*\}\s*;?\s*$/, '');
          file.code = `(function(){\n${cleaned}\n})();\n`;
        }
      }
    },
    transformIndexHtml(html) {
      return html
        // Remove root-only fallback tags when generating dist/index.html
        .replace(/<link id="fallback-dist-css"[^>]*>/g, '')
        .replace(/<script id="fallback-dist-js">[\s\S]*?<\/script>/g, '')
        // Use classic deferred script (no type="module" or crossorigin) so file:// and Pages both work
        .replace(
          /<script type="module" crossorigin src="([^"]+)"><\/script>/g,
          '<script defer src="$1"></script>'
        )
        .replace(
          /<link rel="stylesheet" crossorigin href="([^"]+)">/g,
          '<link rel="stylesheet" href="$1">'
        );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const basePath = env.VITE_BASE_PATH || './';

  return {
    plugins: [react(), universalStaticBuildPlugin()],
    base: basePath,
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/app.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/app.[ext]',
        },
      },
    },
  };
});
