# EpivaScan app

The EpivaScan phone app, built with Expo (SDK 58) and Expo Router. The same code runs in a browser: on a wide screen it switches to a desktop layout with drop-and-paste for photos instead of the camera button.

Screens live in `src/app/`: four tabs in `(tabs)/` (Scan, History, Learn, About) and, above them, review, result, a saved scan (`scan/[id]`) and how to read. On a wide screen the tab bar becomes a header nav. Past scans are kept on the device only (`src/history.ts`). Shared pieces are in `src/`: `theme.ts` (the same colours and type as the website), `ui.tsx`, `scan.tsx` (getting a photo), `model.ts` (talking to the model). The Figma designs are in the "Mobile app" page of the EpivaScan web redesign file.

## Node

Expo SDK 58 needs Node 22.13 or newer. This machine has Node 20 system-wide, so a portable Node 22 sits in `.tools/node22/` at the project root (gitignored). Put it first on the path for the commands below:

```powershell
$env:Path = "C:\EpivaScan\.tools\node22\node-v22.23.4-win-x64;" + $env:Path
```

## Run it

From this folder:

```powershell
npm install
npx expo start          # scan the QR code with Expo Go on a phone (same Wi-Fi)
npx expo start --web    # in a browser at http://localhost:8081 (from this folder, so typed routes stay correct)
```

## Which model it uses

Set `EXPO_PUBLIC_MODEL_SPACE` in `app/.env.local`:

| Value | What happens |
| --- | --- |
| Empty (default) | Built-in sample values, labelled "Sample data". Nothing leaves the device |
| `user/epivascan` | Photos go to that Space on Hugging Face |
| `http://192.168.1.20:7860` | Photos go to the Space running on this computer (start it with `GRADIO_SERVER_NAME=0.0.0.0` so a phone can reach it) |

The sample values match `MOCK_SCORES` in `ml/space/app.py` and `BUILTIN` in `assets/js/scan.js`.

## Build

```powershell
npx expo export --platform web   # static web app in dist/
npx eas-cli@latest build         # phone builds in the cloud (needs an Expo account)
```
