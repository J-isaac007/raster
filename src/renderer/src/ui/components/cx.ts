/** Joins class names, skipping falsy ones: `cx('btn', primary && 'btn-primary')`. */
export const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');
