/**
 * The one canonical rule for deciding whether two child names are the same
 * name.
 *
 * It lives here, below both the repository and the service, because the
 * uniqueness constraint is enforced in two places that must agree exactly: the
 * check the service makes before writing, and the `normalized_name` column the
 * database's unique index is built on. An approximation of this rule expressed
 * in SQL would drift from it — which is why the column is written from this
 * function rather than computed by SQLite.
 *
 * Case is folded, surrounding space is dropped, and every run of whitespace —
 * spaces, tabs, newlines, of any length — collapses to a single space, so
 * "  sam   smith " and "Sam\tSmith" are one name.
 */
export function normalizeChildName(name: string): string {
  return collapseWhitespace(name).toLowerCase();
}

/**
 * The form a name is stored and shown in.
 *
 * Case is the parent's to choose, but runs of whitespace are not meaningful in
 * a nickname and iOS makes them easy to produce by accident — a stray repeated
 * space renders as a gap wide enough to look like two separate names in the
 * children list. Collapsing on save keeps what is stored equal to what is
 * shown.
 */
export function collapseWhitespace(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
