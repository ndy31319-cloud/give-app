import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { UploadableImage } from '@/src/types/app';

async function assetToUploadableImage(asset: ImagePicker.ImagePickerAsset): Promise<UploadableImage> {
  const originalName = asset.fileName ?? `image-${Date.now()}`;
  const originalType = String(asset.mimeType ?? '').toLowerCase();
  const isHeic = originalType.includes('heic') || originalType.includes('heif') || /\.(heic|heif)$/i.test(originalName);

  // iOS may keep the camera/library asset as HEIC even when the picker does
  // not report a MIME type. Normalize it before AI analysis and multipart upload
  // so the backend never has to decode an Apple-only source format.
  if (Platform.OS === 'ios' || isHeic) {
    try {
      const normalized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      return {
        uri: normalized.uri,
        name: `${originalName.replace(/\.[^.]+$/, '') || `image-${Date.now()}`}.jpg`,
        type: 'image/jpeg',
        width: normalized.width,
        height: normalized.height,
        size: asset.fileSize,
      };
    } catch (error) {
      console.warn('Image normalization failed; uploading the original asset:', error);
    }
  }

  return {
    uri: asset.uri,
    name: originalName.includes('.') ? originalName : `${originalName}.jpg`,
    type: originalType || 'image/jpeg',
    width: asset.width,
    height: asset.height,
    size: asset.fileSize,
  };
}

async function ensurePermission(
  permissionType: 'camera' | 'mediaLibrary',
  requestPermission: () => Promise<ImagePicker.PermissionResponse>,
) {
  const response = await requestPermission();

  if (!response.granted) {
    Alert.alert(
      permissionType === 'camera' ? '카메라 권한이 필요합니다' : '사진 접근 권한이 필요합니다',
      permissionType === 'camera'
        ? '촬영 기능을 사용하려면 카메라 접근을 허용해주세요.'
        : '갤러리 사진을 가져오려면 사진 접근을 허용해주세요.',
    );
    return false;
  }

  return true;
}

export async function pickImageFromLibrary() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return assetToUploadableImage(result.assets[0]);
}

export async function pickImagesFromLibrary(selectionLimit = 5) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, Math.min(5, selectionLimit)),
  });

  if (result.canceled || !result.assets.length) {
    return null;
  }

  return Promise.all(result.assets.map(assetToUploadableImage));
}

export async function captureImage() {
  const granted = Platform.OS === 'web' || await ensurePermission('camera', ImagePicker.requestCameraPermissionsAsync);
  if (!granted) {
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: true,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return assetToUploadableImage(result.assets[0]);
}
