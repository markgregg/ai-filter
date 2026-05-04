// Global type declarations for Vite CSS Modules.
// vite-plugin-dts runs TypeScript independently of Vite's resolver,
// so this file makes *.module.css imports valid in both contexts.
declare module "*.module.css" {
  const styles: Record<string, string>;
  export default styles;
}
