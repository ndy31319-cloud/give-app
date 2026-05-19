import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppButton } from '@/src/components/common/AppButton';
import { AppHeader } from '@/src/components/common/AppHeader';
import { buildCurrentLocation, buildKakaoMapUrl, KakaoMapPreview } from '@/src/components/common/KakaoMapPreview';
import { AppScreen } from '@/src/components/common/AppScreen';
import { AppTextField } from '@/src/components/common/AppTextField';
import { useAppContext } from '@/src/context/AppContext';
import { neighborhoodOptions } from '@/src/data/mockData';
import { colors } from '@/src/theme/colors';
import { styles } from '@/src/screens/auth.styles';
import { NeighborhoodLocation } from '@/src/types/app';
import { captureImage, pickImageFromLibrary } from '@/src/utils/imagePicker';
import { formatLocationLabel, searchLocations } from '@/src/utils/location';
import {
  validateEmail,
  validateLoginIdentifier,
  validatePassword,
  validatePasswordMatch,
  validatePhone,
  validateRequired,
} from '@/src/utils/validation';

const vulnerableTypes = [
  { id: 'basic_livelihood', label: '기초생활수급자' },
  { id: 'near_poverty', label: '차상위계층' },
  { id: 'single_parent', label: '한부모가정' },
  { id: 'disabled', label: '장애인' },
  { id: 'elderly', label: '노인' },
  { id: 'youth', label: '아동/청소년' },
  { id: 'other', label: '기타' },
];

function splitPhone(phone = '') {
  const digits = phone.replace(/\D/g, '').slice(0, 11);
  return {
    first: digits.slice(0, 3),
    second: digits.slice(3, 7),
    third: digits.slice(7, 11),
  };
}

function joinPhone(phoneParts: { first: string; second: string; third: string }) {
  return [phoneParts.first, phoneParts.second, phoneParts.third].filter(Boolean).join('-');
}

function PhoneFields({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (phone: string) => void;
  error?: string;
}) {
  const parts = splitPhone(value);

  const update = (field: keyof typeof parts, nextValue: string) => {
    const nextParts = {
      ...parts,
      [field]: nextValue.replace(/\D/g, '').slice(0, field === 'first' ? 3 : 4),
    };
    onChange(joinPhone(nextParts));
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.fieldLabel}>전화번호 *</Text>
      <View style={styles.phoneRow}>
        <View style={styles.phoneField}>
          <AppTextField
            keyboardType="number-pad"
            value={parts.first}
            onChangeText={(value) => update('first', value)}
            placeholder="010"
          />
        </View>
        <Text style={styles.phoneDash}>-</Text>
        <View style={styles.phoneField}>
          <AppTextField
            keyboardType="number-pad"
            value={parts.second}
            onChangeText={(value) => update('second', value)}
            placeholder="1234"
          />
        </View>
        <Text style={styles.phoneDash}>-</Text>
        <View style={styles.phoneField}>
          <AppTextField
            keyboardType="number-pad"
            value={parts.third}
            onChangeText={(value) => update('third', value)}
            placeholder="5678"
          />
        </View>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function AuthShell({
  title,
  children,
  showBackButton = true,
}: {
  title: string;
  children: React.ReactNode;
  showBackButton?: boolean;
}) {
  return (
    <AppScreen scroll contentContainerStyle={styles.scrollContent}>
      <AppHeader title={title} showBackButton={showBackButton} />
      <View style={styles.section}>{children}</View>
    </AppScreen>
  );
}

function SignupForm({
  includeCertificate,
  onNext,
  beforeSubmit,
}: {
  includeCertificate: boolean;
  onNext: (payload: {
    name: string;
    nickname: string;
    email: string;
    phone: string;
    birthdate: string;
    password: string;
    confirmPassword: string;
  }) => void;
  beforeSubmit?: (helpers: { submitForm: () => boolean }) => React.ReactNode;
}) {
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    email: '',
    phone: '',
    birthdate: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!validateRequired(formData.name)) nextErrors.name = '이름을 입력해주세요';
    if (!validateRequired(formData.nickname)) nextErrors.nickname = '닉네임을 입력해주세요';
    if (!validateRequired(formData.email) || !validateEmail(formData.email)) {
      nextErrors.email = '올바른 이메일 형식을 입력해주세요';
    }
    if (!validateRequired(formData.phone) || !validatePhone(formData.phone)) {
      nextErrors.phone = '올바른 전화번호를 입력해주세요';
    }
    if (!validateRequired(formData.birthdate)) nextErrors.birthdate = '생년월일을 입력해주세요';
    if (!validateRequired(formData.password) || !validatePassword(formData.password)) {
      nextErrors.password = '비밀번호는 8자 이상 영문+숫자 조합이어야 합니다';
    }
    if (!validatePasswordMatch(formData.password, formData.confirmPassword)) {
      nextErrors.confirmPassword = '비밀번호가 일치하지 않습니다';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitForm = () => {
    if (!validate()) {
      return false;
    }

    onNext(formData);
    return true;
  };

  return (
    <View style={styles.form}>
      <AppTextField label="이름 *" value={formData.name} onChangeText={(value) => update('name', value)} error={errors.name} />
      <AppTextField label="닉네임 *" value={formData.nickname} onChangeText={(value) => update('nickname', value)} error={errors.nickname} />
      <AppTextField
        label="이메일 *"
        keyboardType="email-address"
        autoCapitalize="none"
        value={formData.email}
        onChangeText={(value) => update('email', value)}
        error={errors.email}
      />
      <PhoneFields value={formData.phone} onChange={(value) => update('phone', value)} error={errors.phone} />
      <AppTextField
        label="생년월일 *"
        value={formData.birthdate}
        onChangeText={(value) => update('birthdate', value)}
        placeholder="예: 1998-02-14"
        error={errors.birthdate}
      />
      {includeCertificate ? (
        <Text style={styles.supportText}>개인정보 입력 후 인증 서류를 등록하고 다음 단계로 진행해주세요.</Text>
      ) : null}
      <AppTextField
        label="비밀번호 *"
        secureTextEntry
        value={formData.password}
        onChangeText={(value) => update('password', value)}
        error={errors.password}
      />
      <AppTextField
        label="비밀번호 확인 *"
        secureTextEntry
        value={formData.confirmPassword}
        onChangeText={(value) => update('confirmPassword', value)}
        error={errors.confirmPassword}
      />
      {beforeSubmit?.({ submitForm })}
      <AppButton
        label="다음"
        onPress={() => {
          submitForm();
        }}
      />
    </View>
  );
}

export function SplashScreen() {
  const { isAuthenticated } = useAppContext();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(isAuthenticated ? '/(tabs)' : '/login');
    }, 1600);

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  return (
    <AppScreen>
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>
          <Text style={{ color: colors.brand }}>Give</Text>,기부
        </Text>
        <Text style={styles.splashSubtitle}>따뜻한 나눔, 함께하는 세상</Text>
      </View>
    </AppScreen>
  );
}

export function LoginScreen() {
  const { login } = useAppContext();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const nextErrors: { identifier?: string; password?: string } = {};

    if (!validateRequired(identifier) || !validateLoginIdentifier(identifier)) {
      nextErrors.identifier = '이메일 또는 전화번호를 확인해주세요';
    }
    if (!validateRequired(password)) {
      nextErrors.password = '비밀번호를 입력해주세요';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);
    const result = await login(identifier, password);
    setLoading(false);

    if (result.error) {
      Alert.alert('로그인 실패', result.error);
      return;
    }

    router.replace('/(tabs)/index');
  };

  return (
    <AppScreen scroll contentContainerStyle={styles.loginContent}>
      <View style={styles.loginHero}>
        <View style={styles.logoCircle}>
          <Ionicons name="heart" size={34} color="#fff" />
        </View>
        <Text style={styles.loginTitle}>Give, 기부</Text>
        <Text style={styles.loginSubtitle}>따뜻한 나눔, 함께하는 세상</Text>
      </View>

      <View style={styles.form}>
        <AppTextField
          label="이메일 또는 전화번호"
          keyboardType="email-address"
          autoCapitalize="none"
          value={identifier}
          onChangeText={setIdentifier}
          error={errors.identifier}
        />
        <AppTextField
          label="비밀번호"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={errors.password}
        />
        <AppButton label="로그인" onPress={handleLogin} loading={loading} />
      </View>

      <View style={styles.loginFooter}>
        <Pressable>
          <Text style={styles.subtleLink}>비밀번호 찾기</Text>
        </Pressable>
        <Text style={styles.footerText}>
          계정이 없으신가요?{' '}
          <Text style={styles.inlineLink} onPress={() => router.push('/signup')}>
            회원가입
          </Text>
        </Text>
      </View>
    </AppScreen>
  );
}

export function SignupScreen() {
  return (
    <AuthShell title="회원가입">
      <View style={styles.centerCard}>
        <Text style={styles.centerTitle}>취약계층이신가요?</Text>
        <Text style={styles.centerDescription}>
          취약계층 인증 시 맞춤형 정책 추천 서비스를 제공해드립니다.
        </Text>
      </View>
      <View style={styles.form}>
        <AppButton label="예, 맞습니다" onPress={() => router.push('/vulnerable-select')} />
        <AppButton label="아니요" variant="secondary" onPress={() => router.push('/personal-info')} />
        <Text style={styles.supportText}>
          취약계층으로 가입하는 경우 인증 자료 첨부가 필수입니다.
        </Text>
      </View>
    </AuthShell>
  );
}

export function VulnerableSelectScreen() {
  const { mergeSignupDraft } = useAppContext();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  return (
    <AuthShell title="취약계층 유형 선택">
      <View style={styles.centerCard}>
        <Ionicons name="heart-circle" size={44} color={colors.brand} />
        <Text style={styles.centerDescription}>해당하시는 유형을 선택해주세요. 복수 선택도 가능합니다.</Text>
      </View>

      <View style={styles.gridList}>
        {vulnerableTypes.map((type) => {
          const active = selectedTypes.includes(type.id);
          return (
            <Pressable
              key={type.id}
              onPress={() =>
                setSelectedTypes((prev) =>
                  active ? prev.filter((value) => value !== type.id) : [...prev, type.id],
                )
              }
              style={[styles.selectCard, active && styles.selectCardActive]}>
              <Ionicons
                name={active ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={active ? colors.brand : colors.textLight}
              />
              <Text style={[styles.selectCardLabel, active && styles.selectCardLabelActive]}>{type.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <AppButton
        label="다음"
        disabled={selectedTypes.length === 0}
        onPress={() => {
          mergeSignupDraft({ isVulnerable: true, vulnerableTypes: selectedTypes });
          router.push('/vulnerable-info');
        }}
      />
    </AuthShell>
  );
}

export function VulnerableInfoScreen() {
  const { mergeSignupDraft, signupDraft } = useAppContext();
  const [certificateImageName, setCertificateImageName] = useState(signupDraft.certificateImage?.name ?? '');
  const [certificateError, setCertificateError] = useState('');
  const [infoReady, setInfoReady] = useState(Boolean(signupDraft.name && signupDraft.phone));
  const hasCertificate = Boolean(certificateImageName || signupDraft.certificateImage);

  const pickCertificate = async (source: 'camera' | 'gallery') => {
    try {
      const image = source === 'camera' ? await captureImage() : await pickImageFromLibrary();
      if (!image) {
        return;
      }

      mergeSignupDraft({ certificateImage: image });
      setCertificateImageName(image.name);
      setCertificateError('');
    } catch (error) {
      console.error('Certificate image picker failed:', error);
      const message = error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.';
      Alert.alert('증빙 이미지 선택 중 오류가 발생했습니다', message);
    }
  };

  return (
    <AuthShell title="개인정보 입력">
      <SignupForm
        includeCertificate
        onNext={(payload) => {
          mergeSignupDraft({ ...payload, isVulnerable: true });
          setInfoReady(true);
        }}
        beforeSubmit={({ submitForm }) => (
          <>
            <View style={styles.uploadCard}>
              <Text style={styles.uploadTitle}>취약계층 인증 서류 *</Text>
              <Text style={styles.supportText}>취약계층 회원가입을 완료하려면 인증 서류 이미지를 반드시 첨부해야 합니다.</Text>
              {certificateImageName ? <Text style={styles.selectedFile}>{certificateImageName}</Text> : null}
              <View style={styles.inlineButtons}>
                <AppButton label="갤러리 선택" variant="secondary" onPress={() => pickCertificate('gallery')} />
                <AppButton label="카메라 촬영" variant="secondary" onPress={() => pickCertificate('camera')} />
              </View>
              {certificateError ? <Text style={styles.errorText}>{certificateError}</Text> : null}
            </View>

            <View style={styles.locationActionCard}>
              <Text style={styles.uploadTitle}>동네 설정</Text>
              <Text style={styles.supportText}>개인정보와 인증 서류 등록을 완료한 뒤 대표 동네를 설정합니다.</Text>
              <AppButton
                label="동네 설정으로 이동"
                onPress={() => {
                  const validInfo = infoReady || submitForm();
                  if (!validInfo) {
                    return;
                  }
                  if (!hasCertificate) {
                    setCertificateError('취약계층 인증 자료를 첨부해주세요.');
                    return;
                  }
                  router.push('/location-setting');
                }}
              />
            </View>
          </>
        )}
      />
    </AuthShell>
  );
}

export function SignupCompleteScreen() {
  return (
    <AppScreen scroll contentContainerStyle={styles.loginContent}>
      <View style={styles.completeCard}>
        <View style={styles.logoCircle}>
          <Ionicons name="checkmark" size={36} color="#fff" />
        </View>
        <Text style={styles.centerTitle}>회원가입이 완료되었습니다</Text>
        <Text style={styles.centerDescription}>
          이제 동네 기준으로 나눔과 요청 게시글을 확인할 수 있습니다.
        </Text>
      </View>
      <AppButton label="홈으로 이동" onPress={() => router.replace('/(tabs)/index')} />
    </AppScreen>
  );
}

export function PersonalInfoScreen() {
  const { mergeSignupDraft } = useAppContext();

  return (
    <AuthShell title="개인정보 입력">
      <SignupForm
        includeCertificate={false}
        onNext={(payload) => {
          mergeSignupDraft({ ...payload, isVulnerable: false, vulnerableTypes: [] });
          router.push('/location-setting');
        }}
      />
    </AuthShell>
  );
}

export function LocationSettingScreen() {
  const { completeSignup, signupDraft } = useAppContext();
  const [city, setCity] = useState('서울시');
  const [neighborhood, setNeighborhood] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<NeighborhoodLocation | null>(null);
  const [signupNeighborhoods, setSignupNeighborhoods] = useState<NeighborhoodLocation[]>([]);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);

  const results = useMemo(
    () => searchLocations(neighborhoodOptions, city, neighborhood),
    [city, neighborhood],
  );
  const selectedAlreadyAdded = Boolean(
    selectedLocation &&
      signupNeighborhoods.some(
        (location) =>
          location.id === selectedLocation.id ||
          (location.dongName === selectedLocation.dongName && location.district === selectedLocation.district),
      ),
  );

  const applySelectedLocation = (location: NeighborhoodLocation) => {
    setSelectedLocation(location);
    setCity(location.city);
    setNeighborhood(location.neighborhood);
  };

  const setCurrentLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('위치 권한이 필요합니다', '현재 위치로 동네를 설정하려면 위치 권한을 허용해주세요.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const addresses = await Location.reverseGeocodeAsync(current.coords).catch(() => []);
      applySelectedLocation(buildCurrentLocation(current.coords, addresses[0]));
    } catch {
      Alert.alert('현재 위치 확인 실패', '잠시 후 다시 시도해주세요.');
    } finally {
      setLocating(false);
    }
  };

  const addSelectedNeighborhood = () => {
    if (!selectedLocation) {
      Alert.alert('동네를 선택해주세요', '추가할 동네를 먼저 선택해주세요.');
      return;
    }
    if (selectedAlreadyAdded) {
      return;
    }
    setSignupNeighborhoods((prev) => [...prev, selectedLocation]);
  };

  const handleComplete = async () => {
    const representativeLocation = selectedLocation ?? signupNeighborhoods[0] ?? null;

    if (signupDraft.isVulnerable && !signupDraft.certificateImage) {
      Alert.alert('인증 서류가 필요합니다', '취약계층 회원가입은 인증 서류 첨부가 필수입니다.');
      router.replace('/vulnerable-info');
      return;
    }

    if (!representativeLocation) {
      Alert.alert('동네를 선택해주세요', '가입을 완료하려면 동네를 하나 선택해야 합니다.');
      return;
    }

    setLoading(true);
    const result = await completeSignup(representativeLocation);
    setLoading(false);

    if (result.error) {
      Alert.alert('회원가입 실패', result.error);
      return;
    }

    router.replace('/signup-complete');
  };

  return (
    <AuthShell title="내 동네 설정">
      <View style={styles.formCard}>
        <Text style={styles.sectionText}>
          현재 위치로 동네를 잡거나 주소를 검색해서 대표 동네를 설정할 수 있습니다. 기본 범위는 5km입니다.
        </Text>
        <AppButton
          label={locating ? '현재 위치 확인 중' : '현재 위치로 설정'}
          onPress={setCurrentLocation}
          loading={locating}
        />
        <AppTextField label="시/도" value={city} onChangeText={setCity} placeholder="예: 서울시" />
        <AppTextField
          label="동"
          value={neighborhood}
          onChangeText={setNeighborhood}
          placeholder="예: 역삼동"
          hint="검색 결과에서 정확한 동네를 선택해주세요."
        />
      </View>

      <View style={styles.locationNotice}>
        <Ionicons name="walk-outline" size={18} color={colors.brand} />
        <Text style={styles.locationNoticeText}>기본 동네 범위는 5km로 설정됩니다.</Text>
      </View>

      <View style={styles.formCard}>
        <View style={styles.mapHeaderRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.settingsTitle}>회원가입 동네 목록</Text>
            <Text style={styles.sectionText}>여러 동네를 추가하고 가입에 사용할 대표 동네를 선택하세요.</Text>
          </View>
          <AppButton
            label={selectedAlreadyAdded ? '추가됨' : '동네 추가'}
            variant="secondary"
            disabled={!selectedLocation || selectedAlreadyAdded}
            onPress={addSelectedNeighborhood}
          />
        </View>

        {signupNeighborhoods.length ? (
          <View style={styles.neighborhoodList}>
            {signupNeighborhoods.map((location) => {
              const active = selectedLocation?.id === location.id;
              return (
                <View key={location.id} style={[styles.neighborhoodRow, active && styles.neighborhoodRowActive]}>
                  <Pressable style={{ flex: 1, gap: 4 }} onPress={() => applySelectedLocation(location)}>
                    <Text style={[styles.resultTitle, active && styles.resultTitleActive]}>
                      {formatLocationLabel(location)}
                    </Text>
                    <Text style={styles.resultDescription}>{active ? '대표 동네' : `반경 ${location.radiusKm}km`}</Text>
                  </Pressable>
                  {!active ? (
                    <Pressable style={styles.smallIconButton} onPress={() => applySelectedLocation(location)}>
                      <Ionicons name="checkmark-outline" size={18} color={colors.brand} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={styles.smallIconButton}
                    onPress={() => {
                      setSignupNeighborhoods((prev) => prev.filter((item) => item.id !== location.id));
                      if (selectedLocation?.id === location.id) {
                        setSelectedLocation(null);
                      }
                    }}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.sectionText}>아직 추가한 동네가 없습니다.</Text>
        )}
      </View>

      <View style={styles.formCard}>
        <View style={styles.mapHeaderRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.settingsTitle}>카카오맵 위치 확인</Text>
            <Text style={styles.sectionText}>
              {selectedLocation ? formatLocationLabel(selectedLocation) : '선택한 동네가 없습니다.'}
            </Text>
          </View>
          {selectedLocation ? (
            <Pressable style={styles.mapOpenButton} onPress={() => Linking.openURL(buildKakaoMapUrl(selectedLocation))}>
              <Ionicons name="open-outline" size={18} color={colors.brand} />
            </Pressable>
          ) : null}
        </View>
        <KakaoMapPreview location={selectedLocation} onLocationChange={applySelectedLocation} />
      </View>

      <View style={styles.resultList}>
        {results.map((location) => {
          const active = selectedLocation?.id === location.id;
          return (
            <Pressable
              key={location.id}
              onPress={() => applySelectedLocation(location)}
              style={[styles.resultCard, active && styles.resultCardActive]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.resultTitle, active && styles.resultTitleActive]}>{location.fullAddress}</Text>
                <Text style={styles.resultDescription}>{location.radiusKm}km 이내 이웃 게시글 표시</Text>
              </View>
              {active ? <Ionicons name="checkmark-circle" size={22} color={colors.brand} /> : null}
            </Pressable>
          );
        })}
      </View>

      <AppButton label="가입 완료" onPress={handleComplete} loading={loading} />
    </AuthShell>
  );
}
