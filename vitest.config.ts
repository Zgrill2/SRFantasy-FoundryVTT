import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: { '@': path.resolve(__dirname, 'src') },
    },
    test: {
        // Only our tests. The reference copies (SR5-FoundryVTT/, char-creator/) ship their
        // own suites and must not be collected.
        include: ['tests/**/*.test.ts'],
        environment: 'node',
    },
});
