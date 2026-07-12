import path from 'node:path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const SYSTEM_ID = 'shimmeringreach';

export default defineConfig({
    base: `/systems/${SYSTEM_ID}/`,
    publicDir: false,
    resolve: {
        alias: { '@': path.resolve(__dirname, 'src') },
    },
    build: {
        outDir: 'dist',
        // dist/ is a live Docker bind-mount; wiping the mount root confuses the container.
        emptyOutDir: false,
        sourcemap: true,
        target: 'es2022',
        // Roll.fromData resolves subclasses by their class NAME string. Minifying renames
        // RollDP and every chat card silently fails to rehydrate. Do not turn this on.
        minify: false,
        lib: {
            entry: path.resolve(__dirname, 'src/module/shimmeringreach.ts'),
            formats: ['es'],
            fileName: () => `${SYSTEM_ID}.js`,
        },
        rollupOptions: {
            output: {
                assetFileNames: (asset) =>
                    asset.names?.some((n) => n.endsWith('.css'))
                        ? `${SYSTEM_ID}.css`
                        : 'assets/[name][extname]',
            },
        },
    },
    plugins: [
        viteStaticCopy({
            targets: [
                { src: 'system.json', dest: '.' },
                { src: 'src/templates', dest: '.' },
                { src: 'lang', dest: '.' },
                { src: 'assets', dest: '.' },
            ],
        }),
    ],
});
