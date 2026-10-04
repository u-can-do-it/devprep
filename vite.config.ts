import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { devprepDataApi } from './plugins/data-api.ts';

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; the workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [solid(), devprepDataApi()],
});
