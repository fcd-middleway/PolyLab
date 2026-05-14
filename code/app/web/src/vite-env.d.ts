/// <reference types="vite/client" />

// Type declarations for CSS module imports
declare module '*.css' {
  const content: string;
  export default content;
}

// Type declarations for WASM module
declare module '*.wasm' {
  const content: string;
  export default content;
}
