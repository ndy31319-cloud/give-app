import { Platform } from 'react-native';
import { ChatAttachment } from '@/src/types/app';
import { backendConfig, buildAuthHeaders, mapBackendChatMessage, requestEnvelope, toBackendFilePart } from './backendClient';

export async function sendChatAttachment(roomId: string, attachment: ChatAttachment, viewerId: string, token?: string) {
  let body: BodyInit;
  let path = `${backendConfig.endpoints.chats}/rooms/${encodeURIComponent(roomId)}/messages`;
  let headers = buildAuthHeaders(token);
  try {
    if (attachment.type === 'IMAGE') {
      path = `${backendConfig.endpoints.chats}/rooms/${encodeURIComponent(roomId)}/images`;
      const form = new FormData();
      form.append('clientMessageId', attachment.clientMessageId);
      if (Platform.OS === 'web') {
        const blob = await (await fetch(attachment.image.uri)).blob();
        form.append('image', blob, attachment.image.name);
      } else {
        form.append('image', toBackendFilePart(attachment.image));
      }
      body = form;
    } else {
      headers = buildAuthHeaders(token, { 'Content-Type': 'application/json' });
      body = JSON.stringify(attachment);
    }
    const result = await requestEnvelope<any>(path, { method: 'POST', headers, body });
    return { data: result.data ? mapBackendChatMessage(result.data, viewerId) : null,
      error: result.error || (!result.data ? '백엔드 연결 설정을 확인해주세요.' : null) };
  } catch {
    return { data: null, error: '첨부 파일을 읽거나 전송하지 못했습니다. 다시 시도해주세요.' };
  }
}
