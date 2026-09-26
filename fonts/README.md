# Fonts for the share cards

The share cards (`api/card.js`) are rendered on the server, where the site's
system fonts (Georgia, system-ui) do not exist and Georgia may not be bundled.
These are the Latin subsets (which cover Spanish, curly quotes and dashes) as
WOFF files, taken from the Fontsource npm packages `@fontsource/source-serif-4`
and `@fontsource/source-sans-3`, version 5.3.0.

| File | Font | Copyright (from the font's own name table) |
|---|---|---|
| `source-serif-4-latin-400-normal.woff`, `-400-italic`, `-600-normal` | Source Serif 4, version 4.004 | © 2014 - 2021 Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name 'Source'. |
| `source-sans-3-latin-400-normal.woff`, `-700-normal` | Source Sans 3, version 3.052 | © 2023 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source' |

Both are licensed under the SIL Open Font License, Version 1.1. The full
license text ships alongside them: `OFL-source-serif-4.txt` and
`OFL-source-sans-3.txt`.
