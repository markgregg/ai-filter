// Global type declarations for Vite CSS Modules.
// vite-plugin-dts runs TypeScript independently of Vite's resolver,
// so this file makes *.module.less imports valid in both contexts.
declare module "*.module.less" {
  const styles: Record<string, string>;
  export default styles;
}

