import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Tribora',
      formats: ['umd', 'es'],
      fileName: (format) =>
        format === 'umd' ? 'tribora-sdk.js' : 'tribora-sdk.esm.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    sourcemap: true,
    target: 'es2020',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
