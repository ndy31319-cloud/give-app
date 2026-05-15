import { StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/src/theme/colors';

export const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 28,
  },
  section: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  splashTitle: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.text,
  },
  splashSubtitle: {
    marginTop: 14,
    fontSize: 17,
    color: colors.textMuted,
  },
  loginContent: {
    padding: 24,
    gap: 28,
    flexGrow: 1,
    justifyContent: 'center',
  },
  loginHero: {
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  loginTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
  },
  loginSubtitle: {
    fontSize: 15,
    color: colors.textMuted,
  },
  form: {
    gap: 16,
  },
  sampleSection: {
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sampleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  sampleList: {
    gap: 8,
    paddingRight: 8,
  },
  sampleChip: {
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  sampleChipName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  sampleChipMeta: {
    fontSize: 11,
    color: colors.brand,
    fontWeight: '600',
  },
  loginFooter: {
    alignItems: 'center',
    gap: 12,
  },
  subtleLink: {
    color: colors.textMuted,
    fontSize: 14,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  inlineLink: {
    color: colors.brand,
    fontWeight: '700',
  },
  centerCard: {
    alignItems: 'center',
    gap: 10,
    padding: 22,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  centerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  centerDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
  },
  supportText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  gridList: {
    gap: 12,
  },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectCardActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  selectCardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  selectCardLabelActive: {
    color: colors.brand,
  },
  uploadCard: {
    gap: 12,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  selectedFile: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    color: colors.brand,
    fontWeight: '600',
  },
  inlineButtons: {
    gap: 12,
  },
  locationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
  },
  locationNoticeText: {
    flex: 1,
    fontSize: 14,
    color: colors.brand,
    fontWeight: '600',
  },
  resultList: {
    gap: 12,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultCardActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  resultTitleActive: {
    color: colors.brand,
  },
  resultDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
