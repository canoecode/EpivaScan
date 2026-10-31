/* The photo being checked, shared by the review and result screens, and the code that
   gets one from the camera, the photo library, or (in a desktop browser) a drop or paste. */
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { MAX_BYTES, type Photo } from '@/model';

type Scan = {
  photo: Photo | null;
  problem: string | null;
  pick: (source: 'camera' | 'library') => Promise<void>;
  clear: () => void;
};

const ScanContext = createContext<Scan | null>(null);

export function useScan() {
  const scan = useContext(ScanContext);
  if (!scan) throw new Error('useScan needs a <ScanProvider> above it');
  return scan;
}

export function ScanProvider({ children }: { children: ReactNode }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const accept = useCallback((next: Photo, size?: number) => {
    if (!next.type.startsWith('image/')) return setProblem('That file isn’t an image. Choose a photo (JPG, PNG or similar).');
    if (size && size > MAX_BYTES) return setProblem('That photo is larger than 15 MB. Try a smaller one.');
    setProblem(null);
    setPhoto(next);
    router.push('/review');
  }, []);

  const pick = useCallback(async (source: 'camera' | 'library') => {
    setProblem(null);
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 0.9 };
    if (source === 'camera' && Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setProblem('Camera access is off. Allow it in Settings, or choose a photo you already have.');
        return;
      }
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    accept({
      uri: asset.uri,
      name: asset.fileName ?? 'photo.jpg',
      type: asset.mimeType ?? 'image/jpeg',
      width: asset.width,
      height: asset.height,
      file: asset.file,
    }, asset.fileSize);
  }, [accept]);

  /* Desktop browsers: drop a photo anywhere on the page, or paste one. */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const take = (file?: File | null) => {
      if (file) accept({ uri: URL.createObjectURL(file), name: file.name || 'photo', type: file.type, file }, file.size);
    };
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => { e.preventDefault(); take(e.dataTransfer?.files[0]); };
    const paste = (e: ClipboardEvent) => take([...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/')));
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, [accept]);

  const clear = useCallback(() => {
    if (Platform.OS === 'web' && photo?.uri.startsWith('blob:')) URL.revokeObjectURL(photo.uri);
    setPhoto(null);
    setProblem(null);
  }, [photo]);

  return <ScanContext.Provider value={{ photo, problem, pick, clear }}>{children}</ScanContext.Provider>;
}
