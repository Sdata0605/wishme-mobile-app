import React, { useEffect, useState } from 'react';
import { useAgentPrefill } from '@/context/AgentStateContext';
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
  Building2,
  Calendar,
  Check,
  ChevronRight,
  Headphones,
  MapPin,
  Minus,
  Percent,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Tag,
  Users,
  X,
  Zap,
} from 'lucide-react-native';
import { HOTEL_CITIES, type HotelSearchParams } from './hotelData';
import { serviceColors as C } from './serviceColors';
import { T, useThemedStyles, glass, dk, N } from './themed';
import { BrandFill, BannerScrim } from './BrandFill';



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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={md.backdrop}>
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
                  <MapPin size={16} color={T(C.green, 'fg')} />
                </View>
                <Text style={md.city}>{city}</Text>
                {selected === city && <Check size={18} color={T(C.green, 'fg')} />}
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={md.backdrop}>
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
                {sameDay(selected, d) && <Check size={18} color={T(C.green, 'fg')} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const make_md = () => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T(C.white, 'bg'),
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
    backgroundColor: T('#ECFDF5', 'bg'),
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={md.backdrop}>
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
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 22,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  applyText: { color: T(C.white, 'fg'), fontSize: 15, fontFamily: 'Inter_700Bold' },
});
const use_guest = () => useThemedStyles(make_guest);

function SearchCard({ onSearch }: { onSearch: (params: HotelSearchParams) => void }) {
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

  const nights = nightsBetween(new Date(checkIn), new Date(checkOut));

  return (
    <View style={sc.card}>
      <TouchableOpacity style={sc.field} onPress={() => setPicker('city')} activeOpacity={0.75}>
        <MapPin size={18} color={T(C.green, 'fg')} />
        <View style={{ flex: 1 }}>
          <Text style={sc.label}>City / Area / Hotel</Text>
          <Text style={sc.value}>{city}</Text>
        </View>
        <ChevronRight size={16} color={T(C.gray, 'fg')} />
      </TouchableOpacity>

      <View style={sc.datesRow}>
        <TouchableOpacity style={[sc.field, { flex: 1 }]} onPress={() => setPicker('in')}>
          <Calendar size={16} color={T(C.purpleLight, 'fg')} />
          <View style={{ flex: 1 }}>
            <Text style={sc.label}>Check-in</Text>
            <Text style={sc.valueSm}>{formatDate(checkIn)}</Text>
          </View>
        </TouchableOpacity>
        <View style={sc.nightsPill}>
          <Text style={sc.nightsText}>
            {nights}N
          </Text>
        </View>
        <TouchableOpacity style={[sc.field, { flex: 1 }]} onPress={() => setPicker('out')}>
          <Calendar size={16} color={T(C.orange, 'fg')} />
          <View style={{ flex: 1 }}>
            <Text style={sc.label}>Check-out</Text>
            <Text style={sc.valueSm}>{formatDate(checkOut)}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={sc.field} onPress={() => setPicker('guests')} activeOpacity={0.75}>
        <Users size={18} color={T(C.orange, 'fg')} />
        <View style={{ flex: 1 }}>
          <Text style={sc.label}>Rooms & Guests</Text>
          <Text style={sc.value}>
            {rooms} Room · {adults} Adults{children > 0 ? ` · ${children} Children` : ''}
          </Text>
        </View>
        <ChevronRight size={16} color={T(C.gray, 'fg')} />
      </TouchableOpacity>

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
          })
        }
      ><BrandFill />
        <Search size={18} color={T(C.white, 'fg')} />
        <Text style={sc.searchText}>Search Hotels</Text>
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
  card: {
    backgroundColor: T(C.white, 'bg'),
    marginHorizontal: 14,
    marginTop: dk(14, -34),
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 10,
   ...glass(22), },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  label: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  value: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginTop: 1 },
  valueSm: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginTop: 1 },
  datesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nightsPill: {
    backgroundColor: T('#ECFDF5', 'bg'),
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: T('#A7F3D0', 'border'),
  },
  nightsText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg') },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 24,
    paddingVertical: 14,
    marginTop: 4,
   overflow: 'hidden', },
  searchText: { color: T(C.white, 'fg'), fontSize: 15, fontFamily: 'Inter_700Bold' },
});
const use_sc = () => useThemedStyles(make_sc);

const POPULAR = [
  { city: 'Goa', tag: 'Beaches', color: T(C.orange, 'fg'), bg: '#F5F0FF' },
  { city: 'Manali', tag: 'Hills', color: '#2563EB', bg: '#EFF6FF' },
  { city: 'Jaipur', tag: 'Heritage', color: '#DC2626', bg: '#FEE2E2' },
  { city: 'Udaipur', tag: 'Lakes', color: T(C.green, 'fg'), bg: '#ECFDF5' },
  { city: 'Mumbai', tag: 'City', color: T(C.purpleLight, 'fg'), bg: '#F5F3FF' },
];

export function HotelsScreen({
  onBack,
  onSearch,
}: {
  onBack: () => void;
  onSearch: (params: HotelSearchParams) => void;
}) {
  const st = use_st(); const pop = use_pop(); const ofr = use_ofr(); const ts = use_ts();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={st.root}>
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View>
          <Text style={st.headerTitle}>Hotels</Text>
          <Text style={st.headerSub}>Homes, resorts & stays across India</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={st.headerIcon}>
          <Building2 size={18} color={T(C.green, 'fg')} />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={st.content}>
        <View style={st.bannerWrap}>
          <Image
            source={require('../../assets/images/travel-hotels.jpg')}
            style={st.bannerImage}
            resizeMode="cover"
          />
          <View style={st.bannerOverlay} />
          <BannerScrim />
          <View style={st.bannerCaption}>
            <Text style={st.bannerTitle}>Book Hotels</Text>
            <Text style={st.bannerSub}>Budget to 5-star · Free cancellation options</Text>
          </View>
        </View>

        <SearchCard onSearch={onSearch} />

        <View style={pop.section}>
          <Text style={pop.heading}>Popular destinations</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pop.row}>
            {POPULAR.map((d) => (
              <TouchableOpacity
                key={d.city}
                style={pop.card}
                activeOpacity={0.85}
                onPress={() =>
                  onSearch({
                    city: d.city,
                    checkIn: formatDate(new Date()),
                    checkOut: formatDate(
                      (() => {
                        const t = new Date();
                        t.setDate(t.getDate() + 1);
                        return t;
                      })(),
                    ),
                    nights: 1,
                    rooms: 1,
                    adults: 2,
                    children: 0,
                  })
                }
              >
                <View style={[pop.icon, { backgroundColor: T(d.bg, 'bg') }]}>
                  <MapPin size={16} color={T(d.color, 'fg')} />
                </View>
                <Text style={pop.city}>{d.city}</Text>
                <Text style={pop.tag}>{d.tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={ofr.container}><BrandFill />
          <View style={ofr.iconBox}>
            <Percent size={26} color={T('#FCD34D', 'fg')} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ofr.headline}>Save up to 40% on hotel stays</Text>
            <View style={ofr.codePill}>
              <Tag size={10} color={T(C.white, 'fg')} />
              <Text style={ofr.codeText}> Use Code: STAY40</Text>
            </View>
          </View>
          <TouchableOpacity style={ofr.btn}><BrandFill />
            <Text style={ofr.btnText}>Claim</Text>
          </TouchableOpacity>
        </View>

        <View style={ts.container}>
          {[
            { Icon: ShieldCheck, color: T(C.green, 'fg'), title: 'Best Price', sub: 'Deal promise' },
            { Icon: Star, color: T('#FBBF24', 'fg'), title: 'Top Rated', sub: 'Verified stays' },
            { Icon: Zap, color: T('#60A5FA', 'fg'), title: 'Instant Book', sub: 'Quick confirm' },
            { Icon: Headphones, color: T(C.green, 'fg'), title: '24x7 Help', sub: 'Trip support' },
          ].map((b, i, arr) => (
            <View key={b.title} style={[ts.item, i < arr.length - 1 && ts.itemBorder]}>
              <b.Icon size={20} color={T(b.color, 'fg')} />
              <Text style={ts.title}>{b.title}</Text>
              <Text style={ts.sub}>{b.sub}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const make_pop = () => StyleSheet.create({
  section: { marginTop: 20 },
  heading: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: T(C.text, 'fg'),
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  row: { paddingHorizontal: 14, gap: 10 },
  card: {
    width: 92,
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
   ...glass(18), },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  city: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  tag: { fontSize: 9, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
});
const use_pop = () => useThemedStyles(make_pop);

const make_ofr = () => StyleSheet.create({
  container: {
    backgroundColor: T(C.purple, 'bg'),
    marginHorizontal: 14,
    marginTop: 20,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
   overflow: 'hidden', },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: { color: T(C.white, 'fg'), fontSize: 13, fontFamily: 'Inter_700Bold' },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
  },
  codeText: { color: T(C.white, 'fg'), fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  btn: {
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
   overflow: 'hidden', },
  btnText: { color: T(C.white, 'fg'), fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
const use_ofr = () => useThemedStyles(make_ofr);

const make_ts = () => StyleSheet.create({
  container: {
    backgroundColor: T(C.darkBg, 'bg'),
    marginTop: 20,
    marginHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  itemBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  title: { color: T(C.white, 'fg'), fontSize: 10.5, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  sub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 8,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
const use_ts = () => useThemedStyles(make_ts);

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
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  headerSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: T('#ECFDF5', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingBottom: 40 },
  bannerWrap: { height: 170, backgroundColor: T(C.lightGray, 'bg'), position: 'relative', ...{ marginHorizontal: dk(14, 0), marginTop: dk(10, 0), borderRadius: dk(22, 0), borderWidth: dk(1.5, 0), borderColor: N().cardBorder, overflow: 'hidden' } },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,24,39,0.40)' },
  bannerCaption: { position: 'absolute', left: 16, top: 22 },
  bannerTitle: {
    color: T(C.white, 'fg'),
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bannerSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 3,
  },
});
const use_st = () => useThemedStyles(make_st);
