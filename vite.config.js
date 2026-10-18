import { defineConfig } from 'vite';
// Relative base so dist/ works at any path (GitHub Pages subpath, local preview). es2022 for top-level await (font wait).
export default defineConfig({ base: './', build: { target: 'es2022' } });
