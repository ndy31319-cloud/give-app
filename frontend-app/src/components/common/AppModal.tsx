import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius } from '@/src/theme/colors';

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  avoidKeyboard?: boolean;
  children: ReactNode;
}

export function AppModal({ visible, onClose, onDismiss, avoidKeyboard = false, children }: AppModalProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} onDismiss={onDismiss}>
      <KeyboardAvoidingView style={styles.overlay} enabled={avoidKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 12) }]}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    gap: 14,
    maxHeight: '85%',
  },
});
