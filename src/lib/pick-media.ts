import * as ImagePicker from 'expo-image-picker';

export type PickMediaPurpose = 'product' | 'document';

export type PickedMedia = {
  uri: string;
  mimeType: string;
  fileName: string;
  fileSize: number | null;
};

export type PickMediaResult =
  | { status: 'picked'; media: PickedMedia }
  | { status: 'cancelled' }
  | { status: 'denied'; message: string };

function toMedia(asset: ImagePicker.ImagePickerAsset, purpose: PickMediaPurpose): PickedMedia {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const prefix = purpose === 'document' ? 'document' : 'product';
  return {
    uri: asset.uri,
    mimeType,
    fileName: asset.fileName?.trim() || `${prefix}.${ext}`,
    fileSize: typeof asset.fileSize === 'number' ? asset.fileSize : null,
  };
}

function deniedMessage(
  kind: 'camera' | 'gallery',
  canAskAgain: boolean,
  purpose: PickMediaPurpose,
): string {
  const subject = purpose === 'document' ? 'a document photo' : 'a product photo';
  if (kind === 'camera') {
    return canAskAgain
      ? `Camera permission is needed to take ${subject}.`
      : `Camera access is blocked. Enable it in Settings to take ${subject}.`;
  }
  return canAskAgain
    ? `Photo library permission is needed to choose ${subject}.`
    : `Photo library access is blocked. Enable it in Settings to choose ${subject}.`;
}

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  quality: 0.85,
};

export async function pickImageFromGallery(
  purpose: PickMediaPurpose = 'product',
): Promise<PickMediaResult> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  let status = current.status;
  let canAskAgain = current.canAskAgain;

  if (status !== 'granted') {
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    status = requested.status;
    canAskAgain = requested.canAskAgain;
  }

  if (status !== 'granted') {
    return { status: 'denied', message: deniedMessage('gallery', canAskAgain, purpose) };
  }

  const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
  if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
  return { status: 'picked', media: toMedia(result.assets[0], purpose) };
}

export async function pickImageFromCamera(
  purpose: PickMediaPurpose = 'product',
): Promise<PickMediaResult> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  let status = current.status;
  let canAskAgain = current.canAskAgain;

  if (status !== 'granted') {
    const requested = await ImagePicker.requestCameraPermissionsAsync();
    status = requested.status;
    canAskAgain = requested.canAskAgain;
  }

  if (status !== 'granted') {
    return { status: 'denied', message: deniedMessage('camera', canAskAgain, purpose) };
  }

  const result = await ImagePicker.launchCameraAsync(pickerOptions);
  if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
  return { status: 'picked', media: toMedia(result.assets[0], purpose) };
}

export async function pickProductPhotoFromGallery(): Promise<PickMediaResult> {
  return pickImageFromGallery('product');
}

export async function pickProductPhotoFromCamera(): Promise<PickMediaResult> {
  return pickImageFromCamera('product');
}

export type LocalUploadFile = {
  uri: string;
  mimeType: string;
  fileName: string;
};

/**
 * Expo's fetch FormData converter only accepts a string, a Blob, or an object
 * with bytes(). The React Native `{ uri, name, type }` shorthand is rejected.
 *
 * Always return a plain Blob — wrapping as File makes FormData.append throw
 * ("Cannot assign to property 'name' which has only a getter") because Expo
 * writes `part.name` for the filename.
 */
export async function blobFromLocalUri(uri: string, mimeType: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Could not read the selected file.');
  }

  const fetched = await response.blob();
  const type = mimeType || fetched.type || 'application/octet-stream';
  return new Blob([fetched], { type });
}

export async function appendLocalFile(
  form: FormData,
  field: string,
  file: LocalUploadFile,
): Promise<void> {
  const blob = await blobFromLocalUri(file.uri, file.mimeType);
  form.append(field, blob, file.fileName);
}
