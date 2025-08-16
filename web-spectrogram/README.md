# Web Spectrogram

The `web-spectrogram` package provides a WebAssembly-powered spectrogram viewer. It exposes several runtime options that can be controlled from the demo UI or programmatically from JavaScript.

## Colormaps

The spectrogram supports multiple colour palettes:

- `fire`
- `legacy`
- `gray`
- `viridis`
- `plasma`
- `inferno`
- `rainbow`

**UI:** Use the colormap selector in the demo to choose a palette.

**API:** Call `set_colormap` with one of the above names after initialising the wasm module:

```js
import init, { set_colormap } from "web_spectrogram";

await init();
set_colormap("viridis");
```

## Orientation

Time can run horizontally (left→right) or vertically (top→bottom).

**UI:** Toggle the orientation control to switch between horizontal and vertical layouts.

**API:** Apply a CSS class or transform to the `<canvas>` element:

```js
// rotate 90deg to make time advance vertically
canvas.classList.toggle("vertical");
```

## Theme Switching

Light and dark themes are available.

**UI:** Use the theme switcher to toggle between light and dark modes.

**API:** Set the document's theme attribute:

```js
document.body.dataset.theme = "light"; // or "dark"
```

Refer back to this file whenever you need details on the available options and how to use them.
