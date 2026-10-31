/* Talks to the EpivaScan Space (ml/space/app.py) over Gradio's HTTP API.
   EXPO_PUBLIC_MODEL_SPACE says which Space: 'user/name' for one on Hugging Face, or a full
   URL such as http://192.168.1.20:7860 for the Space running on this computer. With none
   set, the app answers with built-in sample values, labelled as such, and uploads nothing. */
import { Platform } from 'react-native';

export type Prediction = { label: string; score: number };
export type Output = { mock: boolean; model: string; predictions: Prediction[] };
export type Photo = { uri: string; name: string; type: string; width?: number; height?: number; file?: File };

export const SPACE = (process.env.EXPO_PUBLIC_MODEL_SPACE ?? '').trim();
export const MAX_BYTES = 15 * 1024 * 1024;

/* The same made-up numbers as MOCK_SCORES in ml/space/app.py and BUILTIN in
   assets/js/scan.js; keep the three in step. */
const BUILTIN: Prediction[] = [
  ['Eczema (dermatitis)', 0.52], ['Contact dermatitis', 0.17], ['Psoriasis', 0.09],
  ['Tinea (ringworm)', 0.06], ['Other / unclear', 0.05], ['Hives (urticaria)', 0.03],
  ['Insect bite', 0.02], ['Folliculitis', 0.02], ['Drug rash', 0.01], ['Pityriasis rosea', 0.01],
  ['Acne', 0.01], ['Impetigo', 0.005], ['Shingles (herpes zoster)', 0.003],
  ['Cold sore (herpes simplex)', 0.002],
].map(([label, score]) => ({ label: label as string, score: score as number }));

/* 'user/my_space' lives at https://user-my-space.hf.space */
function baseUrl(space: string) {
  if (/^https?:\/\//.test(space)) return space.replace(/\/+$/, '');
  return `https://${space.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.hf.space`;
}

function isAnswer(output: unknown): output is Output {
  const o = output as Output;
  return Boolean(o) && Array.isArray(o.predictions) && o.predictions.length > 0 &&
    o.predictions.every((p) => p && typeof p.label === 'string' && Number.isFinite(p.score));
}

export class ModelError extends Error {}

/* Resolves to the Space's answer, or to null when the Space can't be reached. */
export async function analyse(photo: Photo): Promise<Output | null> {
  if (!SPACE) return { mock: true, model: 'built-in', predictions: BUILTIN };
  const base = baseUrl(SPACE);

  let body: string;
  try {
    const form = new FormData();
    if (Platform.OS === 'web' && photo.file) form.append('files', photo.file, photo.name);
    // React Native's FormData takes a { uri, name, type } object for a local file.
    else form.append('files', { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
    const upload = await fetch(`${base}/gradio_api/upload`, { method: 'POST', body: form });
    if (!upload.ok) return null;
    const [path] = (await upload.json()) as string[];

    const call = await fetch(`${base}/gradio_api/call/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [{ path, orig_name: photo.name, meta: { _type: 'gradio.FileData' } }] }),
    });
    if (!call.ok) return null;
    const { event_id } = (await call.json()) as { event_id: string };
    body = await (await fetch(`${base}/gradio_api/call/predict/${event_id}`)).text();
  } catch {
    return null;
  }

  // The answer arrives as server-sent events; the last one is "complete" or "error".
  const events = body.split(/\n\n/).map((block) => ({
    event: /^event: (.*)$/m.exec(block)?.[1],
    data: /^data: (.*)$/m.exec(block)?.[1],
  }));
  const done = events.find((e) => e.event === 'complete');
  if (!done?.data) throw new ModelError('The model couldn’t analyse this photo. Try another one.');
  const [output] = JSON.parse(done.data) as unknown[];
  if (!isAnswer(output)) throw new ModelError('The model sent back a result this app can’t read.');
  return output;
}

/* Which of the three readings a result falls under. The cut-offs are placeholders until
   the trained model's calibration is known; they match assets/js/scan.js. */
const CLEAR_SCORE = 0.5;
const CLEAR_LEAD = 0.2;
const CATCH_ALL = ['Other / unclear', 'Photo unclear'];

export const READINGS = {
  clear: { title: 'One clear leader', text: 'The photo strongly resembles one condition. Ask a clinician about it specifically; it still needs confirming in person.' },
  close: { title: 'Several close together', text: 'The model isn’t sure. Try a clearer photo. If the spread stays even, treat the result as inconclusive.' },
  none: { title: 'Nothing fits', text: 'This may be outside what the model knows. A low match never means nothing is wrong.' },
} as const;

export function reading(ranked: Prediction[]) {
  const [top, next] = ranked;
  if (CATCH_ALL.includes(top.label)) return READINGS.none;
  const lead = top.score - (next ? next.score : 0);
  return top.score >= CLEAR_SCORE && lead >= CLEAR_LEAD ? READINGS.clear : READINGS.close;
}

export const percent = (score: number) => (score > 0 && score < 0.005 ? '<1%' : `${Math.round(score * 100)}%`);
