import { registerPlugin } from '@capacitor/core';

export interface ThermalPrintPlugin {
  /** Renders the given HTML off-screen and opens Android's native print dialog for it. */
  print(options: { html: string }): Promise<void>;
}

// Native-only (see android/app/src/main/java/com/obix/app/ThermalPrintPlugin.java) —
// on web this proxy exists but is never called.
export const ThermalPrint = registerPlugin<ThermalPrintPlugin>('ThermalPrint');
