export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const ls = (global as unknown as Record<string, unknown>).localStorage;
    if (ls && typeof (ls as Record<string, unknown>).getItem !== "function") {
      (global as unknown as Record<string, unknown>).localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        length: 0,
        key: () => null,
      };
    }
  }
}
