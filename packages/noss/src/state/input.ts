export interface KeyPressEvent {
  key: string;
  modifiers: {
    /**
     * Alt (Option on Mac) key
     */
    alt: boolean;
    /**
     * Control key
     */
    ctrl: boolean;
    /**
     * Meta key (Command on Mac, Windows key on Windows and Super on Linux)
     */
    meta: boolean;
    /**
     * Shift key
     */
    shift: boolean;
  };
}

export function eventToString(event: KeyPressEvent): string {
  let str = "";
  if (event.modifiers.ctrl) str += "ctrl-";
  if (event.modifiers.meta) str += "meta-";
  if (event.modifiers.alt) str += "alt-";
  if (event.modifiers.shift) str += "shift-";
  str += event.key;
  return str;
}
