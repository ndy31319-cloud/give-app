import { ScrollView, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius } from '@/src/theme/colors';

interface PillTabsProps {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function PillTabs({ tabs, value, onChange }: PillTabsProps) {
  return (
    <ScrollView
      horizontal
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsHorizontalScrollIndicator={false}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    backgroundColor: colors.surface,
  },
  content: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pill: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: 15,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
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
