import { fromHex, rgba, type Color } from './color';

/**
 * The palettes that ship with Raster. Colors and credits come from Lospec
 * (https://lospec.com/palette-list); `source` is the palette's page there.
 * Hardware palettes are credited to the machine. See docs/palettes.md.
 */

export const PALETTE_GROUPS = [
  'Popular',
  'Consoles & computers',
  'Small & 1-bit',
  'Ramps',
] as const;
export type PaletteGroup = (typeof PALETTE_GROUPS)[number];

export interface BuiltinPalette {
  id: string;
  name: string;
  author: string;
  group: PaletteGroup;
  /** Where the palette is published, or null for ones generated here. */
  source: string | null;
  colors: readonly Color[];
}

const palette = (
  id: string,
  name: string,
  author: string,
  group: PaletteGroup,
  slug: string,
  hexes: string,
): BuiltinPalette => ({
  id,
  name,
  author,
  group,
  source: `https://lospec.com/palette-list/${slug}`,
  colors: hexes.split(' ').map((h) => fromHex(h)!),
});

/** Evenly spaced grays from black to white. */
const grayscale = (steps: number): BuiltinPalette => ({
  id: `grayscale-${steps}`,
  name: `Grayscale ${steps}`,
  author: 'Raster',
  group: 'Ramps',
  source: null,
  colors: Array.from({ length: steps }, (_, i) => {
    const v = Math.round((i / (steps - 1)) * 255);
    return rgba(v, v, v);
  }),
});

export const BUILTIN_PALETTES: readonly BuiltinPalette[] = [
  palette(
    'pico-8',
    'PICO-8',
    'Lexaloffle Games',
    'Popular',
    'pico-8',
    '000000 1d2b53 7e2553 008751 ab5236 5f574f c2c3c7 fff1e8 ff004d ffa300 ffec27 00e436 29adff 83769c ff77a8 ffccaa',
  ),
  palette(
    'sweetie-16',
    'Sweetie 16',
    'GrafxKid',
    'Popular',
    'sweetie-16',
    '1a1c2c 5d275d b13e53 ef7d57 ffcd75 a7f070 38b764 257179 29366f 3b5dc9 41a6f6 73eff7 f4f4f4 94b0c2 566c86 333c57',
  ),
  palette(
    'endesga-32',
    'Endesga 32',
    'ENDESGA',
    'Popular',
    'endesga-32',
    'be4a2f d77643 ead4aa e4a672 b86f50 733e39 3e2731 a22633 e43b44 f77622 feae34 fee761 63c74d 3e8948 265c42 193c3e 124e89 0099db 2ce8f5 ffffff c0cbdc 8b9bb4 5a6988 3a4466 262b44 181425 ff0044 68386c b55088 f6757a e8b796 c28569',
  ),
  palette(
    'endesga-64',
    'Endesga 64',
    'ENDESGA',
    'Popular',
    'endesga-64',
    'ff0040 131313 1b1b1b 272727 3d3d3d 5d5d5d 858585 b4b4b4 ffffff c7cfdd 92a1b9 657392 424c6e 2a2f4e 1a1932 0e071b 1c121c 391f21 5d2c28 8a4836 bf6f4a e69c69 f6ca9f f9e6cf edab50 e07438 c64524 8e251d ff5000 ed7614 ffa214 ffc825 ffeb57 d3fc7e 99e65f 5ac54f 33984b 1e6f50 134c4c 0c2e44 00396d 0069aa 0098dc 00cdf9 0cf1ff 94fdff fdd2ed f389f5 db3ffd 7a09fa 3003d9 0c0293 03193f 3b1443 622461 93388f ca52c9 c85086 f68187 f5555d ea323c c42430 891e2b 571c27',
  ),
  palette(
    'resurrect-64',
    'Resurrect 64',
    'Kerrie Lake',
    'Popular',
    'resurrect-64',
    '2e222f 3e3546 625565 966c6c ab947a 694f62 7f708a 9babb2 c7dcd0 ffffff 6e2727 b33831 ea4f36 f57d4a ae2334 e83b3b fb6b1d f79617 f9c22b 7a3045 9e4539 cd683d e6904e fbb954 4c3e24 676633 a2a947 d5e04b fbff86 165a4c 239063 1ebc73 91db69 cddf6c 313638 374e4a 547e64 92a984 b2ba90 0b5e65 0b8a8f 0eaf9b 30e1b9 8ff8e2 323353 484a77 4d65b4 4d9be6 8fd3ff 45293f 6b3e75 905ea9 a884f3 eaaded 753c54 a24b6f cf657f ed8099 831c5d c32454 f04f78 f68181 fca790 fdcbb0',
  ),
  palette(
    'aap-64',
    'AAP-64',
    'Adigun A. Polack',
    'Popular',
    'aap-64',
    '060608 141013 3b1725 73172d b4202a df3e23 fa6a0a f9a31b ffd541 fffc40 d6f264 9cdb43 59c135 14a02e 1a7a3e 24523b 122020 143464 285cc4 249fde 20d6c7 a6fcdb ffffff fef3c0 fad6b8 f5a097 e86a73 bc4a9b 793a80 403353 242234 221c1a 322b28 71413b bb7547 dba463 f4d29c dae0ea b3b9d1 8b93af 6d758d 4a5462 333941 422433 5b3138 8e5252 ba756a e9b5a3 e3e6ff b9bffb 849be4 588dbe 477d85 23674e 328464 5daf8d 92dcba cdf7e2 e4d2aa c7b08b a08662 796755 5a4e44 423934',
  ),
  palette(
    'dawnbringer-16',
    'DawnBringer 16',
    'DawnBringer',
    'Popular',
    'dawnbringer-16',
    '140c1c 442434 30346d 4e4a4e 854c30 346524 d04648 757161 597dce d27d2c 8595a1 6daa2c d2aa99 6dc2ca dad45e deeed6',
  ),
  palette(
    'dawnbringer-32',
    'DawnBringer 32',
    'DawnBringer',
    'Popular',
    'dawnbringer-32',
    '000000 222034 45283c 663931 8f563b df7126 d9a066 eec39a fbf236 99e550 6abe30 37946e 4b692f 524b24 323c39 3f3f74 306082 5b6ee1 639bff 5fcde4 cbdbfc ffffff 9badb7 847e87 696a6a 595652 76428a ac3232 d95763 d77bba 8f974a 8a6f30',
  ),
  palette(
    'apollo',
    'Apollo',
    'AdamCYounis',
    'Popular',
    'apollo',
    '172038 253a5e 3c5e8b 4f8fba 73bed3 a4dddb 19332d 25562e 468232 75a743 a8ca58 d0da91 4d2b32 7a4841 ad7757 c09473 d7b594 e7d5b3 341c27 602c2c 884b2b be772b de9e41 e8c170 241527 411d31 752438 a53030 cf573c da863e 1e1d39 402751 7a367b a23e8c c65197 df84a5 090a14 10141f 151d28 202e37 394a50 577277 819796 a8b5b2 c7cfcc ebede9',
  ),
  palette(
    'lospec500',
    'Lospec500',
    'Lospec community',
    'Popular',
    'lospec500',
    '10121c 2c1e31 6b2643 ac2847 ec273f 94493a de5d3a e98537 f3a833 4d3533 6e4c30 a26d3f ce9248 dab163 e8d282 f7f3b7 1e4044 006554 26854c 5ab552 9de64e 008b8b 62a477 a6cb96 d3eed3 3e3b65 3859b3 3388de 36c5f4 6dead6 5e5b8c 8c78a5 b0a7b8 deceed 9a4d76 c878af cc99ff fa6e79 ffa2ac ffd1d5 f6e8e0 ffffff',
  ),
  palette(
    'vinik24',
    'Vinik24',
    'Vinik',
    'Popular',
    'vinik24',
    '000000 6f6776 9a9a97 c5ccb8 8b5580 c38890 a593a5 666092 9a4f50 c28d75 7ca1c0 416aa3 8d6268 be955c 68aca9 387080 6e6962 93a167 6eaa78 557064 9d9f7f 7e9e99 5d6872 433455',
  ),
  palette(
    'island-joy-16',
    'Island Joy 16',
    'Kerrie Lake',
    'Popular',
    'island-joy-16',
    'ffffff 6df7c1 11adc1 606c81 393457 1e8875 5bb361 a1e55a f7e476 f99252 cb4d68 6a3771 c92464 f48cb6 f7b69e 9b9c82',
  ),
  palette(
    'steam-lords',
    'Steam Lords',
    'Slynyrd',
    'Popular',
    'steam-lords',
    '213b25 3a604a 4f7754 a19f7c 77744f 775c4f 603b3a 3b2137 170e19 2f213b 433a60 4f5277 65738c 7c94a1 a0b9ba c0d1cc',
  ),
  palette(
    'arne-16',
    'Arne 16',
    'Arne Niklas Jansson',
    'Popular',
    'arne-16',
    '000000 493c2b be2633 e06f8b 9d9d9d a46422 eb8931 f7e26b ffffff 1b2632 2f484e 44891a a3ce27 005784 31a2f2 b2dcef',
  ),
  palette(
    'bubblegum-16',
    'Bubblegum 16',
    'PineappleOnPizza',
    'Popular',
    'bubblegum-16',
    '16171a 7f0622 d62411 ff8426 ffd100 fafdff ff80a4 ff2674 94216a 430067 234975 68aed4 bfff3c 10d275 007899 002859',
  ),
  palette(
    'nes',
    'NES',
    'Nintendo hardware',
    'Consoles & computers',
    'nintendo-entertainment-system',
    '000000 fcfcfc f8f8f8 bcbcbc 7c7c7c a4e4fc 3cbcfc 0078f8 0000fc b8b8f8 6888fc 0058f8 0000bc d8b8f8 9878f8 6844fc 4428bc f8b8f8 f878f8 d800cc 940084 f8a4c0 f85898 e40058 a80020 f0d0b0 f87858 f83800 a81000 fce0a8 fca044 e45c10 881400 f8d878 f8b800 ac7c00 503000 d8f878 b8f818 00b800 007800 b8f8b8 58d854 00a800 006800 b8f8d8 58f898 00a844 005800 00fcfc 00e8d8 008888 004058 f8d8f8 787878',
  ),
  palette(
    'game-boy',
    'Game Boy',
    'bgb emulator',
    'Consoles & computers',
    'nintendo-gameboy-bgb',
    '081820 346856 88c070 e0f8d0',
  ),
  palette(
    'cga',
    'CGA',
    'IBM hardware',
    'Consoles & computers',
    'color-graphics-adapter',
    '000000 555555 aaaaaa ffffff 0000aa 5555ff 00aa00 55ff55 00aaaa 55ffff aa0000 ff5555 aa00aa ff55ff aa5500 ffff55',
  ),
  palette(
    'commodore-64',
    'Commodore 64',
    'Commodore hardware',
    'Consoles & computers',
    'commodore64',
    '000000 626262 898989 adadad ffffff 9f4e44 cb7e75 6d5412 a1683c c9d487 9ae29b 5cab5e 6abfc6 887ecb 50459b a057a3',
  ),
  palette(
    'zx-spectrum',
    'ZX Spectrum',
    'Sinclair hardware',
    'Consoles & computers',
    'zx-spectrum',
    '000000 0000d8 0000ff d80000 ff0000 d800d8 ff00ff 00d800 00ff00 00d8d8 00ffff d8d800 ffff00 d8d8d8 ffffff',
  ),
  palette(
    'msx',
    'MSX',
    'MSX hardware',
    'Consoles & computers',
    'msx',
    '000000 cacaca ffffff b75e51 d96459 fe877c cac15e ddce85 3ca042 40b64a 73ce7c 5955df 7e75f0 64daee b565b3',
  ),
  palette(
    'nyx8',
    'Nyx8',
    'Javier Guerrero',
    'Small & 1-bit',
    'nyx8',
    '08141e 0f2a3f 20394f f6d6bd c3a38a 997577 816271 4e495f',
  ),
  palette(
    'oil-6',
    'Oil 6',
    'GrafxKid',
    'Small & 1-bit',
    'oil-6',
    'fbf5ef f2d3ab c69fa5 8b6d9c 494d7e 272744',
  ),
  palette(
    'ammo-8',
    'Ammo-8',
    'rsvp asap',
    'Small & 1-bit',
    'ammo-8',
    '040c06 112318 1e3a29 305d42 4d8061 89a257 bedc7f eeffcc',
  ),
  palette(
    '1-bit-glow',
    '1-bit Monitor Glow',
    'Polyducks',
    'Small & 1-bit',
    '1bit-monitor-glow',
    '222323 f0f6f0',
  ),
  grayscale(4),
  grayscale(8),
  grayscale(16),
];

export const builtinPalette = (id: string): BuiltinPalette | undefined =>
  BUILTIN_PALETTES.find((p) => p.id === id);
