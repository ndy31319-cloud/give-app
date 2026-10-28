import { useState } from 'react';
import { Image, ImageSource } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/src/theme/colors';

type MascotBand = 'low' | 'sitting' | 'neutral' | 'smiling' | 'singing';

const mascotSources: Record<MascotBand, number> = {
  low: require('../../../assets/images/mascot/mascot-0-10.png'),
  sitting: require('../../../assets/images/mascot/mascot-11-20.png'),
  neutral: require('../../../assets/images/mascot/mascot-21-30.png'),
  smiling: require('../../../assets/images/mascot/mascot-31-40.png'),
  singing: require('../../../assets/images/mascot/mascot-41-50.png'),
};

const mascotLabels: Record<MascotBand, string> = {
  low: '조금 지친 마음',
  sitting: '잠깐 쉬어가는 마음',
  neutral: '차분한 마음',
  smiling: '따뜻하게 웃는 마음',
  singing: '즐겁게 나누는 마음',
};

function safeScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(50, parsed));
}

function bandForScore(score: number): MascotBand {
  if (score <= 10) return 'low';
  if (score <= 20) return 'sitting';
  if (score <= 30) return 'neutral';
  if (score <= 40) return 'smiling';
  return 'singing';
}

export function HeartScoreMascot({ score }: { score: number | null | undefined }) {
  const [imageFailed, setImageFailed] = useState(false);
  const normalizedScore = safeScore(score);
  const band = bandForScore(normalizedScore ?? 25);
  const scoreLabel = normalizedScore === null ? '점수 확인 중' : `${normalizedScore.toFixed(1)}점`;

  return (
    <View style={styles.container} accessibilityLabel={`마음 점수 캐릭터, ${scoreLabel}`}>
      <View style={styles.imageFrame}>
        {imageFailed ? (
          <View style={styles.fallback} accessibilityLabel="마음 점수 캐릭터를 표시할 수 없음">
            <Ionicons name="heart" size={36} color={colors.brand} />
          </View>
        ) : (
          <Image
            source={mascotSources[band] as ImageSource}
            contentFit="contain"
            style={styles.image}
            accessibilityLabel={`${mascotLabels[band]} 마스코트`}
            onError={() => setImageFailed(true)}
          />
        )}
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{mascotLabels[band]}</Text>
        <Text style={styles.score}>{scoreLabel}</Text>
        <Text style={styles.hint}>후기를 받을수록 마스코트의 모습이 달라져요.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  imageFrame: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  image: { width: '100%', height: '100%' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  label: { color: colors.brand, fontSize: 15, lineHeight: 22, fontWeight: '800' },
  score: { color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
