
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Custom plugin to remove Tailwind CDN during development and build
// so it doesn't conflict with the local Tailwind setup
const removeTailwindCDN = () => {
  return {
    name: 'remove-tailwind-cdn',
    transformIndexHtml(html: string) {
      // Remove the CDN script tag
      let newHtml = html.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/, '');
      
      // Remove the configuration script tag containing tailwind.config
      // Matches <script>...tailwind.config...</script> across multiple lines
      newHtml = newHtml.replace(/<script>[\s\S]*?tailwind\.config[\s\S]*?<\/script>/, '');
      
      return newHtml;
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), removeTailwindCDN()],
  // Use relative paths ('./') so the app works on https://<user>.github.io/<repo>/ 
  // without needing to hardcode the repository name.
  base: './', 
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
