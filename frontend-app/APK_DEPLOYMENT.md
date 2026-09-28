# 갤럭시 APK 설치·배포 안내

## 팀원에게 전달할 설치 방법

1. 갤럭시에서 전달받은 Expo 빌드 링크를 엽니다.
2. 완료된 빌드의 Install 또는 Download 버튼으로 APK를 받습니다.
3. 내려받은 APK를 열고, 요청되는 경우 해당 브라우저/파일 앱의
   ‘출처를 알 수 없는 앱 설치’를 허용합니다.
4. 설치된 ‘Give,기부’ 아이콘으로 실행합니다. Expo Go, QR 코드,
   프론트 소스 파일, PC의 개발 서버는 필요하지 않습니다.
5. 인터넷 연결은 필요합니다. 로그인·게시글 등은 배포된 백엔드를 사용합니다.

프로젝트 빌드 목록: https://expo.dev/accounts/dayeong10/projects/give-rn/builds

## 다음 버전 만들기

`frontend-app` 폴더의 터미널에서 다음 명령을 실행합니다.

```powershell
npx.cmd --yes eas-cli@latest build --platform android --profile preview
```

빌드가 완료되면 새 설치 링크를 공유합니다. 기존 Expo 프로젝트와 서명키를
그대로 사용해 기존 앱 위에 업데이트 설치합니다. EAS Update는 아직 설정하지
않았으므로 앱 코드 변경은 새 APK가 필요하며, 서버만 수정한 경우는 서버만 배포합니다.

## 개발자용 상세 설정

Run commands in `frontend-app`. The `preview` build produces a release APK with
the JavaScript bundle included. Expo Go and a running Metro server are not needed.
The app still needs internet access to the deployed backend.

## First build

1. Sign in to the Expo account that will own the app:

   ```powershell
   npx.cmd --yes eas-cli@latest login
   ```

2. Link or create the EAS project. Keep the generated project ID in `app.json`:

   ```powershell
   npx.cmd --yes eas-cli@latest init
   ```

3. Configure the EAS `preview` environment with the app's public configuration.
   The current `.env.local` contains only `EXPO_PUBLIC_*` values for the API,
   Kakao map and Firebase client. Recheck this before uploading it; never upload
   backend credentials or Firebase service-account private keys as app variables.

   ```powershell
   npx.cmd --yes eas-cli@latest env:push preview --path .env.local
   ```

   Local environment files are excluded from the build archive. `eas.json`
   explicitly sets the deployed API URL and disables mock APIs. Firebase and
   Kakao values must be present in the EAS preview environment before building.

4. Build the APK. On the first build, let EAS generate and manage the Android
   keystore. Keep using this project and signing key for subsequent updates.

   ```powershell
   npx.cmd --yes eas-cli@latest build --platform android --profile preview
   ```

5. Open the completed build's install link on the Galaxy, download the APK and
   allow installation from the downloading browser if Android requests it.

## Verify on the phone

- Close the PC's Expo development server and launch the installed app.
- Sign in, open existing posts, and create a test post with a camera/gallery image.
- Restart the app and verify the posted image loads.
- Check maps/location and chat on the actual device.

## Later changes

Run the build command again and share the new APK. The preview profile increments
the Android version code through EAS. Install the new APK over the existing app
using the same signing key. EAS Update is not configured in this project yet, so
app-code changes currently require a new APK; server-only changes do not.

The repository-root `.easignore` uploads only the mobile source and excludes
generated native projects so EAS regenerates Android from `app.json`.
