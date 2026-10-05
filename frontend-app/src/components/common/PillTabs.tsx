import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/src/theme/colors';

interface PillTabsProps {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function PillTabs({ tabs, value, onChange }: PillTabsProps) {
  return (
    <View style={styles.content}>
      {tabs.map((tab) => {
        const active = tab.id === value;

        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  pill: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: radius.lg,
    paddingHorizontal: 8,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: colors.brandSoft,
  },
  pillInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  labelActive: {
    color: colors.brand,
  },
  labelInactive: {
    color: colors.textMuted,
  },
});
