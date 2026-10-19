import { describe, expect, it } from 'vitest';
import { cleanTag, nextPlaybackFrame, tagAt, tagsAfterDelete, tagsAfterInsert } from './tags';

const walk = { name: 'walk', from: 1, to: 3 };
const idle = { name: 'idle', from: 5, to: 6 };

describe('tagAt', () => {
  it('finds the shortest tag containing a frame', () => {
    const blink = { name: 'blink', from: 2, to: 2 };
    expect(tagAt([walk, idle], 0)).toBeNull();
    expect(tagAt([walk, idle], 3)).toBe(walk);
    expect(tagAt([walk, blink], 2)).toBe(blink);
  });
});

describe('nextPlaybackFrame', () => {
  it('loops inside a tag', () => {
    expect(nextPlaybackFrame(1, 8, walk)).toBe(2);
    expect(nextPlaybackFrame(3, 8, walk)).toBe(1);
  });

  it('loops the whole animation without a tag, or outside it', () => {
    expect(nextPlaybackFrame(7, 8, null)).toBe(0);
    expect(nextPlaybackFrame(4, 8, walk)).toBe(5);
  });
});

describe('tagsAfterInsert', () => {
  it('shifts later tags and grows tags the frame lands in or right after', () => {
    expect(tagsAfterInsert([walk, idle], 2)).toEqual([
      { name: 'walk', from: 1, to: 4 },
      { name: 'idle', from: 6, to: 7 },
    ]);
    expect(tagsAfterInsert([walk], 4)).toEqual([{ name: 'walk', from: 1, to: 4 }]);
    expect(tagsAfterInsert([walk], 1)).toEqual([{ name: 'walk', from: 2, to: 4 }]);
    expect(tagsAfterInsert([walk], 6)).toEqual([walk]);
  });
});

describe('tagsAfterDelete', () => {
  it('shrinks or shifts tags and drops empty ones', () => {
    expect(tagsAfterDelete([walk, idle], 2)).toEqual([
      { name: 'walk', from: 1, to: 2 },
      { name: 'idle', from: 4, to: 5 },
    ]);
    expect(tagsAfterDelete([walk], 0)).toEqual([{ name: 'walk', from: 0, to: 2 }]);
    expect(tagsAfterDelete([{ name: 'one', from: 2, to: 2 }], 2)).toEqual([]);
    expect(tagsAfterDelete([walk], 7)).toEqual([walk]);
  });
});

describe('cleanTag', () => {
  it('orders and clamps the range and tidies the name', () => {
    expect(cleanTag({ name: '  run ', from: 9, to: -2 }, 4)).toEqual({
      name: 'run',
      from: 0,
      to: 3,
    });
    expect(cleanTag({ name: '', from: 1, to: 1 }, 4).name).toBe('Tag');
  });
});
