import { createElement, useEffect, useRef, useState } from 'react';
import { Platform, Text, View, StyleSheet } from 'react-native';
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

function WebKakaoMap({
  location,
  markerLabel,
  moveMarkerOnMapInteraction,
  moveMarkerOnMapDragEnd,
  onLocationChange,
  onMapError,
}: {
  location: NeighborhoodLocation;
  markerLabel: string;
  moveMarkerOnMapInteraction: boolean;
  moveMarkerOnMapDragEnd: boolean;
  onLocationChange: (location: NeighborhoodLocation) => void;
  onMapError: (message: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);

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
        const marker = new kakao.maps.Marker({ position, draggable: true });
        marker.setMap(map);

        const infowindow = new kakao.maps.InfoWindow({
          content: `<div style="padding:8px 10px;font-size:13px;white-space:nowrap;">${markerLabel}</div>`,
        });
        infowindow.open(map, marker);

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
    markerLabel,
    moveMarkerOnMapDragEnd,
    moveMarkerOnMapInteraction,
    onLocationChange,
    onMapError,
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
}: {
  location: NeighborhoodLocation | null;
  onLocationChange: (location: NeighborhoodLocation) => void;
  moveMarkerOnMapInteraction?: boolean;
  moveMarkerOnMapDragEnd?: boolean;
}) {
  const [mapError, setMapError] = useState<string | null>(null);
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

  const markerLabel = location ? formatLocationLabel(location) : '지도에서 위치를 선택해주세요';

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
            var marker = new kakao.maps.Marker({ position: position, draggable: true });
            marker.setMap(map);
            var infowindow = new kakao.maps.InfoWindow({
              content: '<div style="padding:8px 10px;font-size:13px;white-space:nowrap;">${markerLabel}</div>'
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
            markerLabel={markerLabel}
            moveMarkerOnMapInteraction={moveMarkerOnMapInteraction}
            moveMarkerOnMapDragEnd={moveMarkerOnMapDragEnd}
            onLocationChange={onLocationChange}
            onMapError={setMapError}
          />
        )
        : (
      <WebView
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

            if (payload.type === 'mapError') {
              setMapError(payload.message ?? '카카오맵을 불러오지 못했습니다.');
              return;
            }

            if (
              payload.type === 'locationChanged' &&
              typeof payload.latitude === 'number' &&
              typeof payload.longitude === 'number'
            ) {
              onLocationChange(
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
