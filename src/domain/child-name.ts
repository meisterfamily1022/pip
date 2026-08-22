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
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}
