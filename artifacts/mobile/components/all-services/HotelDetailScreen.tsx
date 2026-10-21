import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
  Bath,
  BedDouble,
  Check,
  Coffee,
  MapPin,
  Star,
  Users,
  Wifi,
} from 'lucide-react-native';
import type { Hotel, HotelRoom, HotelSearchParams } from './hotelData';

import { serviceColors as C } from './serviceColors';
import { T, useThemedStyles, glass, dockBar } from './themed';
import { BrandFill } from './BrandFill';
import { LinearGradient } from 'expo-linear-gradient';
import { hotelGallery, roomPhoto } from './hotelImages';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function RoomCard({
  room,
  selected,
  onSelect,
}: {
  room: HotelRoom;
  selected: boolean;
  onSelect: () => void;
}) {
  const rm = use_rm();
  return (
    <TouchableOpacity
      style={[rm.card, selected && rm.cardOn]}
      activeOpacity={0.85}
      onPress={onSelect}
    >
      <Image source={roomPhoto(room.id)} style={rm.photo} resizeMode="cover" />
      <View style={rm.top}>
        <View style={{ flex: 1 }}>
          <Text style={rm.name}>{room.name}</Text>
          <Text style={rm.bed}>
            {room.bed} · {room.size} · up to {room.guests} guests
          </Text>
        </View>
        <View style={[rm.check, selected && rm.checkOn]}>
          {selected && <Check size={12} color={T(C.white, 'fg')} />}
        </View>
      </View>

      <View style={rm.chips}>
        {room.amenities.map((a) => (
          <View key={a} style={rm.chip}>
            <Text style={rm.chipText}>{a}</Text>
          </View>
        ))}
      </View>

      <View style={rm.flags}>
        {room.freeCancel && <Text style={rm.flagGreen}>Free cancellation</Text>}
        {room.breakfast && <Text style={rm.flagOrange}>Breakfast included</Text>}
      </View>

      <View style={rm.priceRow}>
        <View>
          <Text style={rm.strike}>₹{room.originalPrice.toLocaleString('en-IN')}</Text>
          <Text style={rm.price}>₹{room.price.toLocaleString('en-IN')}</Text>
          <Text style={rm.per}>per night</Text>
        </View>
        <View style={[rm.selectBtn, selected && rm.selectBtnOn]}>
          <Text style={[rm.selectText, selected && rm.selectTextOn]}>
            {selected ? 'Selected' : 'Select'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const make_rm = () => StyleSheet.create({
  card: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T(C.border, 'border'),
    padding: 14,
    marginBottom: 10,
    overflow: 'hidden',
   ...glass(18), },
  photo: { height: 130, marginTop: -14, marginHorizontal: -14, marginBottom: 12, backgroundColor: T(C.lightGray, 'bg') },
  cardOn: { borderColor: T(C.green, 'border'), backgroundColor: T('#F0FDF4', 'bg') },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  bed: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 3 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: T(C.border, 'border'),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T(C.white, 'bg'),
  },
  checkOn: { backgroundColor: T(C.green, 'bg'), borderColor: T(C.green, 'border') },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    backgroundColor: T(C.lightGray, 'bg'),
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  flagGreen: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.green, 'fg') },
  flagOrange: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.orange, 'fg') },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: T(C.border, 'border'),
    paddingTop: 10,
  },
  strike: {
    fontSize: 11,
    color: T(C.gray, 'fg'),
    textDecorationLine: 'line-through',
    fontFamily: 'Inter_400Regular',
  },
  price: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  per: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  selectBtn: {
    borderWidth: 1.5,
    borderColor: T(C.orange, 'border'),
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectBtnOn: { backgroundColor: T(C.orange, 'bg'), borderColor: T(C.orange, 'border') },
  selectText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: T(C.orange, 'fg') },
  selectTextOn: { color: T(C.white, 'fg') },
});
const use_rm = () => useThemedStyles(make_rm);

export function HotelDetailScreen({
  hotel,
  search,
  onBack,
  onContinue,
}: {
  hotel: Hotel;
  search: HotelSearchParams;
  onBack: () => void;
  onContinue: (room: HotelRoom) => void;
}) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [selectedRoomId, setSelectedRoomId] = useState(hotel.rooms[0]?.id ?? '');
  const gallery = hotelGallery(hotel);
  const [photoIdx, setPhotoIdx] = useState(0);
  const galleryRef = useRef<ScrollView>(null);
  const showPhoto = (i: number) => {
    galleryRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
    setPhotoIdx(i);
  };
  const selectedRoom = hotel.rooms.find((r) => r.id === selectedRoomId) ?? hotel.rooms[0];
  const total = (selectedRoom?.price ?? 0) * search.nights;

  return (
    <View style={st.root}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={[st.hero, { backgroundColor: T(hotel.tint, 'bg') }]}>
          <ScrollView
            ref={galleryRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
              setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
            }
          >
            {gallery.map((src, i) => (
              <Image key={i} source={src} style={st.heroImg} resizeMode="cover" />
            ))}
          </ScrollView>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent', 'rgba(0,0,0,0.55)']}
            locations={[0, 0.3, 0.65, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={st.photoCounter} pointerEvents="none">
            <Text style={st.photoCounterText}>
              {photoIdx + 1} / {gallery.length}
            </Text>
          </View>
          <TouchableOpacity
            style={[st.backBtn, { top: topPad + 8 }]}
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={20} color={T(C.white, 'fg')} />
          </TouchableOpacity>
          <View style={st.heroStars}>
            {Array.from({ length: hotel.stars }).map((_, i) => (
              <Star key={i} size={12} color={T('#FCD34D', 'fg')} fill={T('#FCD34D', 'fg')} />
            ))}
          </View>
        </View>

        <View style={st.panel}>
          <Text style={st.name}>{hotel.name}</Text>
          <View style={st.locRow}>
            <MapPin size={13} color={T(C.textLight, 'fg')} />
            <Text style={st.loc}>
              {hotel.area}, {hotel.city} · {hotel.distance}
            </Text>
          </View>

          <View style={st.ratingRow}>
            <View style={st.ratingPill}>
              <Text style={st.ratingText}>{hotel.rating}</Text>
            </View>
            <Text style={st.reviews}>{hotel.reviews} ratings · Excellent</Text>
            <View style={st.typePill}>
              <Text style={st.typeText}>{hotel.propertyType}</Text>
            </View>
          </View>

          <Text style={st.section}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.thumbRow}>
            {gallery.map((src, i) => (
              <TouchableOpacity key={i} activeOpacity={0.85} onPress={() => showPhoto(i)}>
                <Image source={src} style={[st.thumb, i === photoIdx && st.thumbOn]} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={st.section}>Amenities</Text>
          <View style={st.amenityGrid}>
            {hotel.amenities.map((a) => (
              <View key={a} style={st.amenityItem}>
                {a === 'Wi-Fi' ? (
                  <Wifi size={16} color={T(C.purpleLight, 'fg')} />
                ) : a === 'Breakfast' ? (
                  <Coffee size={16} color={T(C.orange, 'fg')} />
                ) : a === 'Pool' || a === 'Spa' ? (
                  <Bath size={16} color={T(C.green, 'fg')} />
                ) : (
                  <BedDouble size={16} color={T(C.textLight, 'fg')} />
                )}
                <Text style={st.amenityLabel}>{a}</Text>
              </View>
            ))}
          </View>

          <Text style={st.section}>About this stay</Text>
          <Text style={st.about}>{hotel.description}</Text>

          <Text style={st.section}>Guest reviews</Text>
          {hotel.fanReviews.map((r) => (
            <View key={r.name + r.when} style={st.reviewCard}>
              <View style={st.reviewTop}>
                <Text style={st.reviewName}>{r.name}</Text>
                <View style={st.reviewRating}>
                  <Star size={10} color={T('#FCD34D', 'fg')} fill={T('#FCD34D', 'fg')} />
                  <Text style={st.reviewRatingText}>{r.rating}.0</Text>
                </View>
              </View>
              <Text style={st.reviewText}>{r.text}</Text>
              <Text style={st.reviewWhen}>{r.when}</Text>
            </View>
          ))}

          <Text style={st.section}>Select your room</Text>
          <Text style={st.roomHint}>
            {search.checkIn} → {search.checkOut} · {search.nights} night
            {search.nights > 1 ? 's' : ''} · {search.adults} adults
          </Text>
          {hotel.rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              selected={selectedRoomId === room.id}
              onSelect={() => setSelectedRoomId(room.id)}
            />
          ))}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View>
          <Text style={st.footerLabel}>Total for {search.nights} night{search.nights > 1 ? 's' : ''}</Text>
          <Text style={st.footerPrice}>₹{total.toLocaleString('en-IN')}</Text>
        </View>
        <TouchableOpacity
          style={st.bookBtn}
          activeOpacity={0.85}
          onPress={() => selectedRoom && onContinue(selectedRoom)}
        ><BrandFill />
          <Users size={16} color={T(C.white, 'fg')} />
          <Text style={st.bookText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const make_st = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: T(C.pageBg, 'page') },
  hero: { height: 240, position: 'relative' },
  heroImg: { width: SCREEN_WIDTH, height: 240 },
  photoCounter: {
    position: 'absolute',
    right: 14,
    bottom: 26,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  photoCounterText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  thumbRow: { gap: 8, paddingBottom: 2 },
  thumb: { width: 84, height: 62, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: '#7C3AED' },
  backBtn: {
    position: 'absolute',
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStars: {
    position: 'absolute',
    left: 14,
    bottom: 26,
    flexDirection: 'row',
    gap: 3,
  },
  panel: {
    marginTop: -16,
    backgroundColor: T(C.pageBg, 'bg'),
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  name: { fontSize: 20, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  loc: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  ratingPill: {
    backgroundColor: T(C.green, 'bg'),
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ratingText: { color: T(C.white, 'fg'), fontSize: 12, fontFamily: 'Inter_700Bold' },
  reviews: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg'), flex: 1 },
  typePill: {
    backgroundColor: T('#F5F3FF', 'bg'),
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.purple, 'fg') },
  section: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: T(C.text, 'fg'),
    marginTop: 18,
    marginBottom: 8,
  },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityItem: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    paddingVertical: 10,
    alignItems: 'center',
    gap: 5,
   ...glass(18), },
  amenityLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  about: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    lineHeight: 19,
  },
  reviewCard: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    padding: 12,
    marginBottom: 8,
   ...glass(18), },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  reviewRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reviewRatingText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  reviewText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), lineHeight: 17 },
  reviewWhen: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.gray, 'fg'), marginTop: 6 },
  roomHint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T(C.white, 'bg'),
    borderTopWidth: 1,
    borderTopColor: T(C.border, 'border'),
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 12,
   ...dockBar(), },
  footerLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  footerPrice: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
   overflow: 'hidden', },
  bookText: { color: T(C.white, 'fg'), fontSize: 14, fontFamily: 'Inter_700Bold' },
});
const use_st = () => useThemedStyles(make_st);
