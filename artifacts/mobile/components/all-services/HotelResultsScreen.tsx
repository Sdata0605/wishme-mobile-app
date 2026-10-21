import React, { useEffect, useMemo, useState } from 'react';
import { clearOptionSet, setOptionSet } from '@/services/assistant/bridge';
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Coffee,
  Filter,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  Star,
  Wifi,
  X,
  Camera,
} from 'lucide-react-native';
import { HOTELS, type Hotel, type HotelSearchParams } from './hotelData';
import { hotelGallery } from './hotelImages';

import { serviceColors as C } from './serviceColors';
import { T, useThemedStyles, glass } from './themed';
import { BrandFill } from './BrandFill';

type FilterCat = 'popular' | 'price' | 'rating' | 'stars' | 'type' | 'amenities';

interface HotelFilters {
  freeCancel: boolean;
  breakfast: boolean;
  maxPrice: number;
  minRating: number;
  stars: number[];
  types: string[];
  amenities: string[];
}

const DEFAULT_FILTERS: HotelFilters = {
  freeCancel: false,
  breakfast: false,
  maxPrice: 9000,
  minRating: 0,
  stars: [],
  types: [],
  amenities: [],
};

const PRICE_STEPS = [2000, 3500, 5000, 7000, 9000];
const AMENITY_OPTS = ['Wi-Fi', 'Pool', 'Spa', 'Breakfast', 'Parking', 'Gym', 'Restaurant', 'AC'];
const TYPE_OPTS = ['Hotel', 'Resort', 'Homestay', 'Apartment'];

function countFilters(f: HotelFilters) {
  let n = 0;
  if (f.freeCancel) n += 1;
  if (f.breakfast) n += 1;
  if (f.maxPrice < 9000) n += 1;
  if (f.minRating > 0) n += 1;
  n += f.stars.length + f.types.length + f.amenities.length;
  return n;
}

function applyFilters(list: Hotel[], f: HotelFilters, city: string) {
  return list.filter((h) => {
    if (city && h.city.toLowerCase() !== city.toLowerCase() && city !== 'All') {
      // Still show some results for demo cities without exact matches
      const hasCityHotels = list.some((x) => x.city.toLowerCase() === city.toLowerCase());
      if (hasCityHotels && h.city.toLowerCase() !== city.toLowerCase()) return false;
    }
    if (h.price > f.maxPrice) return false;
    if (f.freeCancel && !h.freeCancel) return false;
    if (f.breakfast && !h.breakfast) return false;
    if (f.minRating > 0 && h.rating < f.minRating) return false;
    if (f.stars.length && !f.stars.includes(h.stars)) return false;
    if (f.types.length && !f.types.includes(h.propertyType)) return false;
    if (f.amenities.length && !f.amenities.every((a) => h.amenities.includes(a))) return false;
    return true;
  });
}

function Checkbox({
  checked,
  label,
  right,
  onToggle,
}: {
  checked: boolean;
  label: string;
  right?: string;
  onToggle: () => void;
}) {
  const ch = use_ch();
  return (
    <TouchableOpacity style={ch.row} onPress={onToggle} activeOpacity={0.75}>
      <View style={[ch.box, checked && ch.boxOn]}>
        {checked && <Check size={11} color={T(C.white, 'fg')} />}
      </View>
      <Text style={ch.label}>{label}</Text>
      {!!right && <Text style={ch.right}>{right}</Text>}
    </TouchableOpacity>
  );
}

const make_ch = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: T(C.border, 'border'),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T(C.white, 'bg'),
  },
  boxOn: { backgroundColor: T(C.green, 'bg'), borderColor: T(C.green, 'border') },
  label: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  right: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg') },
});
const use_ch = () => useThemedStyles(make_ch);

function FiltersModal({
  visible,
  value,
  onClose,
  onApply,
}: {
  visible: boolean;
  value: HotelFilters;
  onClose: () => void;
  onApply: (f: HotelFilters) => void;
}) {
  const fm = use_fm();
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState(value);
  const [tab, setTab] = useState<FilterCat>('popular');

  React.useEffect(() => {
    if (visible) {
      setFilters(value);
      setTab('popular');
    }
  }, [visible, value]);

  const preview = applyFilters(HOTELS, filters, 'All').length;
  const tabs: { key: FilterCat; label: string }[] = [
    { key: 'popular', label: 'Popular' },
    { key: 'price', label: 'Price' },
    { key: 'rating', label: 'Rating' },
    { key: 'stars', label: 'Star' },
    { key: 'type', label: 'Type' },
    { key: 'amenities', label: 'Amenities' },
  ];

  const toggleArr = (key: 'stars' | 'types' | 'amenities', item: string | number) =>
    setFilters((f) => {
      const arr = f[key] as (string | number)[];
      const next = arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
      return { ...f, [key]: next };
    });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={fm.overlay}>
        <View style={[fm.sheet, { paddingBottom: insets.bottom + 10 }]}>
          <View style={fm.header}>
            <View>
              <Text style={fm.title}>Filters</Text>
              <Text style={fm.sub}>
                {countFilters(filters)} selected · {preview} hotels
              </Text>
            </View>
            <View style={fm.headerActions}>
              <TouchableOpacity style={fm.clear} onPress={() => setFilters(DEFAULT_FILTERS)}>
                <RotateCcw size={13} color={T(C.orange, 'fg')} />
                <Text style={fm.clearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <X size={20} color={T(C.text, 'fg')} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={fm.body}>
            <View style={fm.side}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {tabs.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[fm.sideItem, tab === t.key && fm.sideItemOn]}
                    onPress={() => setTab(t.key)}
                  >
                    <Text style={[fm.sideText, tab === t.key && fm.sideTextOn]} numberOfLines={1}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView style={fm.content} contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
              {tab === 'popular' && (
                <View style={fm.group}>
                  <Checkbox
                    checked={filters.freeCancel}
                    label="Free Cancellation"
                    onToggle={() => setFilters((f) => ({ ...f, freeCancel: !f.freeCancel }))}
                  />
                  <View style={fm.sep} />
                  <Checkbox
                    checked={filters.breakfast}
                    label="Breakfast Included"
                    onToggle={() => setFilters((f) => ({ ...f, breakfast: !f.breakfast }))}
                  />
                  <View style={fm.sep} />
                  <Checkbox
                    checked={filters.minRating >= 4.5}
                    label="Guest Rating 4.5+"
                    onToggle={() =>
                      setFilters((f) => ({
                        ...f,
                        minRating: f.minRating >= 4.5 ? 0 : 4.5,
                      }))
                    }
                  />
                </View>
              )}

              {tab === 'price' && (
                <>
                  <Text style={fm.hint}>Price per night</Text>
                  <View style={fm.priceRow}>
                    {PRICE_STEPS.map((p) => {
                      const on = filters.maxPrice === p;
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[fm.priceChip, on && fm.priceChipOn]}
                          onPress={() => setFilters((f) => ({ ...f, maxPrice: p }))}
                        >
                          <Text style={[fm.priceText, on && fm.priceTextOn]}>
                            ≤ ₹{p.toLocaleString('en-IN')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {tab === 'rating' && (
                <View style={fm.group}>
                  {[4.5, 4.0, 3.5].map((r, i) => (
                    <React.Fragment key={r}>
                      {i > 0 && <View style={fm.sep} />}
                      <Checkbox
                        checked={filters.minRating === r}
                        label={`${r}+ Guest Rating`}
                        onToggle={() =>
                          setFilters((f) => ({
                            ...f,
                            minRating: f.minRating === r ? 0 : r,
                          }))
                        }
                      />
                    </React.Fragment>
                  ))}
                </View>
              )}

              {tab === 'stars' && (
                <View style={fm.group}>
                  {[5, 4, 3].map((s, i) => (
                    <React.Fragment key={s}>
                      {i > 0 && <View style={fm.sep} />}
                      <Checkbox
                        checked={filters.stars.includes(s)}
                        label={`${s} Star`}
                        onToggle={() => toggleArr('stars', s)}
                      />
                    </React.Fragment>
                  ))}
                </View>
              )}

              {tab === 'type' && (
                <View style={fm.group}>
                  {TYPE_OPTS.map((t, i) => (
                    <React.Fragment key={t}>
                      {i > 0 && <View style={fm.sep} />}
                      <Checkbox
                        checked={filters.types.includes(t)}
                        label={t}
                        onToggle={() => toggleArr('types', t)}
                      />
                    </React.Fragment>
                  ))}
                </View>
              )}

              {tab === 'amenities' && (
                <View style={fm.group}>
                  {AMENITY_OPTS.map((a, i) => (
                    <React.Fragment key={a}>
                      {i > 0 && <View style={fm.sep} />}
                      <Checkbox
                        checked={filters.amenities.includes(a)}
                        label={a}
                        onToggle={() => toggleArr('amenities', a)}
                      />
                    </React.Fragment>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>

          <View style={fm.footer}>
            <TouchableOpacity
              style={fm.apply}
              onPress={() => {
                onApply(filters);
                onClose();
              }}
            >
              <Text style={fm.applyText}>
                Show {preview} hotel{preview === 1 ? '' : 's'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const make_fm = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T(C.white, 'bg'),
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '88%',
    paddingTop: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
  },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: T('#F5F0FF', 'bg'),
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.orange, 'fg') },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 },
  side: {
    width: 78,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: T(C.pageBg, 'bg'),
    borderRightWidth: 1,
    borderRightColor: T(C.border, 'border'),
  },
  sideItem: {
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  sideItemOn: { backgroundColor: T(C.white, 'bg'), borderLeftColor: T(C.green, 'border') },
  sideText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
  sideTextOn: { color: T(C.green, 'fg'), fontFamily: 'Inter_700Bold' },
  content: { flex: 1, minWidth: 0 },
  hint: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg'), marginBottom: 10 },
  group: {
    backgroundColor: T(C.white, 'bg'),
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 12,
    paddingHorizontal: 12,
   ...glass(18), },
  sep: { height: 1, backgroundColor: T(C.lightGray, 'bg') },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceChip: {
    borderWidth: 1.5,
    borderColor: T(C.border, 'border'),
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: T(C.white, 'bg'),
  },
  priceChipOn: { borderColor: T(C.green, 'border'), backgroundColor: T('#ECFDF5', 'bg') },
  priceText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg') },
  priceTextOn: { color: T(C.green, 'fg') },
  footer: { borderTopWidth: 1, borderTopColor: T(C.border, 'border'), paddingHorizontal: 14, paddingTop: 10 },
  apply: {
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyText: { color: T(C.white, 'fg'), fontSize: 15, fontFamily: 'Inter_700Bold' },
});
const use_fm = () => useThemedStyles(make_fm);

function HotelCard({ hotel, nights, onPress }: { hotel: Hotel; nights: number; onPress: () => void }) {
  const card = use_card();
  const discount = Math.round(((hotel.originalPrice - hotel.price) / hotel.originalPrice) * 100);
  return (
    <TouchableOpacity style={card.wrap} activeOpacity={0.88} onPress={onPress}>
      <View style={[card.image, { backgroundColor: T(hotel.tint, 'bg') }]}>
        <Image source={hotelGallery(hotel)[0]} style={card.img} resizeMode="cover" />
        <View style={card.photoCount}>
          <Camera size={11} color="#FFFFFF" />
          <Text style={card.photoCountText}>{hotelGallery(hotel).length}</Text>
        </View>
        <View style={card.starRow}>
          {Array.from({ length: hotel.stars }).map((_, i) => (
            <Star key={i} size={10} color={T('#FCD34D', 'fg')} fill={T('#FCD34D', 'fg')} />
          ))}
        </View>
        {hotel.freeCancel && (
          <View style={card.badge}>
            <Text style={card.badgeText}>Free Cancel</Text>
          </View>
        )}
      </View>

      <View style={card.body}>
        <Text style={card.name} numberOfLines={1}>
          {hotel.name}
        </Text>
        <View style={card.locRow}>
          <MapPin size={12} color={T(C.textLight, 'fg')} />
          <Text style={card.loc} numberOfLines={1}>
            {hotel.area} · {hotel.distance}
          </Text>
        </View>

        <View style={card.meta}>
          <View style={card.ratingPill}>
            <Text style={card.ratingText}>{hotel.rating}</Text>
          </View>
          <Text style={card.reviews}>{hotel.reviews} ratings</Text>
          <Text style={card.type}>{hotel.propertyType}</Text>
        </View>

        <View style={card.amenityRow}>
          {hotel.amenities.slice(0, 3).map((a) => (
            <View key={a} style={card.amenityChip}>
              {a === 'Wi-Fi' ? (
                <Wifi size={10} color={T(C.purpleLight, 'fg')} />
              ) : a === 'Breakfast' ? (
                <Coffee size={10} color={T(C.orange, 'fg')} />
              ) : null}
              <Text style={card.amenityText}>{a}</Text>
            </View>
          ))}
        </View>

        <View style={card.priceRow}>
          <View>
            <Text style={card.strike}>₹{hotel.originalPrice.toLocaleString('en-IN')}</Text>
            <Text style={card.price}>₹{hotel.price.toLocaleString('en-IN')}</Text>
            <Text style={card.per}>per night · {nights} night{nights > 1 ? 's' : ''}</Text>
          </View>
          <View style={card.rightCol}>
            {discount > 0 && (
              <Text style={card.off}>{discount}% off</Text>
            )}
            <View style={card.cta}><BrandFill />
              <Text style={card.ctaText}>View</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const make_card = () => StyleSheet.create({
  wrap: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 16,
    marginHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    overflow: 'hidden',
   ...glass(22), },
  image: { height: 140, position: 'relative' },
  img: { width: '100%', height: '100%' },
  photoCount: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  photoCountText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  starRow: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', gap: 2 },
  badge: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: T(C.green, 'bg'),
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: T(C.white, 'fg'), fontSize: 10, fontFamily: 'Inter_700Bold' },
  body: { padding: 12 },
  name: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  loc: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  ratingPill: {
    backgroundColor: T(C.green, 'bg'),
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: { color: T(C.white, 'fg'), fontSize: 11, fontFamily: 'Inter_700Bold' },
  reviews: { fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
  type: { fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.purpleLight, 'fg') },
  amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: T(C.lightGray, 'bg'),
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  amenityText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: T(C.border, 'border'),
    paddingTop: 10,
  },
  strike: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: T(C.gray, 'fg'),
    textDecorationLine: 'line-through',
  },
  price: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  per: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  rightCol: { alignItems: 'flex-end', gap: 6 },
  off: { fontSize: 11, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg') },
  cta: {
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
   overflow: 'hidden', },
  ctaText: { color: T(C.white, 'fg'), fontSize: 12, fontFamily: 'Inter_700Bold' },
});
const use_card = () => useThemedStyles(make_card);

export function HotelResultsScreen({
  search,
  onBack,
  onSelectHotel,
}: {
  search: HotelSearchParams;
  onBack: () => void;
  onSelectHotel: (hotel: Hotel) => void;
}) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [filtersVisible, setFiltersVisible] = useState(false);
  // The stay type and free-cancellation choices from the search screen start as ordinary filters, so they show and clear like any other.
  const [filters, setFilters] = useState<HotelFilters>(() => ({
    ...DEFAULT_FILTERS,
    freeCancel: !!search.freeCancelOnly,
    types: search.propertyType ? [search.propertyType] : [],
  }));
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState('Price: Low to High');

  const SORTS = ['Price: Low to High', 'Price: High to Low', 'Guest Rating', 'Stars'];

  const hotels = useMemo(() => {
    const list = applyFilters(HOTELS, filters, search.city);
    return [...list].sort((a, b) => {
      if (sort === 'Price: Low to High') return a.price - b.price;
      if (sort === 'Price: High to Low') return b.price - a.price;
      if (sort === 'Guest Rating') return b.rating - a.rating;
      if (sort === 'Stars') return b.stars - a.stars;
      return 0;
    });
  }, [filters, search.city, sort]);

  const active = countFilters(filters);

  // Let the voice assistant read out and pick from what is on screen.
  useEffect(() => {
    setOptionSet({
      kind: 'hotels',
      loading: false,
      items: hotels.map((h) => ({
        title: h.name,
        detail: `${h.area}, ${h.stars} star, rated ${h.rating}, ₹${h.price} per night${
          h.freeCancel ? ', free cancellation' : ''
        }${h.breakfast ? ', breakfast included' : ''}`,
      })),
      select: (i) => {
        const h = hotels[i];
        if (h) onSelectHotel(h);
      },
    });
    return () => clearOptionSet('hotels');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotels]);

  return (
    <View style={st.root}>
      <View style={[st.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>{search.city}</Text>
          <Text style={st.meta}>
            {search.checkIn} – {search.checkOut} · {search.rooms} Room · {search.adults} Adults
          </Text>
        </View>
        <TouchableOpacity style={st.filterBtn} onPress={() => setFiltersVisible(true)}>
          <SlidersHorizontal size={14} color={T(C.green, 'fg')} />
          <Text style={st.filterText}>Filters</Text>
          {active > 0 && (
            <View style={st.badge}>
              <Text style={st.badgeText}>{active}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={st.sortBar} onPress={() => setSortOpen(!sortOpen)}>
        <Filter size={13} color={T(C.textLight, 'fg')} />
        <Text style={st.sortLabel}>Sort: </Text>
        <Text style={st.sortValue}>{sort}</Text>
        {sortOpen ? <ChevronUp size={14} color={T(C.textLight, 'fg')} /> : <ChevronDown size={14} color={T(C.textLight, 'fg')} />}
      </TouchableOpacity>
      {sortOpen && (
        <View style={st.sortDrop}>
          {SORTS.map((s) => (
            <TouchableOpacity
              key={s}
              style={st.sortOpt}
              onPress={() => {
                setSort(s);
                setSortOpen(false);
              }}
            >
              <Text style={[st.sortOptText, sort === s && st.sortOptOn]}>{s}</Text>
              {sort === s && <Check size={14} color={T(C.green, 'fg')} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 12, paddingBottom: 30 }}>
        <Text style={st.count}>{hotels.length} hotels found</Text>
        {hotels.map((h) => (
          <HotelCard
            key={h.id}
            hotel={h}
            nights={search.nights}
            onPress={() => onSelectHotel(h)}
          />
        ))}
        {hotels.length === 0 && (
          <View style={st.empty}>
            <Text style={st.emptyTitle}>No hotels match</Text>
            <Text style={st.emptySub}>Try clearing some filters</Text>
            <TouchableOpacity style={st.emptyBtn} onPress={() => setFilters(DEFAULT_FILTERS)}><BrandFill />
              <Text style={st.emptyBtnText}>Reset Filters</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <FiltersModal
        visible={filtersVisible}
        value={filters}
        onClose={() => setFiltersVisible(false)}
        onApply={setFilters}
      />
    </View>
  );
}

const make_st = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: T(C.pageBg, 'page') },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: T(C.white, 'page'),
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'page'),
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  meta: { fontSize: 10.5, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: T(C.green, 'border'),
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: T('#ECFDF5', 'bg'),
  },
  filterText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg') },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: T(C.orange, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: T(C.white, 'fg'), fontSize: 9, fontFamily: 'Inter_700Bold' },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: T(C.white, 'bg'),
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
  },
  sortLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
  sortValue: { flex: 1, fontSize: 11, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  sortDrop: {
    backgroundColor: T(C.white, 'bg'),
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
    paddingHorizontal: 14,
  },
  sortOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T(C.lightGray, 'border'),
  },
  sortOptText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  sortOptOn: { color: T(C.green, 'fg'), fontFamily: 'Inter_700Bold' },
  count: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: T(C.textLight, 'fg'),
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  empty: {
    marginHorizontal: 14,
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    padding: 24,
    alignItems: 'center',
   ...glass(18), },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  emptySub: { fontSize: 12, color: T(C.textLight, 'fg'), marginTop: 6, marginBottom: 14 },
  emptyBtn: {
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
   overflow: 'hidden', },
  emptyBtnText: { color: T(C.white, 'fg'), fontSize: 12, fontFamily: 'Inter_700Bold' },
});
const use_st = () => useThemedStyles(make_st);
