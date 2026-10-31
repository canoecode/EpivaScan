import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { deleteScan, loadScans, confirm, when, type SavedScan } from '@/history';
import { ResultBody } from '@/result-view';
import { color } from '@/theme';
import { Button, Page, PhotoFrame, Pill, T, TextButton, useWide } from '@/ui';

/* A past scan reopened from History. Same layout as a fresh result, without the entrance animation. */
export default function SavedScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const wide = useWide();
  const [scan, setScan] = useState<SavedScan | null | undefined>(undefined);

  useEffect(() => { loadScans().then((all) => setScan(all.find((s) => s.id === id) ?? null)); }, [id]);

  if (scan === undefined) return <Page back><T v="small">Loading…</T></Page>;
  if (scan === null) return <Redirect href="/history" />;

  const remove = async () => {
    if (await confirm('Delete this scan?', 'It will be removed from this phone.', 'Delete')) {
      await deleteScan(scan.id);
      router.back();
    }
  };

  return (
    <Page
      back
      step={scan.mock ? <Pill label="Sample data" /> : when(scan.at)}
      actions={<Button label="Scan another photo" icon="camera" onPress={() => router.navigate('/')} />}
      aside={wide ? <PhotoFrame uri={scan.uri} /> : undefined}>
      <ResultBody
        output={{ mock: scan.mock, model: scan.model, predictions: scan.predictions }}
        uri={scan.uri}
        animate={false}
        footer={<TextButton label="Delete this scan" icon="trash" tint={color.alert} onPress={remove} />}
      />
    </Page>
  );
}
