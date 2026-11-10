import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Ensures the production build in dist/index.html works both on GitHub Pages (https://)
 * AND when opened directly from a local folder via double-click (file:// protocol),
 * by wrapping the single JS bundle in an IIFE and removing `type="module"` and `crossorigin`
 * attributes that trigger file:// CORS blocks in Chrome/Edge.
 */
function fileProtocolCompatiblePlugin(): Plugin {
  return {
    name: 'file-protocol-compatible',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk' && file.isEntry) {
          // Strip any trailing export statements and wrap in an IIFE for classic <script defer> execution
          const cleaned = file.code.replace(/export\s*\{[^}]*\}\s*;?\s*$/, '');
          file.code = `(function(){\n${cleaned}\n})();\n`;
        }
      }
    },
    transformIndexHtml(html) {
      return html
        // Remove the root-only file:// redirect script from dist/index.html
        .replace(/<script id="root-file-redirect">[\s\S]*?<\/script>/g, '')
        // Replace module script with standard deferred script so file:// loads it without CORS error
        .replace(
          /<script type="module" crossorigin src="([^"]+)"><\/script>/g,
          '<script defer src="$1"></script>'
        )
        // Remove crossorigin from stylesheet link so file:// loads CSS cleanly
        .replace(
          /<link rel="stylesheet" crossorigin href="([^"]+)">/g,
          '<link rel="stylesheet" href="$1">'
        );
    },
  };
}

// Configurable repository base path for GitHub Pages deployment
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const basePath = env.VITE_BASE_PATH || './';

  return {
    plugins: [react(), fileProtocolCompatiblePlugin()],
    base: basePath,
    build: {
      chunkSizeWarningLimit: 800,
    },
  };
});
