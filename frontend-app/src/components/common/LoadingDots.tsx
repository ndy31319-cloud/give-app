import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';

export function LoadingDots({ label, accessibilityLabel = '응답을 기다리고 있어요' }: {
  label?: string;
  accessibilityLabel?: string;
}) {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.parallel(dots.map((dot, index) => Animated.sequence([
      Animated.delay(index * 150),
      Animated.timing(dot, { toValue: 1, duration: 250, useNativeDriver: true, isInteraction: false }),
      Animated.timing(dot, { toValue: 0, duration: 250, useNativeDriver: true, isInteraction: false }),
      Animated.delay(500 - index * 150),
    ]))));
    animation.start();
    return () => { animation.stop(); dots.forEach(dot => dot.setValue(0)); };
  }, [dots]);

  return (
    <View style={styles.row} accessible accessibilityRole="progressbar"
      accessibilityLabel={label ?? accessibilityLabel} accessibilityState={{ busy: true }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.dots}>
        {dots.map((dot, index) => <Animated.View key={index} style={[styles.dot, {
          opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
        }]} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, minHeight: 24, paddingVertical: 4 },
  label: { color: colors.brand, fontSize: 14 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 18 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
});
