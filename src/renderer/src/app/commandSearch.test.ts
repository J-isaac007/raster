import { describe, expect, it } from 'vitest';
import { matchScore, searchItems } from './commandSearch';

describe('matchScore', () => {
  it('matches letters in order and rejects others', () => {
    expect(matchScore('flh', 'Flip Horizontal')).not.toBeNull();
    expect(matchScore('hfl', 'Flip Horizontal')).toBeNull();
    expect(matchScore('', 'anything')).toBe(0);
  });

  it('prefers substrings, then word starts', () => {
    const substring = matchScore('flip', 'Edit Flip Horizontal')!;
    const scattered = matchScore('flip', 'Fill Lip Pencil')!;
    expect(substring).toBeGreaterThan(scattered);
    expect(matchScore('rot', 'Rotate 90° CW')!).toBeGreaterThan(matchScore('rot', 'Carrot')!);
  });
});

describe('searchItems', () => {
  const items = ['New Sprite…', 'Flip Horizontal', 'Flip Vertical', 'Export…', 'Undo'];

  it('filters and ranks, keeping ties in order', () => {
    expect(searchItems(items, 'flip', (s) => s)).toEqual(['Flip Horizontal', 'Flip Vertical']);
    expect(searchItems(items, 'ex', (s) => s)[0]).toBe('Export…');
    expect(searchItems(items, '', (s) => s)).toEqual(items);
  });
});
