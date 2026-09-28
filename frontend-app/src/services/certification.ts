import { Platform } from 'react-native';
import { UploadableImage } from '@/src/types/app';
import { backendConfig, toBackendFilePart } from './backendClient';

export interface CertificationResult {
  code?: string;
  error?: string;
  errorCode?: string;
}

async function request(path: 'scan' | 'verify', image?: UploadableImage, code?: string): Promise<CertificationResult> {
  if (!backendConfig.baseUrl || backendConfig.useMockOnly) {
    return { error: '인증 서버 연결 설정을 확인해주세요.', errorCode: 'CONNECTION' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    let body: BodyInit;
    const headers: Record<string, string> = {};
    if (image) {
      const form = new FormData();
      if (Platform.OS === 'web') {
        const photo = await fetch(image.uri, { signal: controller.signal });
        form.append('image', await photo.blob(), image.name);
      } else {
        form.append('image', toBackendFilePart(image));
      }
      body = form;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ code });
    }
    const response = await fetch(`${backendConfig.baseUrl}/api/certification/${path}`, {
      method: 'POST', headers, body, signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok || !result.success || !result.data?.code) {
      return { error: result.message || '인증에 실패했습니다. 다시 시도해주세요.', errorCode: result.errorCode || 'SERVER' };
    }
    return { code: String(result.data.code) };
  } catch {
    return { error: '사진 전송 또는 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.', errorCode: 'CONNECTION' };
  } finally { clearTimeout(timeout); }
}

export const scanCertificate = (image: UploadableImage) => request('scan', image);
export const verifyCertificateCode = (code: string) => request('verify', undefined, code);
