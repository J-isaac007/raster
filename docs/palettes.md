# Built-in palettes

Raster ships these palettes in Palette › Browse Palettes… (`Ctrl+Alt+P`).
The colors come from each palette's page on [Lospec](https://lospec.com/palette-list),
where their authors published them. Thanks to every author below.

The console and computer palettes reproduce the colors of that hardware; the
names belong to their owners and are used only to say which hardware each
palette matches.

## Popular

| Palette        | Author              | Colors | Source                                                       |
| -------------- | ------------------- | ------ | ------------------------------------------------------------ |
| PICO-8         | Lexaloffle Games    | 16     | [lospec.com](https://lospec.com/palette-list/pico-8)         |
| Sweetie 16     | GrafxKid            | 16     | [lospec.com](https://lospec.com/palette-list/sweetie-16)     |
| Endesga 32     | ENDESGA             | 32     | [lospec.com](https://lospec.com/palette-list/endesga-32)     |
| Endesga 64     | ENDESGA             | 64     | [lospec.com](https://lospec.com/palette-list/endesga-64)     |
| Resurrect 64   | Kerrie Lake         | 64     | [lospec.com](https://lospec.com/palette-list/resurrect-64)   |
| AAP-64         | Adigun A. Polack    | 64     | [lospec.com](https://lospec.com/palette-list/aap-64)         |
| DawnBringer 16 | DawnBringer         | 16     | [lospec.com](https://lospec.com/palette-list/dawnbringer-16) |
| DawnBringer 32 | DawnBringer         | 32     | [lospec.com](https://lospec.com/palette-list/dawnbringer-32) |
| Apollo         | AdamCYounis         | 46     | [lospec.com](https://lospec.com/palette-list/apollo)         |
| Lospec500      | Lospec community    | 42     | [lospec.com](https://lospec.com/palette-list/lospec500)      |
| Vinik24        | Vinik               | 24     | [lospec.com](https://lospec.com/palette-list/vinik24)        |
| Island Joy 16  | Kerrie Lake         | 16     | [lospec.com](https://lospec.com/palette-list/island-joy-16)  |
| Steam Lords    | Slynyrd             | 16     | [lospec.com](https://lospec.com/palette-list/steam-lords)    |
| Arne 16        | Arne Niklas Jansson | 16     | [lospec.com](https://lospec.com/palette-list/arne-16)        |
| Bubblegum 16   | PineappleOnPizza    | 16     | [lospec.com](https://lospec.com/palette-list/bubblegum-16)   |

## Consoles & computers

| Palette      | Author             | Colors | Source                                                                      |
| ------------ | ------------------ | ------ | --------------------------------------------------------------------------- |
| NES          | Nintendo hardware  | 55     | [lospec.com](https://lospec.com/palette-list/nintendo-entertainment-system) |
| Game Boy     | bgb emulator       | 4      | [lospec.com](https://lospec.com/palette-list/nintendo-gameboy-bgb)          |
| CGA          | IBM hardware       | 16     | [lospec.com](https://lospec.com/palette-list/color-graphics-adapter)        |
| Commodore 64 | Commodore hardware | 16     | [lospec.com](https://lospec.com/palette-list/commodore64)                   |
| ZX Spectrum  | Sinclair hardware  | 15     | [lospec.com](https://lospec.com/palette-list/zx-spectrum)                   |
| MSX          | MSX hardware       | 15     | [lospec.com](https://lospec.com/palette-list/msx)                           |

## Small & 1-bit

| Palette            | Author          | Colors | Source                                                          |
| ------------------ | --------------- | ------ | --------------------------------------------------------------- |
| Nyx8               | Javier Guerrero | 8      | [lospec.com](https://lospec.com/palette-list/nyx8)              |
| Oil 6              | GrafxKid        | 6      | [lospec.com](https://lospec.com/palette-list/oil-6)             |
| Ammo-8             | rsvp asap       | 8      | [lospec.com](https://lospec.com/palette-list/ammo-8)            |
| 1-bit Monitor Glow | Polyducks       | 2      | [lospec.com](https://lospec.com/palette-list/1bit-monitor-glow) |

## Ramps

Grayscale 4, 8 and 16 are evenly spaced grays from black to white, generated
by Raster.

## Adding a palette

Palettes live in `src/renderer/src/core/palettes.ts`. Copy the colors from the
palette's published source rather than typing them, credit its author, and
make sure the author allows it to be redistributed.

Your own palettes don't need any of this: Palette › Import Palette… reads
`.hex`, `.gpl`, `.pal` (JASC), `.txt` (Paint.NET), `.act` and `.ase` files
and keeps them in My palettes.
