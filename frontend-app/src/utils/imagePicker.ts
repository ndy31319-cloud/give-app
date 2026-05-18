import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { UploadableImage } from '@/src/types/app';

function assetToUploadableImage(asset: ImagePicker.ImagePickerAsset): UploadableImage {
  return {
    uri: asset.uri,
    name: asset.fileName ?? `image-${Date.now()}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
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
  const granted = await ensurePermission('mediaLibrary', ImagePicker.requestMediaLibraryPermissionsAsync);
  if (!granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    legacy: true,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return assetToUploadableImage(result.assets[0]);
}

export async function pickImagesFromLibrary() {
  const granted = await ensurePermission('mediaLibrary', ImagePicker.requestMediaLibraryPermissionsAsync);
  if (!granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsMultipleSelection: true,
    selectionLimit: 5,
    legacy: true,
  });

  if (result.canceled || !result.assets.length) {
    return null;
  }

  return result.assets.map(assetToUploadableImage);
}

export async function captureImage() {
  const granted = await ensurePermission('camera', ImagePicker.requestCameraPermissionsAsync);
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
