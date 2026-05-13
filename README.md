# Auto-Passport Crop

AI-powered desktop application for automatically cropping passport photos to Indian standard size (3.5cm × 4.5cm). 100% offline — all AI processing runs locally, no internet required.

**By CSC Chikimz Online**

## Features

- **AI-Powered Face Detection** — Uses MediaPipe's `blaze_face_full_range` model for fast, accurate face detection
- **100% Offline** — WASM and model files are bundled locally; no internet connection required after installation
- **Passport-Standard Cropping** — Indian passport specification (413×531px at 300 DPI, 3.5:4.5 aspect ratio, 52% head height)
- **Background Removal** — One-click background replacement using MediaPipe Selfie Segmentation with confidence masks for smooth hair edges; supports predefined colors (White, Light Gray, Light Blue, Off-White, Gray) and custom color picker
- **Auto Straightening** — Detects tilted faces via eye keypoints and straightens the image before cropping; rotated corners filled with chosen background color
- **Bulk Processing** — Process entire folders of images with real-time progress tracking
- **Live Preview** — Side-by-side original vs. cropped preview for processed images
- **Cancellation Support** — Cancel processing at any time

## Download & Installation

1. Go to the **[Releases](../../releases)** page on this repository
2. Download the latest `Auto-Passport-Crop-Setup-x.x.x.exe` from the most recent release
3. Run the downloaded installer and follow the on-screen instructions
4. Launch **Auto-Passport Crop** from your desktop or Start Menu

> **Note:** Windows 10/11 (64-bit) is required. No internet connection is needed after installation — the app runs entirely offline.

## How to Use

1. **Select Input** — Click "Browse" to select a folder containing your photos, or drag and drop images directly
2. **Select Output** — Choose where you want the cropped passport photos to be saved
3. **Background Removal (Optional)** — Toggle "Remove Background" and pick a background color
4. **Start Processing** — Click **▶ Start Processing** and let the AI do the rest
5. **Preview** — View original vs. cropped results in the preview grid

## Tech Stack

- **Electron** — Desktop shell with IPC for file system operations
- **React** (Vite) — Functional components with Hooks
- **MediaPipe tasks-vision** — Face detection (`blaze_face_full_range`), background removal (`selfie_segmenter.tflite`)
- **Node.js** — File I/O via Electron main process

## Development

```bash
# Install dependencies
npm install

# Start development (Vite + Electron concurrently)
npm run dev
```

The app will open with DevTools enabled. Vite serves the renderer at `http://localhost:5173` and Electron loads it automatically.

### Dev Mode Setup (Windows)

WASM and model files must be available in the `public/` directory for dev mode. If they are missing, copy them from `node_modules`:

```bash
xcopy /E /I /Y node_modules\@mediapipe\tasks-vision\wasm public\wasm
```

The model file (`blaze_face_full_range.tflite`) and segmenter (`selfie_segmenter.tflite`) should be placed in `public/models/`.

## Building

```bash
# Build the Vite renderer + Electron package
npm run build
```

Output goes to `dist/electron/`.

## How It Works

### Cropping Algorithm

1. **Face Detection** — MediaPipe detects the face bounding box (forehead to chin, ear to ear)
2. **Crown Expansion** — 40% of the face height is added above the bounding box to estimate the full head height (crown/hair to chin)
3. **Head Height Rule** — The full head (crown to chin) occupies 52% of the final photo height, leaving ~33% below the chin for shoulders/chest
4. **Top Margin** — 15% of the crop height is placed above the estimated crown
5. **Horizontal Centering** — The face is centered horizontally in the crop
6. **Aspect Ratio** — Strict 3.5:4.5 (413×531 pixels at 300 DPI equivalent)
7. **Boundary Clamping** — Crop rectangle is shifted/shrunk to stay within the source image

### Processing Pipeline

1. **Face Detection** — MediaPipe detects face bounding box and keypoints
2. **Straightening** — If face tilt exceeds 2°, the image is rotated to straighten the face
3. **Re-Detection** — Face is re-detected on the straightened image for accurate crop rectangle
4. **Cropping** — Passport crop rectangle is computed and applied
5. **Background Removal** — (If enabled) Selfie segmentation removes the background and fills with chosen color
6. **Save** — Cropped passport photo saved to output folder via IPC

Images are processed one at a time in an async loop. Each iteration yields back to the event loop to keep the UI responsive. Cancellation is checked between each image. Canvas pixel buffers are explicitly released after each export to prevent memory accumulation during bulk processing.

## Offline Configuration

The `public/wasm/` directory contains the MediaPipe WASM binaries, and `public/models/` contains the `blaze_face_full_range.tflite` and `selfie_segmenter.tflite` models. These are bundled with the app via `extraResources` in electron-builder.

In development, Vite serves the `public/` directory at the root URL (configured via `publicDir` in `vite.config.js`). In production, Electron's `process.resourcesPath` points to the extracted resources.

## License

ISC
