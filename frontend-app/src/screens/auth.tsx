import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppButton } from '@/src/components/common/AppButton';
import { AppHeader } from '@/src/components/common/AppHeader';
import { AppScreen } from '@/src/components/common/AppScreen';
import { AppTextField } from '@/src/components/common/AppTextField';
import { useAppContext } from '@/src/context/AppContext';
import { mockSignupPresets, neighborhoodOptions } from '@/src/data/mockData';
import { colors } from '@/src/theme/colors';
import { styles } from '@/src/screens/auth.styles';
import { NeighborhoodLocation } from '@/src/types/app';
import { captureImage, pickImageFromLibrary } from '@/src/utils/imagePicker';
import { searchLocations } from '@/src/utils/location';
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

  const applyPreset = (presetId: string) => {
    const preset = mockSignupPresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    setFormData({
      name: preset.name,
      nickname: preset.nickname,
      email: preset.email,
      phone: preset.phone,
      birthdate: preset.birthdate,
      password: preset.password,
      confirmPassword: preset.password,
    });
    setErrors({});
  };

  return (
    <View style={styles.form}>
      <View style={styles.sampleSection}>
        <Text style={styles.sampleTitle}>테스트용 예시 회원 정보 20개</Text>
        <Text style={styles.supportText}>탭하면 이름, 닉네임, 전화번호, 생년월일, 이메일이 자동 입력됩니다.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sampleList}>
          {mockSignupPresets.map((preset) => (
            <Pressable key={preset.id} onPress={() => applyPreset(preset.id)} style={styles.sampleChip}>
              <Text style={styles.sampleChipName}>{preset.name}</Text>
              <Text style={styles.sampleChipMeta}>{preset.nickname}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
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
      <AppTextField
        label="전화번호 *"
        keyboardType="phone-pad"
        value={formData.phone}
        onChangeText={(value) => update('phone', value)}
        error={errors.phone}
      />
      <AppTextField
        label="생년월일 *"
        value={formData.birthdate}
        onChangeText={(value) => update('birthdate', value)}
        placeholder="예: 1998-02-14"
        error={errors.birthdate}
      />
      {includeCertificate ? (
        <Text style={styles.supportText}>다음 화면에서 증명서 이미지를 선택적으로 첨부할 수 있습니다.</Text>
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
      <AppButton
        label="다음"
        onPress={() => {
          if (validate()) {
            onNext(formData);
          }
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
          취약계층 인증은 선택사항이며, 나중에 마이페이지에서도 등록 가능합니다.
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

  const pickCertificate = async (source: 'camera' | 'gallery') => {
    const image = source === 'camera' ? await captureImage() : await pickImageFromLibrary();
    if (!image) {
      return;
    }

    mergeSignupDraft({ certificateImage: image });
    setCertificateImageName(image.name);
  };

  return (
    <AuthShell title="개인정보 입력">
      <SignupForm
        includeCertificate
        onNext={(payload) => {
          mergeSignupDraft({ ...payload, isVulnerable: true });
        }}
      />
      <View style={styles.uploadCard}>
        <Text style={styles.uploadTitle}>취약계층 증빙 이미지</Text>
        <Text style={styles.supportText}>카메라로 촬영하거나 갤러리에서 이미지를 선택할 수 있습니다.</Text>
        {certificateImageName ? <Text style={styles.selectedFile}>{certificateImageName}</Text> : null}
        <View style={styles.inlineButtons}>
          <AppButton label="갤러리 선택" variant="secondary" onPress={() => pickCertificate('gallery')} />
          <AppButton label="카메라 촬영" variant="secondary" onPress={() => pickCertificate('camera')} />
        </View>
        <AppButton label="동네 설정으로 이동" onPress={() => router.push('/location-setting')} />
      </View>
    </AuthShell>
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
  const { completeSignup } = useAppContext();
  const [city, setCity] = useState('서울시');
  const [neighborhood, setNeighborhood] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<NeighborhoodLocation | null>(null);
  const [loading, setLoading] = useState(false);

  const results = useMemo(
    () => searchLocations(neighborhoodOptions, city, neighborhood),
    [city, neighborhood],
  );

  const handleComplete = async () => {
    if (!selectedLocation) {
      Alert.alert('동네를 선택해주세요', '가입을 완료하려면 동네를 하나 선택해야 합니다.');
      return;
    }

    setLoading(true);
    const result = await completeSignup(selectedLocation);
    setLoading(false);

    if (result.error) {
      Alert.alert('회원가입 실패', result.error);
      return;
    }

    router.replace('/(tabs)/index');
  };

  return (
    <AuthShell title="내 동네 설정">
      <View style={styles.form}>
        <Text style={styles.centerDescription}>
          주소를 `OO시 OO동` 형태로 입력하고, 반경 5km 이내 이웃 게시글을 기본으로 보게 됩니다.
        </Text>
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

      <View style={styles.resultList}>
        {results.map((location) => {
          const active = selectedLocation?.id === location.id;
          return (
            <Pressable
              key={location.id}
              onPress={() => setSelectedLocation(location)}
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
