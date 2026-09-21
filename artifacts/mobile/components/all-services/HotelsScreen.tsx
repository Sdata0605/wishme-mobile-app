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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={md.backdrop}>
        <View style={md.sheet}>
          <View style={md.head}>
            <Text style={md.title}>Where are you going?</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={C.text} />
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
                  <MapPin size={16} color={C.green} />
                </View>
                <Text style={md.city}>{city}</Text>
                {selected === city && <Check size={18} color={C.green} />}
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
  const days = nextDays(21).filter((d) => !minDate || d >= new Date(minDate.setHours(0, 0, 0, 0)));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={md.backdrop}>
        <View style={md.sheet}>
          <View style={md.head}>
            <Text style={md.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={C.text} />
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
                <View style={[md.icon, { backgroundColor: '#F5F3FF' }]}>
                  <Calendar size={16} color={C.purpleLight} />
                </View>
                <Text style={md.city}>{formatDate(d)}</Text>
                {sameDay(selected, d) && <Check size={18} color={C.green} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const md = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.white,
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
    borderBottomColor: C.border,
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.lightGray,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  city: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: C.text },
});

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
  return (
    <View style={ct.row}>
      <Text style={ct.label}>{label}</Text>
      <View style={ct.controls}>
        <TouchableOpacity
          style={[ct.btn, value <= min && ct.btnDisabled]}
          disabled={value <= min}
          onPress={() => onChange(value - 1)}
        >
          <Minus size={14} color={value <= min ? C.gray : C.text} />
        </TouchableOpacity>
        <Text style={ct.value}>{value}</Text>
        <TouchableOpacity
          style={[ct.btn, value >= max && ct.btnDisabled]}
          disabled={value >= max}
          onPress={() => onChange(value + 1)}
        >
          <Plus size={14} color={value >= max ? C.gray : C.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ct = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  label: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.text },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
  },
  btnDisabled: { backgroundColor: C.lightGray },
  value: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text, minWidth: 18, textAlign: 'center' },
});

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
              <X size={22} color={C.text} />
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

const guest = StyleSheet.create({
  apply: {
    backgroundColor: C.orange,
    borderRadius: 22,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  applyText: { color: C.white, fontSize: 15, fontFamily: 'Inter_700Bold' },
});

function SearchCard({ onSearch }: { onSearch: (params: HotelSearchParams) => void }) {
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
        <MapPin size={18} color={C.green} />
        <View style={{ flex: 1 }}>
          <Text style={sc.label}>City / Area / Hotel</Text>
          <Text style={sc.value}>{city}</Text>
        </View>
        <ChevronRight size={16} color={C.gray} />
      </TouchableOpacity>

      <View style={sc.datesRow}>
        <TouchableOpacity style={[sc.field, { flex: 1 }]} onPress={() => setPicker('in')}>
          <Calendar size={16} color={C.purpleLight} />
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
          <Calendar size={16} color={C.orange} />
          <View style={{ flex: 1 }}>
            <Text style={sc.label}>Check-out</Text>
            <Text style={sc.valueSm}>{formatDate(checkOut)}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={sc.field} onPress={() => setPicker('guests')} activeOpacity={0.75}>
        <Users size={18} color={C.orange} />
        <View style={{ flex: 1 }}>
          <Text style={sc.label}>Rooms & Guests</Text>
          <Text style={sc.value}>
            {rooms} Room · {adults} Adults{children > 0 ? ` · ${children} Children` : ''}
          </Text>
        </View>
        <ChevronRight size={16} color={C.gray} />
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
      >
        <Search size={18} color={C.white} />
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

const sc = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    marginHorizontal: 14,
    marginTop: -34,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 10,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  label: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight },
  value: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text, marginTop: 1 },
  valueSm: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text, marginTop: 1 },
  datesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nightsPill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  nightsText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.green },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.orange,
    borderRadius: 24,
    paddingVertical: 14,
    marginTop: 4,
  },
  searchText: { color: C.white, fontSize: 15, fontFamily: 'Inter_700Bold' },
});

const POPULAR = [
  { city: 'Goa', tag: 'Beaches', color: C.orange, bg: '#FFF7ED' },
  { city: 'Manali', tag: 'Hills', color: '#2563EB', bg: '#EFF6FF' },
  { city: 'Jaipur', tag: 'Heritage', color: '#DC2626', bg: '#FEE2E2' },
  { city: 'Udaipur', tag: 'Lakes', color: C.green, bg: '#ECFDF5' },
  { city: 'Mumbai', tag: 'City', color: C.purpleLight, bg: '#F5F3FF' },
];

export function HotelsScreen({
  onBack,
  onSearch,
}: {
  onBack: () => void;
  onSearch: (params: HotelSearchParams) => void;
}) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={st.root}>
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={C.text} />
        </TouchableOpacity>
        <View>
          <Text style={st.headerTitle}>Hotels</Text>
          <Text style={st.headerSub}>Homes, resorts & stays across India</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={st.headerIcon}>
          <Building2 size={18} color={C.green} />
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
                <View style={[pop.icon, { backgroundColor: d.bg }]}>
                  <MapPin size={16} color={d.color} />
                </View>
                <Text style={pop.city}>{d.city}</Text>
                <Text style={pop.tag}>{d.tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={ofr.container}>
          <View style={ofr.iconBox}>
            <Percent size={26} color="#FCD34D" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ofr.headline}>Save up to 40% on hotel stays</Text>
            <View style={ofr.codePill}>
              <Tag size={10} color={C.white} />
              <Text style={ofr.codeText}> Use Code: STAY40</Text>
            </View>
          </View>
          <TouchableOpacity style={ofr.btn}>
            <Text style={ofr.btnText}>Claim</Text>
          </TouchableOpacity>
        </View>

        <View style={ts.container}>
          {[
            { Icon: ShieldCheck, color: C.green, title: 'Best Price', sub: 'Deal promise' },
            { Icon: Star, color: '#FBBF24', title: 'Top Rated', sub: 'Verified stays' },
            { Icon: Zap, color: '#60A5FA', title: 'Instant Book', sub: 'Quick confirm' },
            { Icon: Headphones, color: C.green, title: '24x7 Help', sub: 'Trip support' },
          ].map((b, i, arr) => (
            <View key={b.title} style={[ts.item, i < arr.length - 1 && ts.itemBorder]}>
              <b.Icon size={20} color={b.color} />
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

const pop = StyleSheet.create({
  section: { marginTop: 20 },
  heading: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  row: { paddingHorizontal: 14, gap: 10 },
  card: {
    width: 92,
    backgroundColor: C.white,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  city: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text },
  tag: { fontSize: 9, fontFamily: 'Inter_400Regular', color: C.textLight },
});

const ofr = StyleSheet.create({
  container: {
    backgroundColor: C.purple,
    marginHorizontal: 14,
    marginTop: 20,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: { color: C.white, fontSize: 13, fontFamily: 'Inter_700Bold' },
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
  codeText: { color: C.white, fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  btn: {
    backgroundColor: C.orange,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: { color: C.white, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});

const ts = StyleSheet.create({
  container: {
    backgroundColor: C.darkBg,
    marginTop: 20,
    marginHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  itemBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  title: { color: C.white, fontSize: 10.5, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  sub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 8,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
  headerSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 1 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingBottom: 40 },
  bannerWrap: { height: 170, backgroundColor: C.lightGray, position: 'relative' },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,24,39,0.40)' },
  bannerCaption: { position: 'absolute', left: 16, top: 22 },
  bannerTitle: {
    color: C.white,
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
