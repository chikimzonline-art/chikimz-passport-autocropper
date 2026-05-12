# Auto-Passport Crop

An offline desktop application for automatically cropping passport photos (3.5cm × 4.5cm) using AI face detection.

## Features

- **AI-Powered Face Detection** — Uses MediaPipe's blaze_face_short_range model for fast, accurate face detection
- **100% Offline** — WASM and model files are bundled locally; no internet connection required after installation
- **Passport-Standard Cropping** — Enforces the 75% head-height rule with 3.5:4.5 aspect ratio (413×531px at 300 DPI)
- **Bulk Processing** — Process entire folders of images with real-time progress tracking
- **Live Preview** — Side-by-side original vs. cropped preview for the last 5 processed images
- **Cancellation Support** — Cancel processing at any time

## Tech Stack

- **Electron** — Desktop shell with IPC for file system operations
- **React** (Vite) — Functional components with Hooks
- **MediaPipe tasks-vision** — Face detection (blaze_face_short_range model)
- **Node.js** — File I/O via Electron main process

## Development

```bash
# Install dependencies
npm install

# Start development (Vite + Electron concurrently)
npm run dev
```

The app will open with DevTools enabled. Vite serves the renderer at `http://localhost:5173` and Electron loads it automatically.

## Building

```bash
# Build the Vite renderer + Electron package
npm run build
```

Output goes to `dist/electron/`.

## How It Works

### Cropping Algorithm

1. **Face Detection** — MediaPipe detects the face bounding box (forehead to chin, ear to ear)
2. **Head Height Rule** — The detected face height occupies 75% of the final image height, leaving comfortable room for the shoulders/chin area
3. **Top Margin** — 10% of the total image height is placed above the top of the head
4. **Horizontal Centering** — The face is centered horizontally in the crop
5. **Aspect Ratio** — Strict 3.5:4.5 (413×531 pixels at 300 DPI equivalent)
6. **Boundary Clamping** — Crop rectangle is shifted/shrunk to stay within the source image

### Processing Pipeline

- Images are processed one at a time in an async loop
- Each iteration yields back to the event loop to keep the UI responsive
- Cancellation is checked between each image
- Original images are read via IPC, processed in the renderer, and saved via IPC

## Offline Configuration

The `public/wasm/` directory contains the MediaPipe WASM binaries, and `public/models/` contains the `blaze_face_short_range.tflite` model. These are bundled with the app via `extraResources` in electron-builder.

In development, Vite serves the `public/` directory at the root URL. In production, Electron's `process.resourcesPath` points to the extracted resources.

## License

ISC
