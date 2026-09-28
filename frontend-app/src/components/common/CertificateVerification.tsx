import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/src/context/AppContext';
import { scanCertificate, verifyCertificateCode, CertificationResult } from '@/src/services/certification';
import { captureImage, pickImageFromLibrary } from '@/src/utils/imagePicker';
import { colors } from '@/src/theme/colors';
import { AppButton } from './AppButton';
import { AppTextField } from './AppTextField';

export function CertificateVerification() {
  const { signupDraft: draft, mergeSignupDraft } = useAppContext();
  const [manualCode, setManualCode] = useState(draft.certificateCode ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const failures = draft.certificateScanFailures ?? 0;
  const verified = Boolean(draft.certificateVerified && draft.certificateCode);

  const applyResult = (result: CertificationResult, scanned: boolean) => {
    if (!mounted.current) return;
    if (result.code) {
      mergeSignupDraft({ certificateCode: result.code, certificateVerified: true });
      setManualCode(result.code);
      setError('');
    } else {
      mergeSignupDraft({ certificateCode: '', certificateVerified: false,
        ...(scanned && ['QR_NOT_FOUND', 'QR_UNREADABLE'].includes(result.errorCode ?? '')
          ? { certificateScanFailures: failures + 1 } : {}) });
      setError(result.error || '인증서를 확인하지 못했습니다.');
    }
  };

  const run = async (source: 'camera' | 'gallery' | 'manual') => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (source === 'manual') {
        mergeSignupDraft({ certificateCode: '', certificateVerified: false });
        setError('');
        applyResult(await verifyCertificateCode(manualCode.trim()), false);
      } else {
        const image = source === 'camera' ? await captureImage() : await pickImageFromLibrary();
        if (!image || !mounted.current) return;
        mergeSignupDraft({ certificateImage: image, certificateCode: '', certificateVerified: false });
        setManualCode('');
        setError('');
        applyResult(await scanCertificate(image), true);
      }
    } catch {
      if (mounted.current) setError('사진을 불러오지 못했습니다. 다시 시도해주세요.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <View style={s.card}>
      <View style={s.heading}>
        <Ionicons name="qr-code-outline" size={22} color={colors.brand} />
        <Text style={s.title}>취약계층 인증 서류 *</Text>
      </View>
      <Text style={s.help}>인증서의 QR이 선명하게 보이도록 촬영하거나 사진을 선택해주세요.</Text>
      {draft.certificateImage ? <Image accessibilityLabel="선택한 인증서" source={{ uri: draft.certificateImage.uri }} style={s.preview} resizeMode="contain" /> : null}
      <View style={s.actions}>
        <AppButton style={s.button} label="사진 선택" variant="secondary" disabled={busy} onPress={() => void run('gallery')} />
        <AppButton style={s.button} label="카메라 촬영" variant="secondary" disabled={busy} onPress={() => void run('camera')} />
      </View>
      {busy ? <Text style={s.help} accessibilityLiveRegion="polite">인증서를 확인하고 있어요…</Text> : null}
      {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      {failures === 1 && !verified ? <Text style={s.help}>한 번 더 인식에 실패하면 인증 번호를 직접 입력할 수 있어요.</Text> : null}
      {failures >= 2 ? (
        <View style={s.manual}>
          <Text style={s.title}>인증 번호 직접 입력</Text>
          <Text style={s.help}>QR을 두 번 인식하지 못했어요. 인증서에 표시된 QR 인증 번호를 입력해주세요.</Text>
          <AppTextField accessibilityLabel="인증 번호" placeholder="인증 번호" keyboardType="number-pad" maxLength={10}
            autoCapitalize="none" autoCorrect={false} editable={!busy} value={manualCode}
            onChangeText={(value) => {
              setManualCode(value);
              setError('');
              mergeSignupDraft({ certificateCode: '', certificateVerified: false });
            }} />
          <AppButton label="인증 번호 확인" variant="secondary" disabled={!manualCode.trim() || busy || verified}
            onPress={() => void run('manual')} />
        </View>
      ) : null}
      {verified ? (
        <View style={s.heading} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
          <Text style={s.success}>인증서 확인 완료</Text>
        </View>
      ) : null}
      <Text style={s.help}>인증 번호는 회원가입이 완료될 때 사용 처리됩니다.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { padding: 18, gap: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  help: { fontSize: 13, lineHeight: 20, color: colors.textMuted },
  preview: { width: '100%', height: 180, borderRadius: 10, backgroundColor: colors.surfaceMuted },
  actions: { flexDirection: 'row', gap: 8 },
  button: { flex: 1 },
  manual: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, gap: 10 },
  error: { fontSize: 13, lineHeight: 20, color: colors.danger },
  success: { fontSize: 14, fontWeight: '700', color: colors.brand },
});
