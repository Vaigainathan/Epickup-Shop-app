import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { getAuth } from '@react-native-firebase/auth';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/constants/theme';
import {
  fetchPlaceAutocomplete,
  fetchPlaceDetails,
  PlacePrediction,
  saveShopBusinessDetails,
} from '@/lib/auth-api';
import { getSessionToken } from '@/lib/session';

const logo = require('@/assets/images/login/logo.png');
const blobBottom = require('@/assets/images/login/blob-bottom.png');

const SHOP_TYPES = [
  'Food & Restaurants',
  'Grocery & Supermarket',
  'Meat & Seafood',
  'Fashion & Clothing',
  'Electronics & Electrical',
  'Home & Kitchen',
  'Hardware & Tools',
  'Beauty & Personal Care',
  'Sports & Fitness',
  'Books & Stationery',
  'Automotive',
  'Baby & Kids',
  'Pet Supplies',
  'Gifts, Flowers & Accessories',
  'Other / General Retail',
] as const;

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

export default function SignUpBusinessDetailsScreen() {
  const { message } = useLocalSearchParams<{ message?: string }>();
  const routeMessage =
    typeof message === 'string' ? message : Array.isArray(message) ? message[0] : null;
  const [shopName, setShopName] = useState('');
  const [shopType, setShopType] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [locationActive, setLocationActive] = useState(false);
  const [search, setSearch] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapVersion, setMapVersion] = useState(0);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locationSectionY, setLocationSectionY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const mapRef = useRef<MapView>(null);
  const searchRequestId = useRef(0);

  const verifiedPhone = getAuth().currentUser?.phoneNumber ?? 'Verified mobile number';
  const canSubmit = Boolean(shopName.trim() && shopType && location && !submitting);
  const selectedLocationRegion = useMemo<Region>(
    () => ({
      ...(location ?? INDIA_REGION),
      latitudeDelta: location ? 0.02 : INDIA_REGION.latitudeDelta,
      longitudeDelta: location ? 0.02 : INDIA_REGION.longitudeDelta,
    }),
    [location],
  );

  useEffect(() => {
    const requestId = ++searchRequestId.current;
    if (!locationActive || search.trim().length < 2) return;

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
        if (requestId === searchRequestId.current) {
          setPredictions(nextPredictions);
        }
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
  }, [locationActive, search]);

  useEffect(() => {
    if (mapReady) return;

    const timer = setTimeout(() => {
      setMapError('The map could not be loaded. Check your connection or Maps configuration.');
    }, 10000);

    return () => clearTimeout(timer);
  }, [mapReady, mapVersion]);

  async function reverseGeocode(coordinate: Coordinate, fallbackAddress?: string | null) {
    try {
      const results = await Location.reverseGeocodeAsync(coordinate);
      const nextAddress = results[0] ? formatAddress(results[0]) : '';
      setAddress(nextAddress || fallbackAddress || '');
    } catch {
      setAddress(fallbackAddress || '');
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

  async function submit() {
    if (!canSubmit || !location) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Your session expired. Please verify your phone again.');

      await saveShopBusinessDetails(
        {
          shopName: shopName.trim(),
          shopType,
          address,
          location: {
            lat: location.latitude,
            lng: location.longitude,
          },
        },
        token,
      );
      router.replace('/(auth)/sign-up/documents');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not save your details.');
    } finally {
      setSubmitting(false);
    }
  }

  function focusLocation() {
    setLocationActive(true);
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, locationSectionY - spacing.md),
        animated: true,
      });
    }, 0);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Image source={blobBottom} style={styles.blobBottom} contentFit="contain" pointerEvents="none" />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          disabled={submitting}
          onPress={() => router.back()}
          style={styles.headerButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerBrand}>
          <Image source={logo} style={styles.headerLogo} contentFit="contain" />
          <Text style={styles.headerTitle}>Sign Up</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.progress}>
            <View style={styles.progressLine} />
            {(['1', '2', '3'] as const).map((step, index) => {
              const active = index === 0;
              const label = ['Business', 'Documents', 'Review'][index];
              return (
                <View key={step} style={styles.progressStep}>
                  <View style={[styles.progressCircle, active && styles.progressCircleActive]}>
                    <Text style={[styles.progressNumber, active && styles.progressNumberActive]}>
                      {step}
                    </Text>
                  </View>
                  <Text style={[styles.progressLabel, active && styles.progressLabelActive]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Let&apos;s set up your shop</Text>
            <Text style={styles.heroBody}>
              Provide your official business information to start receiving and managing pickup
              orders.
            </Text>
          </View>

          {routeMessage ? <Text style={styles.routeMessage}>{routeMessage}</Text> : null}

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Shop Name</Text>
              <TextInput
                value={shopName}
                onChangeText={(value) => {
                  setShopName(value);
                  setSubmitError(null);
                }}
                placeholder="Enter your shop name"
                placeholderTextColor={colors.textMuted}
                editable={!submitting}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Business Category</Text>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => setTypeModalVisible(true)}
                style={styles.select}>
                <Text style={[styles.selectText, !shopType && styles.placeholder]}>
                  {shopType || 'Select Business Type'}
                </Text>
                <Text style={styles.chevron}>⌄</Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.phoneDisplay}>
                <Text style={styles.phoneText}>{verifiedPhone}</Text>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Registered Address</Text>
              <View style={styles.addressBox}>
                <Text style={[styles.addressText, !address && styles.placeholder]}>
                  {address || 'Address will be filled after you pin your location'}
                </Text>
              </View>
            </View>

            <View
              onLayout={(event) => setLocationSectionY(event.nativeEvent.layout.y)}
              style={styles.locationSection}>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={focusLocation}
                style={styles.pinButton}>
                <Text style={styles.pinIcon}>⌖</Text>
                <Text style={styles.pinButtonText}>Pin Location on Map</Text>
              </Pressable>

              {locationActive ? (
                <View style={styles.searchWrap}>
                  <TextInput
                    value={search}
                    onChangeText={(value) => {
                      setSearch(value);
                      if (value.trim().length < 2) {
                        setPredictions([]);
                        setSearching(false);
                        setSearchError(null);
                      }
                    }}
                    placeholder="Search for your shop location"
                    placeholderTextColor={colors.textMuted}
                    editable={!submitting}
                    style={styles.searchInput}
                  />
                  {searching ? <ActivityIndicator color={colors.primary} size="small" /> : null}
                  {predictions.length > 0 ? (
                    <View style={styles.predictions}>
                      {predictions.map((prediction) => (
                        <Pressable
                          key={prediction.placeId}
                          disabled={submitting}
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
              ) : null}

              {searchError ? <Text style={styles.locationError}>{searchError}</Text> : null}
              {locationError ? <Text style={styles.locationError}>{locationError}</Text> : null}

              <View style={styles.mapCard}>
                <MapView
                  key={`map-${mapVersion}`}
                  ref={mapRef}
                  initialRegion={selectedLocationRegion}
                  onMapReady={() => {
                    setMapReady(true);
                    setMapError(null);
                  }}
                  onPress={(event) => applyCoordinate(event.nativeEvent.coordinate)}
                  style={styles.map}>
                  {location ? (
                    <Marker
                      coordinate={location}
                      draggable
                      title="Shop Location"
                      onDragEnd={(event) => applyCoordinate(event.nativeEvent.coordinate)}
                    />
                  ) : null}
                </MapView>

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
                <View style={styles.attribution}>
                  <Text style={styles.attributionText}>Google Maps</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.trust}>
            <Text style={styles.trustIcon}>♢</Text>
            <Text style={styles.trustText}>
              Your data is encrypted. We only use this information to verify your business
              identity for legal compliance.
            </Text>
          </View>

          {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={submit}
            style={({ pressed }) => [
              styles.continueButton,
              !canSubmit && styles.continueDisabled,
              pressed && canSubmit && styles.pressed,
            ]}>
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.continueText}>Continue</Text>
                <Text style={styles.continueArrow}>→</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={typeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTypeModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTypeModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Business Type</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {SHOP_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => {
                    setShopType(type);
                    setTypeModalVisible(false);
                    setSubmitError(null);
                  }}
                  style={[styles.option, type === shopType && styles.optionSelected]}>
                  <Text style={[styles.optionText, type === shopType && styles.optionTextSelected]}>
                    {type}
                  </Text>
                  {type === shopType ? <Text style={styles.optionCheck}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
    backgroundColor: colors.overlayHeader,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.tintSoft,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: colors.heading,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: typography.weights.regular,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerLogo: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
  },
  blobBottom: {
    position: 'absolute',
    right: -128,
    bottom: 100,
    width: 320,
    height: 320,
    opacity: 0.3,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  progress: {
    height: 100,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    position: 'relative',
  },
  progressLine: {
    position: 'absolute',
    top: 40,
    left: spacing.screen,
    right: spacing.screen,
    height: 2,
    backgroundColor: colors.stepperTrack,
  },
  progressStep: {
    alignItems: 'center',
    gap: spacing.xs,
    zIndex: 1,
  },
  progressCircle: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.stepperTrack,
  },
  progressCircleActive: {
    backgroundColor: colors.primary,
  },
  progressNumber: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
  },
  progressNumberActive: {
    color: colors.white,
  },
  progressLabel: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
  },
  progressLabelActive: {
    color: colors.primary,
  },
  hero: {
    marginHorizontal: spacing.screen,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.hero,
    overflow: 'hidden',
  },
  heroTitle: {
    color: colors.heroText,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
  },
  heroBody: {
    marginTop: spacing.sm,
    color: colors.overlayHeroText,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  routeMessage: {
    marginHorizontal: spacing.screen,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  form: {
    gap: spacing.lg,
  },
  field: {
    marginHorizontal: spacing.screen,
    gap: spacing.xs,
  },
  label: {
    marginLeft: spacing.xs,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
  },
  input: {
    height: spacing.input,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
  },
  select: {
    height: spacing.input,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectText: {
    flex: 1,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
  },
  placeholder: {
    color: colors.textMuted,
  },
  chevron: {
    color: colors.heading,
    fontSize: 22,
    lineHeight: 22,
  },
  phoneDisplay: {
    height: spacing.input,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.tintSoft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    flex: 1,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
  },
  verifiedText: {
    color: colors.success,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    fontWeight: typography.weights.semibold,
  },
  addressBox: {
    minHeight: 104,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  addressText: {
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
  },
  locationSection: {
    marginHorizontal: spacing.screen,
    gap: spacing.md,
  },
  pinButton: {
    height: spacing.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.tintSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pinIcon: {
    color: colors.primary,
    fontSize: 22,
  },
  pinButtonText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.button,
  },
  searchWrap: {
    position: 'relative',
    minHeight: spacing.input,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
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
    zIndex: 5,
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
  locationError: {
    color: colors.error,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
  },
  mapCard: {
    height: 172,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.mapFill,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  mapControls: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    gap: spacing.xs,
  },
  mapControl: {
    width: 32,
    height: 32,
    borderRadius: 4,
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
    fontSize: 22,
    lineHeight: 24,
  },
  recenter: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    height: 32,
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
    fontSize: 17,
  },
  recenterText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    fontWeight: typography.weights.medium,
  },
  attribution: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    padding: spacing.xs,
    borderRadius: 4,
    backgroundColor: colors.overlayMapLabel,
  },
  attributionText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.caption,
  },
  mapErrorOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
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
  trust: {
    minHeight: 80,
    marginHorizontal: spacing.screen,
    marginTop: spacing.section,
    padding: spacing.md,
    borderRadius: 12,
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.overlayTrust,
  },
  trustIcon: {
    color: colors.success,
    fontSize: 20,
  },
  trustText: {
    flex: 1,
    color: colors.success,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
  },
  submitError: {
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
    color: colors.error,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    textAlign: 'center',
  },
  continueButton: {
    height: spacing.input,
    marginHorizontal: spacing.screen,
    marginTop: spacing.section,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  continueDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
  },
  continueText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  continueArrow: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 22,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  modalCard: {
    maxHeight: '80%',
    padding: spacing.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginBottom: spacing.md,
    borderRadius: 9999,
    backgroundColor: colors.border,
  },
  modalTitle: {
    marginBottom: spacing.md,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    fontWeight: typography.weights.semibold,
  },
  option: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.tintSoft,
  },
  optionText: {
    flex: 1,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  optionCheck: {
    color: colors.success,
    fontSize: 18,
    fontWeight: typography.weights.bold,
  },
});
