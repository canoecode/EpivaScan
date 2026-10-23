import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { saveScan } from '@/history';
import { ModelError, analyse, type Output } from '@/model';
import { ResultBody } from '@/result-view';
import { useScan } from '@/scan';
import { Button, Page, PhotoFrame, Pill, T, useWide } from '@/ui';

type State =
  | { kind: 'analysing' }
  | { kind: 'result'; output: Output }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

export default function Result() {
  const { photo, clear } = useScan();
  const wide = useWide();
  const [state, setState] = useState<State>({ kind: 'analysing' });
  const saved = useRef<object | null>(null);

  const run = useCallback(async () => {
    if (!photo) return;
    setState({ kind: 'analysing' });
    try {
      // A short floor, so a fast answer doesn't flash past before it can be read as a result.
      const [output] = await Promise.all([analyse(photo), new Promise((done) => setTimeout(done, 1300))]);
      if (output && saved.current !== output) {
        saved.current = output;
        saveScan(photo.uri, output).catch(() => {});  // History is a convenience; never block a result on it
      }
      setState(output ? { kind: 'result', output } : { kind: 'offline' });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof ModelError ? err.message : 'Something went wrong. Please try again.' });
    }
  }, [photo]);

  useEffect(() => { run(); }, [run]);

  if (!photo) return <Redirect href="/" />;
  const again = () => { clear(); router.dismissAll(); };

  if (state.kind === 'analysing') {
    const frame = <PhotoFrame uri={photo.uri} scanning />;
    return (
      <Page step="Step 2 of 2" aside={wide ? frame : undefined}>
        <T v="title" accessibilityRole="header" accessibilityLiveRegion="polite">Analysing your photo…</T>
        {!wide && frame}
        <T v="small">This usually takes a few seconds.</T>
      </Page>
    );
  }

  if (state.kind !== 'result') {
    const offline = state.kind === 'offline';
    return (
      <Page back step="Step 2 of 2"
        actions={<><Button label="Try again" icon="focus" onPress={run} /><Button label="Scan another photo" icon="camera" kind="secondary" onPress={again} /></>}
        aside={wide ? <PhotoFrame uri={photo.uri} /> : undefined}>
        <T v="title" accessibilityRole="header">{offline ? 'The model didn’t respond.' : 'That didn’t work.'}</T>
        <T v="lead">{offline ? 'Your photo was not analysed. Check your connection and try again.' : state.message}</T>
      </Page>
    );
  }

  return (
    <Page
      back
      step={state.output.mock ? <Pill label="Sample data" /> : 'Result'}
      actions={
        <>
          <Button label="Scan another photo" icon="camera" onPress={again} />
          {wide && <Button label="How to read this" icon="info" kind="secondary" onPress={() => router.push('/how-to-read')} />}
        </>
      }
      aside={wide ? <PhotoFrame uri={photo.uri} /> : undefined}>
      <ResultBody output={state.output} uri={photo.uri} />
    </Page>
  );
}
