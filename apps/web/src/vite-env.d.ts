/// <reference types="vite/client" />

declare module '*.json' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vite JSON module typing
  const value: any;
  export default value;
}


