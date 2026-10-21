import { SheetBackdrop } from '@/components/SheetBackdrop';
import React, { useEffect, useRef, useState } from 'react';
import { useAgentPrefill } from '@/context/AgentStateContext';
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleQuestionMark,
  Headphones,
  Info,
  MapPin,
  Minus,
  Moon,
  Plus,
  ShieldCheck,
  Star,
  Tag,
  CalendarX,
  X,
  Zap,
  TreePalm,
  House,
  Building,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { HOTEL_CITIES, HOTELS, type Hotel, type HotelSearchParams } from './hotelData';
import { HOTEL_PHOTOS, hotelGallery } from './hotelImages';
import { serviceColors as C } from './serviceColors';
import { T, useThemedStyles, glass, dk, N, glassSheet } from './themed';
import { BrandFill } from './BrandFill';
import { P } from './bookingTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');



function formatDate(d: Date) {
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function nextDays(count: number) {
  const out: Date[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push(d);
  }
  return out;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function nightsBetween(a: Date, b: Date) {
  const start = new Date(a);
  const end = new Date(b);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function CityPicker({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (city: string) => void;
  onClose: () => void;
}) {
  const md = use_md();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={md.backdrop}>
        <SheetBackdrop onPress={onClose} />
        <View style={md.sheet}>
          <View style={md.head}>
            <Text style={md.title}>Where are you going?</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={T(C.text, 'fg')} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {HOTEL_CITIES.map((city) => (
              <TouchableOpacity
                key={city}
                style={md.row}
                onPress={() => {
                  onSelect(city);
                  onClose();
                }}
              >
                <View style={md.icon}>
                  <MapPin size={16} color={T(P.purple, 'fg')} />
                </View>
                <Text style={md.city}>{city}</Text>
                {selected === city && <Check size={18} color={T(P.purple, 'fg')} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DatePicker({
  visible,
  title,
  selected,
  minDate,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  selected: Date;
  minDate?: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}) {
  const md = use_md();
  const days = nextDays(21).filter((d) => !minDate || d >= new Date(minDate.setHours(0, 0, 0, 0)));
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={md.backdrop}>
        <SheetBackdrop onPress={onClose} />
        <View style={md.sheet}>
          <View style={md.head}>
            <Text style={md.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={T(C.text, 'fg')} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {days.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={md.row}
                onPress={() => {
                  onSelect(d);
                  onClose();
                }}
              >
                <View style={[md.icon, { backgroundColor: T('#F5F3FF', 'bg') }]}>
                  <Calendar size={16} color={T(C.purpleLight, 'fg')} />
                </View>
                <Text style={md.city}>{formatDate(d)}</Text>
                {sameDay(selected, d) && <Check size={18} color={T(P.purple, 'fg')} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const make_md = () => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  sheet: {
    ...glassSheet(),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: T(C.lightGray, 'border'),
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: T(P.lavenderIcon, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  city: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
});
const use_md = () => useThemedStyles(make_md);

function Counter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const ct = use_ct();
  return (
    <View style={ct.row}>
      <Text style={ct.label}>{label}</Text>
      <View style={ct.controls}>
        <TouchableOpacity
          style={[ct.btn, value <= min && ct.btnDisabled]}
          disabled={value <= min}
          onPress={() => onChange(value - 1)}
        >
          <Minus size={14} color={value <= min ? T(C.gray, 'fg') : T(C.text, 'fg')} />
        </TouchableOpacity>
        <Text style={ct.value}>{value}</Text>
        <TouchableOpacity
          style={[ct.btn, value >= max && ct.btnDisabled]}
          disabled={value >= max}
          onPress={() => onChange(value + 1)}
        >
          <Plus size={14} color={value >= max ? T(C.gray, 'fg') : T(C.text, 'fg')} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const make_ct = () => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  label: { fontSize: 14, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T(C.white, 'bg'),
  },
  btnDisabled: { backgroundColor: T(C.lightGray, 'bg') },
  value: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), minWidth: 18, textAlign: 'center' },
});
const use_ct = () => useThemedStyles(make_ct);

function GuestsModal({
  visible,
  rooms,
  adults,
  children,
  onSave,
  onClose,
}: {
  visible: boolean;
  rooms: number;
  adults: number;
  children: number;
  onSave: (rooms: number, adults: number, children: number) => void;
  onClose: () => void;
}) {
  const md = use_md(); const guest = use_guest();
  const [r, setR] = useState(rooms);
  const [a, setA] = useState(adults);
  const [c, setC] = useState(children);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={md.backdrop}>
        <SheetBackdrop onPress={onClose} />
        <View style={md.sheet}>
          <View style={md.head}>
            <Text style={md.title}>Rooms & Guests</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={T(C.text, 'fg')} />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
            <Counter label="Rooms" value={r} min={1} max={5} onChange={setR} />
            <Counter label="Adults" value={a} min={1} max={10} onChange={setA} />
            <Counter label="Children" value={c} min={0} max={6} onChange={setC} />
            <TouchableOpacity
              style={guest.apply}
              onPress={() => {
                onSave(r, a, c);
                onClose();
              }}
            >
              <Text style={guest.applyText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const make_guest = () => StyleSheet.create({
  apply: {
    backgroundColor: T(P.purple, 'bg'),
    borderRadius: 22,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  applyText: { color: T(C.white, 'fg'), fontSize: 15, fontFamily: 'Inter_700Bold' },
});
const use_guest = () => useThemedStyles(make_guest);

type StayType = 'any' | Hotel['propertyType'];

const STAY_TYPES: { key: StayType; label: string }[] = [
  { key: 'any', label: 'Any' },
  { key: 'Hotel', label: 'Hotels' },
  { key: 'Resort', label: 'Resorts' },
  { key: 'Homestay', label: 'Homestays' },
  { key: 'Apartment', label: 'Apartments' },
];

/** A city or stay type picked further down the page, put into the form; `n` changes on every tap. */
interface FormPreset {
  city?: string;
  type?: StayType;
  n: number;
}

function shortDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function dayYear(d: Date) {
  return `${d.toLocaleDateString('en-IN', { weekday: 'short' })}, ${d.getFullYear()}`;
}

function SearchCard({
  onSearch,
  preset,
}: {
  onSearch: (params: HotelSearchParams) => void;
  preset: FormPreset | null;
}) {
  const sc = use_sc();
  const agentPrefill = useAgentPrefill();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const [city, setCity] = useState(agentPrefill.hotelCity || 'Goa');
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [rooms, setRooms] = useState(agentPrefill.rooms || 1);
  const [adults, setAdults] = useState(agentPrefill.adults || 2);
  const [children, setChildren] = useState(0);
  const [stayType, setStayType] = useState<StayType>('any');
  const [freeCancelOnly, setFreeCancelOnly] = useState(false);
  const [picker, setPicker] = useState<'city' | 'in' | 'out' | 'guests' | null>(null);

  // Sync with agent prefill
  useEffect(() => {
    if (agentPrefill.hotelCity) {
      setCity(agentPrefill.hotelCity);
    }
    if (agentPrefill.rooms) {
      setRooms(agentPrefill.rooms);
    }
    if (agentPrefill.adults) {
      setAdults(agentPrefill.adults);
    }
  }, [agentPrefill.hotelCity, agentPrefill.rooms, agentPrefill.adults]);

  useEffect(() => {
    if (!preset) return;
    if (preset.city) setCity(preset.city);
    if (preset.type) setStayType(preset.type);
  }, [preset?.n]);

  const nights = nightsBetween(new Date(checkIn), new Date(checkOut));
  const guests = adults + children;

  return (
    <View style={sc.wrap}>
      {/* Destination */}
      <TouchableOpacity style={[sc.box, sc.row]} onPress={() => setPicker('city')} activeOpacity={0.75}>
        <View style={{ flex: 1 }}>
          <Text style={sc.label}>CITY, AREA OR PROPERTY</Text>
          <Text style={sc.big} numberOfLines={1}>{city}</Text>
          <Text style={sc.sub}>India</Text>
        </View>
        <MapPin size={18} color={T(P.purpleSoft, 'fg')} />
      </TouchableOpacity>

      {/* Dates */}
      <View style={sc.pairRow}>
        <TouchableOpacity style={[sc.box, sc.half]} onPress={() => setPicker('in')} activeOpacity={0.75}>
          <Text style={sc.label}>CHECK-IN</Text>
          <Text style={sc.line} numberOfLines={1}>
            <Text style={sc.big}>{shortDate(checkIn)}</Text>
            <Text style={sc.light}>  {dayYear(checkIn)}</Text>
          </Text>
          <Text style={sc.sub}>From 12:00 PM</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[sc.box, sc.half, sc.halfRight]} onPress={() => setPicker('out')} activeOpacity={0.75}>
          <Text style={sc.label}>CHECK-OUT</Text>
          <Text style={sc.line} numberOfLines={1}>
            <Text style={sc.big}>{shortDate(checkOut)}</Text>
            <Text style={sc.light}>  {dayYear(checkOut)}</Text>
          </Text>
          <Text style={sc.sub}>Until 11:00 AM</Text>
        </TouchableOpacity>
        <View style={sc.nightsPill} pointerEvents="none">
          <Moon size={10} color={T(P.purple, 'fg')} />
          <Text style={sc.nightsText}>{nights}N</Text>
        </View>
      </View>

      {/* Rooms & guests */}
      <TouchableOpacity style={[sc.box, sc.row, { marginTop: 8 }]} onPress={() => setPicker('guests')} activeOpacity={0.75}>
        <View style={{ flex: 1 }}>
          <Text style={sc.label}>ROOMS & GUESTS</Text>
          <Text style={sc.line} numberOfLines={1}>
            <Text style={sc.big}>{rooms}</Text>
            <Text style={sc.medium}> Room{rooms > 1 ? 's' : ''}, </Text>
            <Text style={sc.big}>{guests}</Text>
            <Text style={sc.medium}> Guest{guests > 1 ? 's' : ''}</Text>
          </Text>
          <Text style={sc.sub}>
            {adults} Adult{adults > 1 ? 's' : ''}
            {children > 0 ? ` · ${children} Child${children > 1 ? 'ren' : ''}` : ''}
          </Text>
        </View>
        <ChevronRight size={18} color={T(P.purple, 'fg')} />
      </TouchableOpacity>

      {/* Stay type */}
      <Text style={sc.sectionLabel}>STAY TYPE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sc.chips} style={sc.chipScroller}>
        {STAY_TYPES.map((t) => {
          const active = stayType === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[sc.chip, active && sc.chipActive]}
              activeOpacity={0.8}
              onPress={() => setStayType(t.key)}
            >
              {active && <Check size={12} color={T(P.purple, 'fg')} strokeWidth={3} />}
              <Text style={[sc.chipText, active && sc.chipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Free cancellation */}
      <TouchableOpacity
        style={sc.option}
        activeOpacity={0.8}
        onPress={() => setFreeCancelOnly(!freeCancelOnly)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: freeCancelOnly }}
      >
        <View style={[sc.checkbox, freeCancelOnly && sc.checkboxOn]}>
          {freeCancelOnly && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={sc.optionTitle}>Free cancellation only</Text>
          <Text style={sc.optionSub}>Show stays you can cancel for free before check-in.</Text>
        </View>
        <View style={sc.optionArt} pointerEvents="none">
          <CalendarX size={18} color={T(P.purple, 'fg')} />
        </View>
      </TouchableOpacity>

      {/* Consent */}
      <View style={sc.consent}>
        <Info size={14} color={T(C.textLight, 'fg')} />
        <Text style={sc.consentText}>
          Prices are per room per night, before taxes. Cancellation rules depend on the property and the room you
          pick, and are shown before you pay.
        </Text>
      </View>

      <TouchableOpacity
        style={sc.searchBtn}
        activeOpacity={0.85}
        onPress={() =>
          onSearch({
            city,
            checkIn: formatDate(checkIn),
            checkOut: formatDate(checkOut),
            nights,
            rooms,
            adults,
            children,
            propertyType: stayType === 'any' ? undefined : stayType,
            freeCancelOnly: freeCancelOnly || undefined,
          })
        }
      >
        <LinearGradient
          pointerEvents="none"
          colors={['#8B5CF6', P.purpleDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <BrandFill />
        <View style={sc.searchArt} pointerEvents="none">
          <Building2 size={40} color="rgba(255,255,255,0.12)" />
        </View>
        <Text style={sc.searchText}>SEARCH HOTELS</Text>
        <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      <CityPicker
        visible={picker === 'city'}
        selected={city}
        onSelect={setCity}
        onClose={() => setPicker(null)}
      />
      <DatePicker
        visible={picker === 'in'}
        title="Check-in date"
        selected={checkIn}
        onSelect={(d) => {
          setCheckIn(d);
          if (d >= checkOut) {
            const next = new Date(d);
            next.setDate(d.getDate() + 1);
            setCheckOut(next);
          }
        }}
        onClose={() => setPicker(null)}
      />
      <DatePicker
        visible={picker === 'out'}
        title="Check-out date"
        selected={checkOut}
        minDate={(() => {
          const m = new Date(checkIn);
          m.setDate(m.getDate() + 1);
          return m;
        })()}
        onSelect={setCheckOut}
        onClose={() => setPicker(null)}
      />
      <GuestsModal
        visible={picker === 'guests'}
        rooms={rooms}
        adults={adults}
        children={children}
        onSave={(nr, na, nc) => {
          setRooms(nr);
          setAdults(na);
          setChildren(nc);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const make_sc = () => StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginTop: 14 },
  box: {
    backgroundColor: T(P.lavender, 'bg'),
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...glass(12),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pairRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  half: { flex: 1 },
  halfRight: { paddingLeft: 18 },
  label: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg'), letterSpacing: 0.5 },
  line: { marginTop: 3 },
  big: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginTop: 3 },
  medium: { fontSize: 14, fontFamily: 'Inter_400Regular', color: T(C.text, 'fg') },
  light: { fontSize: 12, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  nightsPill: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -22,
    marginTop: -12,
    width: 44,
    height: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: dk(N().surfaceHigh, C.white),
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
  },
  nightsText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: T(P.purple, 'fg') },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: T(C.textLight, 'fg'),
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
  },
  chipScroller: { marginHorizontal: -16 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    backgroundColor: T(P.lavender, 'bg'),
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: { borderColor: T(P.purple, 'border'), borderWidth: 1.5 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  chipTextActive: { color: T(P.purple, 'fg'), fontFamily: 'Inter_700Bold' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingLeft: 12,
    paddingRight: 58,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    backgroundColor: T(P.lavender, 'bg'),
    ...glass(12),
  },
  optionArt: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T(P.lavenderIcon, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: T('#71717A', 'border'),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T(C.white, 'bg'),
  },
  checkboxOn: { backgroundColor: T(P.purple, 'bg'), borderColor: T(P.purple, 'border') },
  optionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  optionSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  consent: { flexDirection: 'row', gap: 8, marginTop: 14, paddingHorizontal: 4 },
  consentText: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 13,
    overflow: 'hidden',
    shadowColor: P.purple,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  searchArt: { position: 'absolute', right: 16, top: 2 },
  searchText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
});
const use_sc = () => useThemedStyles(make_sc);

// ─── Popular destinations ────────────────────────────────────────────────────
const DESTINATIONS = [
  { city: 'Goa', tag: 'Beaches & resorts', photo: HOTEL_PHOTOS.beachResort },
  { city: 'Udaipur', tag: 'Lake palaces', photo: HOTEL_PHOTOS.poolNight },
  { city: 'Jaipur', tag: 'Heritage havelis', photo: HOTEL_PHOTOS.whiteResort },
  { city: 'Manali', tag: 'Mountain stays', photo: HOTEL_PHOTOS.roomMountainView },
  { city: 'Mumbai', tag: 'City hotels', photo: HOTEL_PHOTOS.cityPool },
  { city: 'Delhi', tag: 'Business & budget', photo: HOTEL_PHOTOS.roomBusiness },
];

// ─── Stay types ──────────────────────────────────────────────────────────────
const STAY_TILES: { type: StayType; title: string; sub: string; Icon: typeof Building2 }[] = [
  { type: 'Resort', title: 'Resorts', sub: 'Pools, spas & beaches', Icon: TreePalm },
  { type: 'Hotel', title: 'Hotels', sub: 'City & business stays', Icon: Building2 },
  { type: 'Homestay', title: 'Homestays', sub: 'Local hosts, cosy rooms', Icon: House },
  { type: 'Apartment', title: 'Apartments', sub: 'Space for families', Icon: Building },
];

// ─── Room styles (interiors) ─────────────────────────────────────────────────
const ROOM_STYLES = [
  { title: 'Deluxe King', sub: 'King bed · city view', photo: HOTEL_PHOTOS.roomDeluxe },
  { title: 'Heritage Suite', sub: 'Carved wood · courtyard', photo: HOTEL_PHOTOS.roomHeritage },
  { title: 'Luxury Loft', sub: 'Glass bath · lounge', photo: HOTEL_PHOTOS.roomLuxuryLoft },
  { title: 'Family Twin', sub: 'Two beds · up to 4 guests', photo: HOTEL_PHOTOS.roomFamilyTwin },
  { title: 'Valley View', sub: 'Open deck · mountain air', photo: HOTEL_PHOTOS.roomMountainView },
  { title: 'Classic Room', sub: 'Sofa lounge · work desk', photo: HOTEL_PHOTOS.roomClassic },
];

const TRUST = [
  { Icon: ShieldCheck, title: 'Verified stays', sub: 'Checked properties' },
  { Icon: Zap, title: 'Instant confirm', sub: 'Voucher on booking' },
  { Icon: Headphones, title: '24×7 support', sub: 'We are here to help' },
];

export function HotelsScreen({
  onBack,
  onSearch,
  onOpenHotel,
}: {
  onBack: () => void;
  onSearch: (params: HotelSearchParams) => void;
  /** Opens a featured hotel's page straight from this screen. */
  onOpenHotel?: (hotel: Hotel) => void;
}) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [preset, setPreset] = useState<FormPreset | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const putInForm = (p: Omit<FormPreset, 'n'>) => {
    setPreset((prev) => ({ ...p, n: (prev?.n ?? 0) + 1 }));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={st.root}>
      {/* Top bar */}
      <View style={[st.topBar, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Back">
          <ChevronLeft size={24} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/support')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Help and support"
        >
          <CircleQuestionMark size={24} color={T(C.text, 'fg')} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={st.hero}>
          <View style={st.heroIcon}>
            <LinearGradient
              pointerEvents="none"
              colors={['#8B5CF6', P.purpleDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Building2 size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.heroTitle}>Hotels</Text>
            <View style={st.poweredRow}>
              <Text style={st.poweredBy}>Powered By</Text>
              <Image source={WISHME_MARK} style={st.mark} resizeMode="contain" />
              <Text style={st.brand}>WISHME</Text>
            </View>
          </View>
        </View>

        <SearchCard onSearch={onSearch} preset={preset} />

        {/* Trust */}
        <View style={st.trust}>
          {TRUST.map(({ Icon, title, sub }, i) => (
            <React.Fragment key={title}>
              {i > 0 && <View style={st.trustDivider} />}
              <View style={st.trustItem}>
                <View style={st.trustIcon}>
                  <Icon size={15} color={T(P.purple, 'fg')} />
                </View>
                <Text style={st.trustTitle}>{title}</Text>
                <Text style={st.trustSub}>{sub}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Popular destinations */}
        <Text style={st.heading}>Popular destinations</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.hRow}>
          {DESTINATIONS.map((d) => (
            <TouchableOpacity key={d.city} style={st.destCard} activeOpacity={0.88} onPress={() => putInForm({ city: d.city })}>
              <Image source={d.photo} style={st.destImg} resizeMode="cover" />
              <LinearGradient
                pointerEvents="none"
                colors={['transparent', 'rgba(0,0,0,0.78)']}
                start={{ x: 0, y: 0.35 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={st.destCaption}>
                <Text style={st.destCity}>{d.city}</Text>
                <Text style={st.destTag} numberOfLines={1}>{d.tag}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Featured stays */}
        <View style={st.headRow}>
          <Text style={[st.heading, { marginTop: 0, paddingHorizontal: 0 }]}>Featured stays</Text>
          <Text style={st.headHint}>Rooms & photos</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.hRow}>
          {HOTELS.map((h) => {
            const gallery = hotelGallery(h);
            const off = Math.round(((h.originalPrice - h.price) / h.originalPrice) * 100);
            return (
              <TouchableOpacity
                key={h.id}
                style={st.stayCard}
                activeOpacity={0.9}
                onPress={() => (onOpenHotel ? onOpenHotel(h) : putInForm({ city: h.city }))}
              >
                <View style={st.stayPhoto}>
                  <Image source={gallery[0]} style={st.stayImg} resizeMode="cover" />
                  <View style={st.typeTag}>
                    <Text style={st.typeTagText}>{h.propertyType.toUpperCase()}</Text>
                  </View>
                  {off > 0 && (
                    <View style={st.offTag}>
                      <Text style={st.offTagText}>{off}% OFF</Text>
                    </View>
                  )}
                </View>
                <View style={st.thumbRow}>
                  {gallery.slice(1, 4).map((src, i) => (
                    <Image key={i} source={src} style={st.thumb} resizeMode="cover" />
                  ))}
                  {gallery.length > 4 && (
                    <View style={[st.thumb, st.thumbMore]}>
                      <Text style={st.thumbMoreText}>+{gallery.length - 4}</Text>
                    </View>
                  )}
                </View>
                <View style={st.stayBody}>
                  <View style={st.stayTop}>
                    <Text style={st.stayName} numberOfLines={1}>{h.name}</Text>
                    <View style={st.ratingPill}>
                      <Star size={9} color="#FFFFFF" fill="#FFFFFF" />
                      <Text style={st.ratingText}>{h.rating}</Text>
                    </View>
                  </View>
                  <View style={st.locRow}>
                    <MapPin size={11} color={T(C.textLight, 'fg')} />
                    <Text style={st.loc} numberOfLines={1}>{h.area}, {h.city}</Text>
                  </View>
                  <View style={st.amenRow}>
                    {h.amenities.slice(0, 3).map((a) => (
                      <Text key={a} style={st.amen}>{a}</Text>
                    ))}
                  </View>
                  <View style={st.priceRow}>
                    <Text style={st.oldPrice}>₹{h.originalPrice.toLocaleString('en-IN')}</Text>
                    <Text style={st.price}>₹{h.price.toLocaleString('en-IN')}</Text>
                    <Text style={st.perNight}>/night</Text>
                  </View>
                  {h.freeCancel && <Text style={st.freeCancel}>Free cancellation</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Stay types */}
        <Text style={st.heading}>Browse by stay type</Text>
        <View style={st.grid}>
          {STAY_TILES.map((t) => (
            <TouchableOpacity key={t.title} style={st.tile} activeOpacity={0.88} onPress={() => putInForm({ type: t.type })}>
              <View style={st.tileIcon}>
                <t.Icon size={18} color={T(P.purple, 'fg')} />
              </View>
              <View style={st.tileBody}>
                <Text style={st.tileTitle}>{t.title}</Text>
                <Text style={st.tileSub} numberOfLines={1}>{t.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Room styles */}
        <Text style={st.heading}>Rooms you'll love</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.hRow}>
          {ROOM_STYLES.map((r) => (
            <View key={r.title} style={st.roomCard}>
              <Image source={r.photo} style={st.roomImg} resizeMode="cover" />
              <Text style={st.roomTitle}>{r.title}</Text>
              <Text style={st.roomSub} numberOfLines={1}>{r.sub}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Offer */}
        <Text style={st.heading}>Offers for you</Text>
        <View style={st.offer}>
          <View style={st.offerPhoto}>
            <Image source={HOTEL_PHOTOS.infinityDeck} style={st.offerImg} resizeMode="cover" />
            <LinearGradient
              pointerEvents="none"
              colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.82)']}
              locations={[0.25, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={st.offerPill}>
              <Text style={st.offerPillText}>HOTELS</Text>
            </View>
            <View style={st.offerCaption}>
              <View style={st.offerKicker}>
                <Text style={st.offerKickerText}>ON HOTEL STAYS:</Text>
              </View>
              <Text style={st.offerTitle}>SAVE UP TO 40%*</Text>
              <Text style={st.offerSub}>on resorts, villas and city hotels</Text>
            </View>
          </View>
          <View style={st.offerTerms}>
            <Tag size={14} color={T(C.textLight, 'fg')} />
            <View style={st.offerDivider} />
            <Text style={st.offerTermsText} numberOfLines={1}>Use code STAY40 at checkout · T&C apply</Text>
          </View>
          <TouchableOpacity
            style={st.offerFooter}
            activeOpacity={0.8}
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          >
            <Text style={st.offerBook}>Book Now</Text>
            <ChevronRight size={20} color={T(C.blue, 'fg')} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Help */}
        <TouchableOpacity style={st.helpRow} activeOpacity={0.8} onPress={() => router.push('/support')}>
          <View style={st.trustIcon}>
            <Headphones size={16} color={T(P.purple, 'fg')} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.helpTitle}>Need help with a stay?</Text>
            <Text style={st.helpSub}>Changes, cancellations and refunds — we're here 24×7</Text>
          </View>
          <ChevronRight size={18} color={T(C.textLight, 'fg')} />
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const WISHME_MARK = require('../../assets/images/wishme-mark.png');

const TILE_W = (SCREEN_WIDTH - 32 - 10) / 2;

const make_st = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: T(C.white, 'page') },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  content: { paddingBottom: 40 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginTop: 4 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  poweredRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  poweredBy: { fontSize: 12, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginRight: 6 },
  mark: { width: 16, height: 16, marginRight: 3 },
  brand: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(P.purple, 'fg'), letterSpacing: 0.5 },
  trust: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    ...glass(12),
  },
  trustItem: { flex: 1, alignItems: 'center' },
  trustDivider: { width: 1, backgroundColor: T(P.lavenderBorder, 'bg'), marginVertical: 4 },
  trustIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T(P.lavenderIcon, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  trustTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), textAlign: 'center' },
  trustSub: { fontSize: 9.5, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), textAlign: 'center', marginTop: 1 },
  heading: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: T(C.text, 'fg'),
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  headHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  hRow: { paddingHorizontal: 16, gap: 10 },
  destCard: {
    width: 120,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: T(C.lightGray, 'bg'),
  },
  destImg: { position: 'absolute', top: 0, left: 0, width: 120, height: 150 },
  destCaption: { position: 'absolute', left: 10, right: 8, bottom: 9 },
  destCity: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  destTag: { fontSize: 10, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.88)', marginTop: 1 },
  stayCard: {
    width: 240,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: dk(N().cardBorder, P.lavenderBorder),
    backgroundColor: dk(N().surface, C.white),
  },
  stayPhoto: { width: 240, height: 130, overflow: 'hidden', backgroundColor: T(C.lightGray, 'bg') },
  stayImg: { position: 'absolute', top: 0, left: 0, width: 240, height: 130 },
  typeTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeTagText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: 0.5 },
  offTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  offTagText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 0.3 },
  thumbRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingTop: 8 },
  thumb: { flex: 1, height: 44, borderRadius: 6, backgroundColor: T(C.lightGray, 'bg') },
  thumbMore: { alignItems: 'center', justifyContent: 'center', backgroundColor: T(P.lavenderIcon, 'bg') },
  thumbMoreText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: T(P.purple, 'fg') },
  stayBody: { padding: 10, backgroundColor: dk(N().surface, C.white) },
  stayTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stayName: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#16A34A',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  loc: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  amenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  amen: {
    fontSize: 9.5,
    fontFamily: 'Inter_500Medium',
    color: dk(N().textHi, P.purple),
    backgroundColor: dk(N().surfaceHigh, P.lavender),
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 8 },
  oldPrice: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), textDecorationLine: 'line-through' },
  price: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  perNight: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  freeCancel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: T(C.greenDark, 'fg'), marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  tile: {
    width: TILE_W,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: dk(N().cardBorder, P.lavenderBorder),
    backgroundColor: dk(N().surface, P.lavender),
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T(P.lavenderIcon, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBody: { flex: 1 },
  tileTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  tileSub: { fontSize: 10.5, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  roomCard: { width: 150 },
  roomImg: { width: 150, height: 110, borderRadius: 12, backgroundColor: T(C.lightGray, 'bg') },
  roomTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginTop: 6 },
  roomSub: { fontSize: 10.5, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  offer: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: T(C.white, 'bg'),
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    ...glass(16),
  },
  offerPhoto: { height: Math.round((SCREEN_WIDTH - 32) * 0.46), overflow: 'hidden', backgroundColor: T(C.dark, 'bg') },
  offerImg: { position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH - 32, height: Math.round((SCREEN_WIDTH - 32) * 0.46) },
  offerPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  offerPillText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: 0.6 },
  offerCaption: { position: 'absolute', left: 0, right: 12, bottom: 10 },
  offerKicker: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 3,
    marginBottom: 5,
  },
  offerKickerText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: 0.2 },
  offerTitle: { color: '#FFFFFF', fontSize: 24, fontFamily: 'Inter_700Bold', paddingLeft: 12, letterSpacing: 0.2 },
  offerSub: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontFamily: 'Inter_500Medium', paddingLeft: 12, marginTop: 1 },
  offerTerms: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: T(C.lightGray, 'border'),
  },
  offerDivider: { width: 1, height: 18, backgroundColor: T(C.border, 'bg') },
  offerTermsText: { flex: 1, fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
  offerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  offerBook: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.blue, 'fg') },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    backgroundColor: T(P.lavender, 'bg'),
    ...glass(12),
  },
  helpTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  helpSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
});
const use_st = () => useThemedStyles(make_st);
