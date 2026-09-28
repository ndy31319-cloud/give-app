# 채팅 사진·카메라·위치 공유

- 앱에서 사진 선택 또는 촬영 후 미리보기에서 전송한다. 한 번에 한 장, 최대 5MB. JPG/PNG/GIF/WebP를 지원한다.
- 사진 업로드: `POST /api/chats/rooms/:roomId/images`, multipart `image`, 선택적 `clientMessageId`.
- 현재 위치 공유: 기존 메시지 API에 `{ type: 'LOCATION', location: { latitude, longitude, label }, clientMessageId }` 전송.
- 위치는 사용자가 전송을 누른 순간 한 번 공유하며 백그라운드 추적을 하지 않는다. 기존 약속장소 메시지도 유지한다.
- 사진 메시지를 누르면 확대, 위치 메시지를 누르면 지도 및 카카오맵 열기를 제공한다.
- 두 API 모두 회원 인증·채팅 참여자 확인을 수행한다. 같은 발신자의 동일 `clientMessageId` 재시도는 메시지를 중복 저장하지 않는다.
- 저장소는 기존 게시글처럼 Cloudinary → Firebase Storage → 로컬 uploads 순서로 설정에 따라 사용한다. 운영 시 로컬 저장은 서버의 영속 디스크 및 외부 접근 가능한 업로드 URL이 필요하다.
- `npm test`: 내용 형식·좌표·파일 형식 검사.
- `npm run test:chat:integration`: 전용 임시 회원·채팅방·이미지로 실제 전송/조회·권한·재시도를 검사한 뒤 정리한다.
- 휴대폰에서는 카메라/사진/위치 권한 허용·거부, 촬영 취소, 수신 사진 확대를 별도로 확인한다. 기존 설치 APK는 새 코드가 포함된 빌드가 필요하다.
