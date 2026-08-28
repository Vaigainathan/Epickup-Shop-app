import * as ImagePicker from 'expo-image-picker';

export type PickedMedia = {
  uri: string;
  mimeType: string;
  fileName: string;
};

export type PickMediaResult =
  | { status: 'picked'; media: PickedMedia }
  | { status: 'cancelled' }
  | { status: 'denied'; message: string };

function toMedia(asset: ImagePicker.ImagePickerAsset): PickedMedia {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  return {
    uri: asset.uri,
    mimeType,
    fileName: asset.fileName?.trim() || `product.${ext}`,
  };
}

function deniedMessage(kind: 'camera' | 'gallery', canAskAgain: boolean): string {
  if (kind === 'camera') {
    return canAskAgain
      ? 'Camera permission is needed to take a product photo.'
      : 'Camera access is blocked. Enable it in Settings to take a product photo.';
  }
  return canAskAgain
    ? 'Photo library permission is needed to choose a product photo.'
    : 'Photo library access is blocked. Enable it in Settings to choose a product photo.';
}

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  quality: 0.85,
};

export async function pickProductPhotoFromGallery(): Promise<PickMediaResult> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  let status = current.status;
  let canAskAgain = current.canAskAgain;

  if (status !== 'granted') {
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    status = requested.status;
    canAskAgain = requested.canAskAgain;
  }

  if (status !== 'granted') {
    return { status: 'denied', message: deniedMessage('gallery', canAskAgain) };
  }

  const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
  if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
  return { status: 'picked', media: toMedia(result.assets[0]) };
}

export async function pickProductPhotoFromCamera(): Promise<PickMediaResult> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  let status = current.status;
  let canAskAgain = current.canAskAgain;

  if (status !== 'granted') {
    const requested = await ImagePicker.requestCameraPermissionsAsync();
    status = requested.status;
    canAskAgain = requested.canAskAgain;
  }

  if (status !== 'granted') {
    return { status: 'denied', message: deniedMessage('camera', canAskAgain) };
  }

  const result = await ImagePicker.launchCameraAsync(pickerOptions);
  if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
  return { status: 'picked', media: toMedia(result.assets[0]) };
}
