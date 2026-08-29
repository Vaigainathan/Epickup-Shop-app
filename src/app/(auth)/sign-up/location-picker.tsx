import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/constants/theme';
import {
  fetchPlaceAutocomplete,
  fetchPlaceDetails,
  PlacePrediction,
} from '@/lib/auth-api';
import { useLocationPicker } from '@/lib/location-picker-context';
import { getSessionToken } from '@/lib/session';

type Coordinate = {
  latitude: number;
  longitude: number;
};

const INDIA_REGION: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 20,
  longitudeDelta: 20,
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseCoordinate(
  latitudeParam: string | string[] | undefined,
  longitudeParam: string | string[] | undefined,
) {
  const latitude = Number(readParam(latitudeParam));
  const longitude = Number(readParam(longitudeParam));

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

function formatAddress(place: Location.LocationGeocodedAddress) {
  return [
    place.name,
    place.street,
    place.district,
    place.city,
    place.region,
    place.postalCode,
    place.country,
  ]
    .filter((part): part is string => Boolean(part))
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(', ');
}

function isAbortError(error: unknown) {
  return (error as any)?.name === 'AbortError';
}

export default function LocationPickerScreen() {
  const params = useLocalSearchParams<{
    initialAddress?: string;
    initialLatitude?: string;
    initialLongitude?: string;
  }>();
  const { publishResult } = useLocationPicker();
  const initialLocation = useMemo(
    () => parseCoordinate(params.initialLatitude, params.initialLongitude),
    [params.initialLatitude, params.initialLongitude],
  );
  const initialAddress = readParam(params.initialAddress) ?? '';
  const [location, setLocation] = useState<Coordinate | null>(initialLocation);
  const [address, setAddress] = useState(initialAddress);
  const [search, setSearch] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapVersion, setMapVersion] = useState(0);
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
  const mapRef = useRef<MapView>(null);
  const searchRequestId = useRef(0);

  const mapMeasured = mapDimensions.width > 0 && mapDimensions.height > 0;
  const selectedRegion = useMemo<Region>(
    () => ({
      ...(location ?? INDIA_REGION),
      latitudeDelta: location ? 0.02 : INDIA_REGION.latitudeDelta,
      longitudeDelta: location ? 0.02 : INDIA_REGION.longitudeDelta,
    }),
    [location],
  );

  useEffect(() => {
    const requestId = ++searchRequestId.current;
    if (search.trim().length < 2) {
      setPredictions([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);

      try {
        const token = await getSessionToken();
        if (!token) throw new Error('Your session expired. Please verify your phone again.');

        const nextPredictions = await fetchPlaceAutocomplete(
          search.trim(),
          token,
          controller.signal,
        );
        if (requestId === searchRequestId.current) setPredictions(nextPredictions);
      } catch (error) {
        if (!isAbortError(error) && requestId === searchRequestId.current) {
          setSearchError(error instanceof Error ? error.message : 'Could not search for a place.');
          setPredictions([]);
        }
      } finally {
        if (requestId === searchRequestId.current) setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  useEffect(() => {
    if (mapReady || !mapMeasured) return;

    const timer = setTimeout(() => {
      setMapError('The map could not be loaded. Check your connection or Maps configuration.');
    }, 10000);

    return () => clearTimeout(timer);
  }, [mapDimensions.height, mapDimensions.width, mapMeasured, mapReady, mapVersion]);

  async function reverseGeocode(coordinate: Coordinate, fallbackAddress?: string | null) {
    try {
      const results = await Location.reverseGeocodeAsync(coordinate);
      setAddress(results[0] ? formatAddress(results[0]) : fallbackAddress ?? '');
    } catch {
      setAddress(fallbackAddress ?? '');
    }
  }

  async function applyCoordinate(coordinate: Coordinate, fallbackAddress?: string | null) {
    setLocation(coordinate);
    setLocationError(null);
    setMapError(null);
    mapRef.current?.animateToRegion(
      {
        ...coordinate,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      350,
    );
    await reverseGeocode(coordinate, fallbackAddress);
  }

  async function selectPrediction(prediction: PlacePrediction) {
    setSearch(prediction.description);
    setPredictions([]);
    setSearchError(null);

    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Your session expired. Please verify your phone again.');

      const details = await fetchPlaceDetails(prediction.placeId, token);
      await applyCoordinate(
        { latitude: details.latitude, longitude: details.longitude },
        details.formattedAddress,
      );
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Could not load that place.');
    }
  }

  async function recenter() {
    setLocationError(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      setLocationError('Location permission is needed to recenter the map.');
      return;
    }

    try {
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.LocationAccuracy.Balanced,
      });
      await applyCoordinate({
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      });
    } catch {
      setLocationError('Could not determine your current location. Try searching instead.');
    }
  }

  function handleMapLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;

    setMapDimensions((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  }

  function confirmLocation() {
    if (!location) return;

    publishResult({
      address: address.trim(),
      latitude: location.latitude,
      longitude: location.longitude,
    });
    router.back();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <View style={styles.searchWrap}>
          <TextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder="Search for your shop location"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {searching ? <ActivityIndicator color={colors.primary} size="small" /> : null}
          {predictions.length > 0 ? (
            <View style={styles.predictions}>
              {predictions.map((prediction) => (
                <Pressable
                  key={prediction.placeId}
                  onPress={() => selectPrediction(prediction)}
                  style={styles.prediction}>
                  <Text style={styles.predictionMain}>
                    {prediction.mainText || prediction.description}
                  </Text>
                  {prediction.secondaryText ? (
                    <Text style={styles.predictionSecondary}>{prediction.secondaryText}</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {searchError ? <Text style={styles.error}>{searchError}</Text> : null}
      <View style={styles.mapHost}>
        <View onLayout={handleMapLayout} style={styles.mapViewport}>
          {mapMeasured ? (
            <MapView
              key={`map-${mapVersion}-${mapDimensions.width}x${mapDimensions.height}`}
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              mapType="standard"
              initialRegion={selectedRegion}
              onMapReady={() => {
                setMapReady(true);
                setMapError(null);
              }}
              onPress={(event) => applyCoordinate(event.nativeEvent.coordinate)}
              style={{ width: mapDimensions.width, height: mapDimensions.height }}>
              {location ? (
                <Marker
                  coordinate={location}
                  draggable
                  title="Shop Location"
                  onDragEnd={(event) => applyCoordinate(event.nativeEvent.coordinate)}
                />
              ) : null}
            </MapView>
          ) : null}
        </View>

        {mapError ? (
          <View style={styles.mapErrorOverlay}>
            <Text style={styles.mapErrorText}>{mapError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMapError(null);
                setMapReady(false);
                setMapVersion((value) => value + 1);
              }}
              style={styles.mapRetry}>
              <Text style={styles.mapRetryText}>Retry map</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.mapControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
            onPress={() => mapRef.current?.getCamera().then((camera) => {
              mapRef.current?.animateCamera({ ...camera, zoom: (camera.zoom ?? 12) + 1 });
            })}
            style={styles.mapControl}>
            <Text style={styles.mapControlText}>+</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
            onPress={() => mapRef.current?.getCamera().then((camera) => {
              mapRef.current?.animateCamera({ ...camera, zoom: Math.max(1, (camera.zoom ?? 12) - 1) });
            })}
            style={styles.mapControl}>
            <Text style={styles.mapControlText}>−</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={recenter} style={styles.recenter}>
          <Text style={styles.recenterIcon}>⌾</Text>
          <Text style={styles.recenterText}>Recenter</Text>
        </Pressable>
      </View>

      {locationError ? <Text style={styles.error}>{locationError}</Text> : null}
      <View style={styles.bottomBar}>
        <Text style={styles.addressPreview} numberOfLines={2}>
          {address || (location ? 'Pinned location' : 'Tap the map or search for your shop')}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={!location}
          onPress={confirmLocation}
          style={[styles.confirmButton, !location && styles.confirmDisabled]}>
          <Text style={styles.confirmText}>Confirm Location</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    zIndex: 5,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  cancel: {
    minWidth: 56,
    paddingVertical: spacing.sm,
  },
  cancelText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  searchWrap: {
    flex: 1,
    minHeight: spacing.input,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: spacing.input - 2,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
  },
  predictions: {
    position: 'absolute',
    top: spacing.input + 4,
    left: 0,
    right: 0,
    zIndex: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  prediction: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  predictionMain: {
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
  },
  predictionSecondary: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
  },
  mapHost: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    backgroundColor: colors.mapFill,
  },
  mapViewport: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    gap: spacing.xs,
  },
  mapControl: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapControlText: {
    color: colors.heading,
    fontSize: 24,
    lineHeight: 26,
  },
  recenter: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recenterIcon: {
    color: colors.primary,
    fontSize: 18,
  },
  recenterText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    fontWeight: typography.weights.medium,
  },
  mapErrorOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.overlayMapLabel,
  },
  mapErrorText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    textAlign: 'center',
  },
  mapRetry: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 9999,
    backgroundColor: colors.primary,
  },
  mapRetryText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    fontWeight: typography.weights.semibold,
  },
  error: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
    color: colors.error,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
  },
  bottomBar: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addressPreview: {
    minHeight: 20,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
  },
  confirmButton: {
    height: spacing.input,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  confirmDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
});
