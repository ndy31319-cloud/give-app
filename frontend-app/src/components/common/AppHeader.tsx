import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors, radius, spacing } from '@/src/theme/colors';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  right?: ReactNode;
  onBackPress?: () => void;
  onTitlePress?: () => void;
}

export function AppHeader({
  title,
  subtitle,
  showBackButton = true,
  right,
  onBackPress,
  onTitlePress,
}: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.side}>
        {showBackButton ? (
          <Pressable
            accessibilityRole="button"
            onPress={onBackPress ?? (() => router.back())}
            style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
      <Pressable
        accessibilityRole={onTitlePress ? 'button' : undefined}
        disabled={!onTitlePress}
        onPress={onTitlePress}
        style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </Pressable>
      <View style={styles.side}>{right ?? <View style={styles.placeholder} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 54,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
  },
  side: {
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
});
