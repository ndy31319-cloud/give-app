import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

import { colors, radius } from '@/src/theme/colors';
import { NeighborhoodLocation } from '@/src/types/app';
import { formatLocationLabel } from '@/src/utils/location';

const kakaoMapAppKey =
  process.env.EXPO_PUBLIC_KAKAO_MAP_APP_KEY ??
  process.env.EXPO_PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY ??
  process.env.EXPO_PUBLIC_KAKAO_MAP_KEY ??
  '';

const defaultMapLocation: NeighborhoodLocation = {
  id: 'map_default',
  city: '서울특별시',
  district: '중구',
  neighborhood: '태평로1가',
  dongName: '태평로1가',
  fullAddress: '서울특별시 중구 태평로1가',
  latitude: 37.5665,
  longitude: 126.978,
  radiusKm: 5,
};

export function buildKakaoMapUrl(location: NeighborhoodLocation) {
  const label = encodeURIComponent(formatLocationLabel(location));
  return `https://map.kakao.com/link/map/${label},${location.latitude},${location.longitude}`;
}

export function buildCurrentLocation(
  coords: { latitude: number; longitude: number },
  address?: Location.LocationGeocodedAddress,
): NeighborhoodLocation {
  const city = address?.region || address?.city || '';
  const district = address?.district || address?.subregion || '';
  const neighborhood = address?.street || address?.name || address?.district || '현재 위치';
  const fullAddress = [city, district, neighborhood].filter(Boolean).join(' ') || '현재 위치';

  return {
    id: `current_${Date.now()}`,
    city: city || '현재 위치',
    district,
    neighborhood,
    dongName: neighborhood,
    fullAddress,
    latitude: coords.latitude,
    longitude: coords.longitude,
    radiusKm: 5,
  };
}

function buildMapLocation(
  source: NeighborhoodLocation,
  latitude: number,
  longitude: number,
  address?: {
    addressName?: string;
    region1?: string;
    region2?: string;
    region3?: string;
  },
): NeighborhoodLocation {
  const city = address?.region1 || source.city;
  const district = address?.region2 || source.district;
  const neighborhood = address?.region3 || source.neighborhood;
  const fullAddress = address?.addressName || [city, district, neighborhood].filter(Boolean).join(' ');

  return {
    ...source,
    id: `map_${Date.now()}`,
    city,
    district,
    neighborhood,
    dongName: neighborhood,
    fullAddress,
    latitude,
    longitude,
  };
}

type CurrentPosition = { latitude: number; longitude: number };

const currentDotContent = '<div aria-label="현재 위치" style="width:16px;height:16px;border:3px solid white;border-radius:50%;background:#2585f5;box-shadow:0 0 0 7px rgba(37,133,245,.18);pointer-events:none"></div>';

function WebKakaoMap({
  location,
  moveMarkerOnMapInteraction,
  moveMarkerOnMapDragEnd,
  onLocationChange,
  onMapError,
  currentPosition,
  showSelectedMarker,
}: {
  location: NeighborhoodLocation;
  moveMarkerOnMapInteraction: boolean;
  moveMarkerOnMapDragEnd: boolean;
  onLocationChange: (location: NeighborhoodLocation) => void;
  onMapError: (message: string) => void;
  currentPosition: CurrentPosition | null;
  showSelectedMarker: boolean;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const currentPositionRef = useRef(currentPosition);
  currentPositionRef.current = currentPosition;
  const updateCurrentPosition = useRef<((position: CurrentPosition, recenter: boolean) => void) | null>(null);

  useEffect(() => {
    if (currentPosition) updateCurrentPosition.current?.(currentPosition, true);
  }, [currentPosition]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !mapRef.current) {
      return;
    }

    const currentOrigin = window.location.origin;
    const scriptId = 'kakao-map-sdk';

    const initializeMap = () => {
      const kakao = (window as typeof window & { kakao?: any }).kakao;

      if (!kakao?.maps) {
        onMapError(
          `카카오맵 SDK를 불러오지 못했습니다. Kakao Developers의 Web 플랫폼 도메인에 ${currentOrigin}을 등록해주세요.`,
        );
        return;
      }

      kakao.maps.load(() => {
        if (!mapRef.current) {
          return;
        }

        const position = new kakao.maps.LatLng(location.latitude, location.longitude);
        const geocoder = new kakao.maps.services.Geocoder();
        const map = new kakao.maps.Map(mapRef.current, {
          center: position,
          level: 4,
        });
        const marker = new kakao.maps.Marker({ position, draggable: moveMarkerOnMapInteraction });
        if (showSelectedMarker) marker.setMap(map);
        const currentDot = new kakao.maps.CustomOverlay({ content: currentDotContent, zIndex: 2 });
        updateCurrentPosition.current = (coords, recenter) => {
          const point = new kakao.maps.LatLng(coords.latitude, coords.longitude);
          currentDot.setPosition(point);
          currentDot.setMap(map);
          if (recenter) map.panTo(point);
        };
        if (currentPositionRef.current) updateCurrentPosition.current(currentPositionRef.current, false);


        const sendLocation = (latLng: any) => {
          geocoder.coord2Address(latLng.getLng(), latLng.getLat(), (result: any, status: any) => {
            const address = status === kakao.maps.services.Status.OK && result?.[0]
              ? result[0].address || result[0].road_address || {}
              : {};

            onLocationChange(
              buildMapLocation(location, latLng.getLat(), latLng.getLng(), {
                addressName: address.address_name,
                region1: address.region_1depth_name,
                region2: address.region_2depth_name,
                region3: address.region_3depth_name,
              }),
            );
          });
        };

        if (moveMarkerOnMapInteraction) {
          kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
            const latLng = mouseEvent.latLng;
            marker.setPosition(latLng);
            map.panTo(latLng);
            sendLocation(latLng);
          });
        }

        if (moveMarkerOnMapDragEnd) {
          kakao.maps.event.addListener(map, 'dragend', () => {
            const center = map.getCenter();
            marker.setPosition(center);
            sendLocation(center);
          });
        }

        kakao.maps.event.addListener(marker, 'dragend', () => {
          const latLng = marker.getPosition();
          map.panTo(latLng);
          sendLocation(latLng);
        });
      });
    };

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      initializeMap();
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoMapAppKey}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = initializeMap;
    script.onerror = () => {
      onMapError(
        `카카오맵 SDK를 불러오지 못했습니다. Kakao Developers의 Web 플랫폼 도메인에 ${currentOrigin}을 등록해주세요.`,
      );
    };
    document.head.appendChild(script);
  }, [
    location,
    moveMarkerOnMapDragEnd,
    moveMarkerOnMapInteraction,
    onLocationChange,
    onMapError,
    showSelectedMarker,
  ]);

  return createElement('div', {
    ref: mapRef,
    style: {
      height: '100%',
      width: '100%',
    },
  });
}

export function KakaoMapPreview({
  location,
  onLocationChange,
  moveMarkerOnMapInteraction = true,
  moveMarkerOnMapDragEnd = moveMarkerOnMapInteraction,
  showCurrentLocation = false,
  initialCurrentPosition = null,
  showSelectedMarker = true,
  initializeSelectionFromCurrentLocation = true,
}: {
  location: NeighborhoodLocation | null;
  onLocationChange: (location: NeighborhoodLocation) => void;
  moveMarkerOnMapInteraction?: boolean;
  moveMarkerOnMapDragEnd?: boolean;
  showCurrentLocation?: boolean;
  initialCurrentPosition?: CurrentPosition | null;
  showSelectedMarker?: boolean;
  initializeSelectionFromCurrentLocation?: boolean;
}) {
  const [mapError, setMapError] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<CurrentPosition | null>(initialCurrentPosition);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const mounted = useRef(false);
  const requestId = useRef(0);
  const selectedByUser = useRef(false);
  const onLocationChangeRef = useRef(onLocationChange);
  const initializeSelection = useRef(initializeSelectionFromCurrentLocation);
  onLocationChangeRef.current = onLocationChange;
  const handleLocationChange = useCallback((next: NeighborhoodLocation) => {
    selectedByUser.current = true;
    onLocationChangeRef.current(next);
  }, []);

  const locate = useCallback(async (initial = false) => {
    const id = ++requestId.current;
    const active = () => mounted.current && requestId.current === id;
    setLocating(true);
    setLocationError(null);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!active()) return;
      if (permission.status !== 'granted') {
        setLocationError('위치 권한을 허용하면 내 위치를 볼 수 있어요. 약속장소는 지도에서 선택할 수 있어요.');
        return;
      }
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Location timeout')), 15000);
        }),
      ]);
      if (!active()) return;
      // A late initial GPS response must not override a place the user already picked.
      if (initial && initializeSelection.current && !selectedByUser.current) {
        onLocationChangeRef.current(buildCurrentLocation(position.coords));
      }
      setCurrentPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      if (active()) setLocationError('현재 위치를 가져오지 못했어요. 위치 설정을 확인하거나 지도에서 약속장소를 선택해주세요.');
    } finally {
      if (timeout) clearTimeout(timeout);
      if (active()) setLocating(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (showCurrentLocation && !initialCurrentPosition) void locate(true);
    return () => { mounted.current = false; requestId.current += 1; };
  }, [showCurrentLocation, locate, initialCurrentPosition]);

  const syncNativePosition = () => {
    if (!currentPosition) return;
    webViewRef.current?.injectJavaScript(`window.updateCurrentPosition && window.updateCurrentPosition(${JSON.stringify(currentPosition)}, true); true;`);
  };
  useEffect(syncNativePosition, [currentPosition]);
  const mapLocation = location ?? defaultMapLocation;

  if (!kakaoMapAppKey) {
    return (
      <View style={styles.mapPlaceholder}>
        <Ionicons name="key-outline" size={28} color={colors.textLight} />
        <Text style={styles.mapPlaceholderTitle}>카카오맵 JavaScript 키가 필요합니다</Text>
        <Text style={styles.sectionText}>
          앱 안에서 바로 지도를 띄우려면 카카오 JavaScript 키를 EXPO_PUBLIC_KAKAO_MAP_APP_KEY로 설정해주세요.
        </Text>
      </View>
    );
  }


  const html = `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
        </style>
        <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoMapAppKey}&autoload=false&libraries=services"></script>
      </head>
      <body>
        <div id="map"></div>
        <script>
          function postMapMessage(payload) {
            var message = JSON.stringify(payload);
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(message);
              return;
            }
            if (window.parent && window.parent.postMessage) {
              window.parent.postMessage(message, '*');
            }
          }

          window.onerror = function(message) {
            postMapMessage({
              type: 'mapError',
              message: String(message || '카카오맵을 불러오지 못했습니다.')
            });
          };

          function notifyError(message) {
            postMapMessage({
              type: 'mapError',
              message: message
            });
          }

          if (!window.kakao || !window.kakao.maps) {
            notifyError('카카오맵 SDK를 불러오지 못했습니다. Kakao Developers의 Web 플랫폼 도메인에 https://localhost를 등록해주세요.');
          } else {
          kakao.maps.load(function() {
            var position = new kakao.maps.LatLng(${mapLocation.latitude}, ${mapLocation.longitude});
            var geocoder = new kakao.maps.services.Geocoder();
            var map = new kakao.maps.Map(document.getElementById('map'), {
              center: position,
              level: 4
            });
            var marker = new kakao.maps.Marker({ position: position, draggable: ${moveMarkerOnMapInteraction} });
            if (${showSelectedMarker}) marker.setMap(map);
            var currentDot = new kakao.maps.CustomOverlay({ content: ${JSON.stringify(currentDotContent)}, zIndex: 2 });
            window.updateCurrentPosition = function(coords, recenter) {
              var point = new kakao.maps.LatLng(coords.latitude, coords.longitude);
              currentDot.setPosition(point);
              currentDot.setMap(map);
              if (recenter) map.panTo(point);
            };
            postMapMessage({ type: 'mapReady' });

            function sendLocation(latLng) {
              geocoder.coord2Address(latLng.getLng(), latLng.getLat(), function(result, status) {
                var payload = {
                  type: 'locationChanged',
                  latitude: latLng.getLat(),
                  longitude: latLng.getLng()
                };

                if (status === kakao.maps.services.Status.OK && result[0]) {
                  var address = result[0].address || result[0].road_address || {};
                  payload.addressName = address.address_name || '';
                  payload.region1 = address.region_1depth_name || '';
                  payload.region2 = address.region_2depth_name || '';
                  payload.region3 = address.region_3depth_name || '';
                }

                postMapMessage(payload);
              });
            }

            if (${moveMarkerOnMapInteraction ? 'true' : 'false'}) {
              kakao.maps.event.addListener(map, 'click', function(mouseEvent) {
                var latLng = mouseEvent.latLng;
                marker.setPosition(latLng);
                map.panTo(latLng);
                sendLocation(latLng);
              });
            }

            if (${moveMarkerOnMapDragEnd ? 'true' : 'false'}) {
              kakao.maps.event.addListener(map, 'dragend', function() {
                var center = map.getCenter();
                marker.setPosition(center);
                sendLocation(center);
              });
            }

            kakao.maps.event.addListener(marker, 'dragend', function() {
              var latLng = marker.getPosition();
              map.panTo(latLng);
              sendLocation(latLng);
            });
          });
          }
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.mapCard}>
      {Platform.OS === 'web'
        ? (
          <WebKakaoMap
            key={`${mapLocation.id}-${mapLocation.latitude}-${mapLocation.longitude}`}
            location={mapLocation}
            moveMarkerOnMapInteraction={moveMarkerOnMapInteraction}
            moveMarkerOnMapDragEnd={moveMarkerOnMapDragEnd}
            onLocationChange={handleLocationChange}
            onMapError={setMapError}
            currentPosition={currentPosition}
            showSelectedMarker={showSelectedMarker}
          />
        )
        : (
      <WebView
        ref={webViewRef}
        key={`${mapLocation.id}-${mapLocation.latitude}-${mapLocation.longitude}`}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost' }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onError={(event) => {
          setMapError(event.nativeEvent.description || '카카오맵을 불러오지 못했습니다.');
        }}
        onHttpError={(event) => {
          setMapError(`카카오맵 로딩 실패: HTTP ${event.nativeEvent.statusCode}`);
        }}
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data) as {
              type?: string;
              message?: string;
              latitude?: number;
              longitude?: number;
              addressName?: string;
              region1?: string;
              region2?: string;
              region3?: string;
            };

            if (payload.type === 'mapReady') {
              if (currentPosition) webViewRef.current?.injectJavaScript(`window.updateCurrentPosition(${JSON.stringify(currentPosition)}, false); true;`);
              return;
            }

            if (payload.type === 'mapError') {
              setMapError(payload.message ?? '카카오맵을 불러오지 못했습니다.');
              return;
            }

            if (
              payload.type === 'locationChanged' &&
              typeof payload.latitude === 'number' &&
              typeof payload.longitude === 'number'
            ) {
              handleLocationChange(
                buildMapLocation(mapLocation, payload.latitude, payload.longitude, {
                  addressName: payload.addressName,
                  region1: payload.region1,
                  region2: payload.region2,
                  region3: payload.region3,
                }),
              );
            }
          } catch {
            // Ignore malformed messages from the WebView.
          }
        }}
        style={styles.kakaoMap}
      />
        )}
      {showCurrentLocation && !mapError ? (
        <>
          {locationError ? <View pointerEvents="none" style={styles.locationNotice}><Text style={styles.locationNoticeText}>{locationError}</Text></View> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="현재 위치로 이동"
            accessibilityState={{ disabled: locating, busy: locating }}
            disabled={locating}
            onPress={() => void locate()}
            style={styles.locateButton}
          >
            {locating ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="locate-outline" size={25} color={currentPosition ? '#2585f5' : colors.text} />}
          </Pressable>
        </>
      ) : null}
      {mapError ? (
        <View style={styles.mapErrorOverlay}>
          <Ionicons name="alert-circle-outline" size={22} color={colors.warning} />
          <Text style={styles.mapErrorTitle}>카카오맵을 표시하지 못했습니다</Text>
          <Text style={styles.mapErrorText}>{mapError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  locateButton: {
    position: 'absolute', right: 12, bottom: 32,
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  locationNotice: {
    position: 'absolute', top: 10, left: 10, right: 10,
    backgroundColor: colors.surface, borderRadius: 8, padding: 10,
  },
  locationNoticeText: { fontSize: 12, lineHeight: 18, color: colors.textMuted },
  mapCard: {
    height: 260,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kakaoMap: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  mapErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 18,
    backgroundColor: colors.surfaceMuted,
  },
  mapErrorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  mapErrorText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
  },
  mapPlaceholder: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapPlaceholderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
