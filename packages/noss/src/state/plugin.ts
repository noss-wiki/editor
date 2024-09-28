import type { Result } from "@noss-editor/utils";
import type { Transaction } from "./transaction";
import { Ok } from "@noss-editor/utils";

/**
 * Editor Plugins follows a similar interface to vite/rollup style plugins.
 * As they're an object with hook methods.
 */
export interface Plugin {
  name: string;

  /**
   * This hook is called before a transaction is applied to the document.
   * It can be used to modify the transaction or skip it.
   *
   * @kind First
   * @returns An `Ok` with either a transaction (may modify the given one) or true, indicating that it should be applied, an `Err`, indicating that it should be skipped or undefined to let other plugins check filter the transaction.
   */
  filterTransaction?(tr: Transaction): Result<Transaction | true, null> | undefined | null;
}

export class PluginManager {
  constructor(readonly plugins: Plugin[]) {}

  filterTransaction(tr: Transaction): Result<Transaction, null> {
    for (const plugin of this.plugins) {
      const result = plugin.filterTransaction?.(tr);
      if (!result) continue;
      return result.map<Transaction, null>((val) => (val === true ? tr : val)).trace("PluginManager.filterTransaction");
    }
    return Ok(tr);
  }
}
