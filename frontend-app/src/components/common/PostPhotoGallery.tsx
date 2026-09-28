import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Photo({ uri, width }: { uri: string; width: number }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain"
        accessibilityLabel="게시글 사진"
        onLoadStart={() => { setLoading(true); setFailed(false); }}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }} />
      {loading && <ActivityIndicator color="#fff" />}
      {failed && <Text style={styles.text}>사진을 불러오지 못했어요.</Text>}
    </View>
  );
}

function PhotoViewer({ images, onClose }: { images: string[]; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<string>>(null);
  const goTo = (next: number) => {
    const target = Math.max(0, Math.min(next, images.length - 1));
    list.current?.scrollToIndex({ index: target, animated: true });
    setIndex(target);
  };
  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.viewer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.toolbar}>
          <Text style={styles.text} accessibilityLiveRegion="polite">{index + 1} / {images.length}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="사진 전체화면 닫기" onPress={onClose} style={styles.button}>
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
        </View>
        <FlatList key={width} ref={list} data={images} horizontal pagingEnabled
          style={{ flex: 1 }} showsHorizontalScrollIndicator={false}
          keyExtractor={(uri, i) => `${i}-${uri}`} initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={event => setIndex(Math.max(0, Math.min(images.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
          renderItem={({ item }) => <Photo uri={item} width={width} />} />
        {images.length > 1 && <View style={styles.navigation}>
          <Pressable accessibilityRole="button" accessibilityLabel="이전 사진" disabled={index === 0} onPress={() => goTo(index - 1)} style={[styles.button, index === 0 && styles.disabled]}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
          <Text style={styles.text}>옆으로 넘겨서 보기</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="다음 사진" disabled={index === images.length - 1} onPress={() => goTo(index + 1)} style={[styles.button, index === images.length - 1 && styles.disabled]}>
            <Ionicons name="chevron-forward" size={28} color="#fff" />
          </Pressable>
        </View>}
      </View>
    </Modal>
  );
}

export function PostPhotoGallery({ images }: { images: string[] }) {
  const [open, setOpen] = useState(false);
  if (!images.length) return null;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`게시글 사진 전체화면으로 보기, 총 ${images.length}장`} onPress={() => setOpen(true)}>
      <Image source={{ uri: images[0] }} style={styles.preview} contentFit="cover" />
      <View pointerEvents="none" style={styles.badge}>
        <Ionicons name="expand-outline" size={16} color="#fff" />
        <Text style={styles.text}>{images.length > 1 ? `사진 ${images.length}장 · 크게 보기` : '크게 보기'}</Text>
      </View>
    </Pressable>
    {open && <PhotoViewer images={images} onClose={() => setOpen(false)} />}
  </>;
}

const styles = StyleSheet.create({
  preview: { width: '100%', height: 260, backgroundColor: '#eee' },
  badge: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  viewer: { flex: 1, backgroundColor: '#000' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 8, minHeight: 56 },
  text: { color: '#fff', fontSize: 14 },
  button: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  disabled: { opacity: 0.3 },
});
