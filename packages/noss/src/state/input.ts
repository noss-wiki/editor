import type { EditorState } from ".";

export class KeybindManager {
  // TODO: Swith the null to a function of some sorts, or a `Command` or `Action`?
  readonly bindings: Record<string, null> = {};
  constructor(readonly state: EditorState) {}

  /**
   * Checks if the binding is worth waiting for.
   * It is worth waiting for if the binding exists or is a prefix of other bindings.
   */
  worthWaiting(binding: string) {
    for (const b in this.bindings) if (b === binding || b.startsWith(binding)) return true;
    return false;
  }

  exists(binding: string) {
    return this.bindings[binding] !== undefined;
  }

  call(binding: string) {}
}
