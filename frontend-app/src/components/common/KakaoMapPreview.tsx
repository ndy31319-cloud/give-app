import { Text, View, StyleSheet } from 'react-native';
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

export function buildKakaoMapUrl(location: NeighborhoodLocation) {
  const label = encodeURIComponent(formatLocationLabel(location));
  return `https://map.kakao.com/link/map/${label},${location.latitude},${location.longitude}`;
}

export function buildCurrentLocation(
  coords: { latitude: number; longitude: number },
  address?: Location.LocationGeocodedAddress,
): NeighborhoodLocation {
  const city = address?.region || address?.city || '현재 위치';
  const district = address?.district || address?.subregion || '';
  const neighborhood = address?.street || address?.name || address?.district || '현 위치';
  const fullAddress = [city, district, neighborhood].filter(Boolean).join(' ');

  return {
    id: `current_${Date.now()}`,
    city,
    district,
    neighborhood,
    dongName: neighborhood,
    fullAddress: fullAddress || '현재 위치',
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

export function KakaoMapPreview({
  location,
  onLocationChange,
}: {
  location: NeighborhoodLocation | null;
  onLocationChange: (location: NeighborhoodLocation) => void;
}) {
  if (!location) {
    return (
      <View style={styles.mapPlaceholder}>
        <Ionicons name="map-outline" size={28} color={colors.textLight} />
        <Text style={styles.mapPlaceholderTitle}>지도에서 확인할 동네를 선택해주세요</Text>
        <Text style={styles.sectionText}>현재 위치 또는 검색 결과를 선택하면 카카오맵 기반 지도가 표시됩니다.</Text>
      </View>
    );
  }

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
          kakao.maps.load(function() {
            var position = new kakao.maps.LatLng(${location.latitude}, ${location.longitude});
            var geocoder = new kakao.maps.services.Geocoder();
            var map = new kakao.maps.Map(document.getElementById('map'), {
              center: position,
              level: 4
            });
            var marker = new kakao.maps.Marker({ position: position, draggable: true });
            marker.setMap(map);
            var infowindow = new kakao.maps.InfoWindow({
              content: '<div style="padding:8px 10px;font-size:13px;white-space:nowrap;">${formatLocationLabel(location)}</div>'
            });
            infowindow.open(map, marker);

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

                window.ReactNativeWebView.postMessage(JSON.stringify(payload));
              });
            }

            kakao.maps.event.addListener(map, 'click', function(mouseEvent) {
              var latLng = mouseEvent.latLng;
              marker.setPosition(latLng);
              map.panTo(latLng);
              sendLocation(latLng);
            });

            kakao.maps.event.addListener(map, 'dragend', function() {
              var center = map.getCenter();
              marker.setPosition(center);
              sendLocation(center);
            });

            kakao.maps.event.addListener(marker, 'dragend', function() {
              var latLng = marker.getPosition();
              map.panTo(latLng);
              sendLocation(latLng);
            });
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.mapCard}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data) as {
              type?: string;
              latitude?: number;
              longitude?: number;
              addressName?: string;
              region1?: string;
              region2?: string;
              region3?: string;
            };

            if (
              payload.type === 'locationChanged' &&
              typeof payload.latitude === 'number' &&
              typeof payload.longitude === 'number'
            ) {
              onLocationChange(
                buildMapLocation(location, payload.latitude, payload.longitude, {
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
    </View>
  );
}

const styles = StyleSheet.create({
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
