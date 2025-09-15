// Optional WASM bridge. If a wasm module is present at /wasm/presub_wasm.js
// (generated via wasm-pack), we dynamically import it and wire its scanner.
// This file is safe to include even if the wasm is absent.

import { setWasmScanner, OnScanMatch } from './scan';

type WasmModule = {
  // Expected export from wasm-pack glue JS: returns JSON string of matches
  // e.g., [{ kind: 'email'|'url', value: string }]
  scan_text_to_json: (input: string) => string;
  default?: unknown; // some bundlers require default init
  init?: () => Promise<void>;
};

let initialized = false;

export async function tryInitWasm(): Promise<boolean> {
  if (initialized) return true;
  try {
    const mod: WasmModule = await import(/* @vite-ignore */ '/wasm/presub_wasm.js');
    // Some glue requires calling an init; ignore if not present
    if (typeof (mod as any).default === 'function') {
      // default may be the init function returning a promise
      await (mod as any).default();
    } else if (typeof mod.init === 'function') {
      await mod.init();
    }

    if (typeof mod.scan_text_to_json === 'function') {
      setWasmScanner((text: string, onMatch: OnScanMatch) => {
        try {
          const json = mod.scan_text_to_json(text);
          const arr = JSON.parse(json) as Array<{ kind: 'email' | 'url'; value: string }>;
          for (const m of arr) {
            if (m && m.value && (m.kind === 'email' || m.kind === 'url')) {
              onMatch(m.value, m.kind);
            }
          }
        } catch {
          // Fallback silently if wasm fails
        }
      });
    }
    initialized = true;
    return true;
  } catch {
    // WASM not present or failed to load; stay in JS mode
    return false;
  }
}

