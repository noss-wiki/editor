export type TextDiff =
  | {
      start: number;
      end: number;
      change: string;
      type: "insert" | "delete" | "none";
    }
  | {
      start: number;
      end: number;
      added: string;
      removed: string;
      type: "replace";
    };

// Inspired by this answer: https://stackoverflow.com/a/29402724
export function diffText(old: string, modified: string): TextDiff {
  if (old === modified) return { start: 0, end: 0, change: "", type: "none" };

  let start = 0;
  while (start < old.length && modified.length && old[start] === modified[start]) start++;

  let e = 0;
  while (
    e < old.length &&
    e < modified.length &&
    old.length - e > start &&
    modified.length - e > start &&
    old[old.length - 1 - e] === modified[modified.length - 1 - e]
  ) {
    e++;
  }

  const oEnd = old.length - e;
  const mEnd = modified.length - e;

  const added = mEnd - start;
  const removed = oEnd - start;

  if (added > 0 && removed > 0)
    return { start, end: oEnd, added: modified.slice(start, mEnd), removed: old.slice(start, oEnd), type: "replace" };
  else if (added > 0) return { start, end: oEnd, change: modified.slice(start, mEnd), type: "insert" };
  else if (removed > 0) return { start, end: oEnd, change: old.slice(start, oEnd), type: "delete" };
  else return { start: 0, end: 0, change: "", type: "none" };
}
