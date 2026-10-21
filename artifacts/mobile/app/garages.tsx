import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Bike, ChevronRight, MapPin, Navigation, Phone, RefreshCw, Search, Wrench, X } from 'lucide-react-native';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { useTheme } from '@/context/ThemeContext';
import { nearbyGarages, type Garage, type GarageResult } from '@/services/insurance/garages';

const open = (url: string) => void Linking.openURL(url).catch(() => {});
const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`);

/** Every repair garage around the user (OpenStreetMap), searchable, with directions. */
export default function GaragesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [state, setState] = useState<GarageResult | { status: 'loading' }>({ status: 'loading' });
  const [query, setQuery] = useState('');

  const load = useCallback(async (ask: boolean) => {
    setState({ status: 'loading' });
    setState(await nearbyGarages(ask));
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const list = state.status === 'ok' ? state.garages : [];
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? list.filter((g) => `${g.name} ${g.fullAddress} ${g.area}`.toLowerCase().includes(q)) : list),
    [list, q],
  );
  const mapsSearch =
    state.status === 'ok'
      ? `https://www.google.com/maps/search/${encodeURIComponent(q || 'car repair')}/@${state.lat},${state.lon},13z`
      : 'https://www.google.com/maps/search/car+repair+near+me';

  const hi = { color: colors.foreground };
  const lo = { color: colors.mutedForeground };
  const field = { backgroundColor: colors.card, borderColor: colors.border };

  const renderItem = ({ item: g }: { item: Garage }) => (
    <View style={[st.row, { borderBottomColor: colors.border }]}>
      <View style={st.rowTop}>
        <View style={[st.badge, { borderColor: colors.primary + '66', backgroundColor: colors.primary + '1F' }]}>
          {g.kind === 'bike' ? <Bike size={20} color={colors.primary} /> : <Wrench size={20} color={colors.primary} />}
        </View>
        <Text style={[st.name, hi]} numberOfLines={2}>{g.name.toUpperCase()}</Text>
        <View style={[st.tag, { backgroundColor: colors.primary + '26' }]}>
          <Text style={[st.tagText, { color: colors.primary }]}>{g.dealer ? 'Dealership' : g.kind === 'bike' ? 'Bike repair' : 'Car repair'}</Text>
        </View>
      </View>
      <View style={st.rowBody}>
        <View style={{ flex: 1 }}>
          <View style={st.meta}>
            <MapPin size={15} color={colors.mutedForeground} />
            <Text style={[st.metaText, lo]}>{fmtKm(g.km)}</Text>
            {!!g.area && (
              <>
                <Text style={[st.metaText, lo]}>|</Text>
                <Text style={[st.metaText, lo, { flexShrink: 1 }]} numberOfLines={1}>{g.area}</Text>
              </>
            )}
          </View>
          <Text style={[st.addr, lo]}>
            <Text style={[st.addrLabel, hi]}>Address: </Text>
            {g.fullAddress || 'Not listed — tap directions to see it on the map'}
          </Text>
          {!!g.phone && (
            <TouchableOpacity style={st.meta} onPress={() => open(`tel:${g.phone!.replace(/[^\d+]/g, '')}`)}>
              <Phone size={14} color={colors.primary} />
              <Text style={[st.metaText, { color: colors.primary }]}>{g.phone}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[st.dir, { backgroundColor: colors.primary + '26' }]}
          onPress={() => open(`https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lon}`)}
          accessibilityLabel={`Directions to ${g.name}`}
        >
          <Navigation size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <AmbientBackground>
      <View style={[st.root, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[st.title, hi]}>Showing garages near</Text>

        <TouchableOpacity style={[st.field, field]} activeOpacity={0.85} onPress={() => void load(true)}>
          <MapPin size={20} color={colors.primary} />
          <Text style={[st.fieldText, hi]} numberOfLines={1}>
            {state.status === 'ok' ? state.place || 'Your current location' : state.status === 'loading' ? 'Locating…' : 'Location unavailable'}
          </Text>
          {state.status === 'loading' ? <ActivityIndicator size="small" color={colors.primary} /> : <RefreshCw size={18} color={colors.mutedForeground} />}
        </TouchableOpacity>

        <View style={[st.field, field]}>
          <Search size={20} color={colors.mutedForeground} />
          <TextInput
            style={[st.fieldText, st.input, hi]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search nearby garages"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
              <X size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {state.status === 'loading' ? (
          <View style={st.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[st.note, lo]}>Finding garages near you… this can take up to half a minute.</Text>
          </View>
        ) : state.status === 'no-permission' ? (
          <View style={st.center}>
            <Text style={[st.note, lo]}>Allow location to see garages around you.</Text>
            <TouchableOpacity
              style={[st.btn, { backgroundColor: colors.primary }]}
              onPress={() => (state.canAsk ? void load(true) : void Linking.openSettings())}
            >
              <Text style={st.btnText}>{state.canAsk ? 'Use my location' : 'Open settings'}</Text>
            </TouchableOpacity>
          </View>
        ) : state.status === 'error' ? (
          <View style={st.center}>
            <Text style={[st.note, lo]}>Couldn't load nearby garages right now.</Text>
            <TouchableOpacity style={[st.btn, { backgroundColor: colors.primary }]} onPress={() => void load(false)}>
              <Text style={st.btnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            style={{ flex: 1, marginTop: 8 }}
            data={shown}
            keyExtractor={(g) => g.id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListEmptyComponent={
              <Text style={[st.note, lo, { marginTop: 32 }]}>
                {q ? 'No garages match your search.' : 'No garages are listed within 15 km yet.'}
              </Text>
            }
            ListFooterComponent={
              <View style={{ marginTop: 16, gap: 8 }}>
                <TouchableOpacity style={[st.mapsRow, field]} onPress={() => open(mapsSearch)} activeOpacity={0.85}>
                  <Search size={18} color={colors.primary} />
                  <Text style={[st.mapsText, hi]}>{q ? `Search "${query.trim()}" in Maps` : 'See more garages in Maps'}</Text>
                  <ChevronRight size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
                {list.length > 0 && <Text style={[st.osm, lo]}>Garage data © OpenStreetMap contributors</Text>}
              </View>
            }
          />
        )}

        <TouchableOpacity
          style={[st.cta, { backgroundColor: colors.primary, marginBottom: insets.bottom + 12 }]}
          activeOpacity={0.85}
          onPress={() => router.push('/vehicle-number')}
        >
          <Text style={st.ctaText}>Check price</Text>
        </TouchableOpacity>
      </View>
    </AmbientBackground>
  );
}

const R = 12;
const st = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', marginTop: 18, marginBottom: 14 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, paddingHorizontal: 14, borderRadius: R, borderWidth: 1, marginBottom: 10 },
  fieldText: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  input: { fontFamily: 'Inter_400Regular' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  note: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  btn: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  btnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  row: { paddingVertical: 18, borderBottomWidth: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 15, fontFamily: 'Inter_700Bold' },
  tag: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  tagText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  rowBody: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  metaText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  addr: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  addrLabel: { fontFamily: 'Inter_700Bold' },
  dir: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  mapsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: R, borderWidth: 1 },
  mapsText: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  osm: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  cta: { height: 54, borderRadius: R, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
});
