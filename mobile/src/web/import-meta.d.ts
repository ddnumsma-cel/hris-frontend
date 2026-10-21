// The website's code reads Vite's import.meta.env; in the app it's empty (the backend address is set at sign-in).
interface ImportMeta {
  readonly env: { readonly [key: string]: string | boolean | undefined };
}
