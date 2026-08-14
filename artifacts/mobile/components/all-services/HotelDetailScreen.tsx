import React, { useState } from 'react';
import {
  Image,
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

function RoomCard({
  room,
  selected,
  onSelect,
}: {
  room: HotelRoom;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      style={[rm.card, selected && rm.cardOn]}
      activeOpacity={0.85}
      onPress={onSelect}
    >
      <View style={rm.top}>
        <View style={{ flex: 1 }}>
          <Text style={rm.name}>{room.name}</Text>
          <Text style={rm.bed}>
            {room.bed} · {room.size} · up to {room.guests} guests
          </Text>
        </View>
        <View style={[rm.check, selected && rm.checkOn]}>
          {selected && <Check size={12} color={C.white} />}
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

const rm = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
  },
  cardOn: { borderColor: C.green, backgroundColor: '#F0FDF4' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
  bed: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 3 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
  },
  checkOn: { backgroundColor: C.green, borderColor: C.green },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    backgroundColor: C.lightGray,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: C.text },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  flagGreen: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.green },
  flagOrange: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.orange },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
  },
  strike: {
    fontSize: 11,
    color: C.gray,
    textDecorationLine: 'line-through',
    fontFamily: 'Inter_400Regular',
  },
  price: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
  per: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight },
  selectBtn: {
    borderWidth: 1.5,
    borderColor: C.orange,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectBtnOn: { backgroundColor: C.orange, borderColor: C.orange },
  selectText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.orange },
  selectTextOn: { color: C.white },
});

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
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [selectedRoomId, setSelectedRoomId] = useState(hotel.rooms[0]?.id ?? '');
  const selectedRoom = hotel.rooms.find((r) => r.id === selectedRoomId) ?? hotel.rooms[0];
  const total = (selectedRoom?.price ?? 0) * search.nights;

  return (
    <View style={st.root}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={[st.hero, { backgroundColor: hotel.tint }]}>
          <Image
            source={require('../../assets/images/travel-hotels.jpg')}
            style={st.heroImg}
            resizeMode="cover"
          />
          <View style={[st.heroTint, { backgroundColor: `${hotel.tint}AA` }]} />
          <TouchableOpacity
            style={[st.backBtn, { top: topPad + 8 }]}
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={20} color={C.white} />
          </TouchableOpacity>
          <View style={st.heroStars}>
            {Array.from({ length: hotel.stars }).map((_, i) => (
              <Star key={i} size={12} color="#FCD34D" fill="#FCD34D" />
            ))}
          </View>
        </View>

        <View style={st.panel}>
          <Text style={st.name}>{hotel.name}</Text>
          <View style={st.locRow}>
            <MapPin size={13} color={C.textLight} />
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

          <Text style={st.section}>Amenities</Text>
          <View style={st.amenityGrid}>
            {hotel.amenities.map((a) => (
              <View key={a} style={st.amenityItem}>
                {a === 'Wi-Fi' ? (
                  <Wifi size={16} color={C.purpleLight} />
                ) : a === 'Breakfast' ? (
                  <Coffee size={16} color={C.orange} />
                ) : a === 'Pool' || a === 'Spa' ? (
                  <Bath size={16} color={C.green} />
                ) : (
                  <BedDouble size={16} color={C.textLight} />
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
                  <Star size={10} color="#FCD34D" fill="#FCD34D" />
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
        >
          <Users size={16} color={C.white} />
          <Text style={st.bookText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  hero: { height: 220, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroTint: { ...StyleSheet.absoluteFillObject },
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
    bottom: 14,
    flexDirection: 'row',
    gap: 3,
  },
  panel: {
    marginTop: -16,
    backgroundColor: C.pageBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  name: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  loc: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textLight },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  ratingPill: {
    backgroundColor: C.green,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ratingText: { color: C.white, fontSize: 12, fontFamily: 'Inter_700Bold' },
  reviews: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textLight, flex: 1 },
  typePill: {
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.purple },
  section: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    marginTop: 18,
    marginBottom: 8,
  },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityItem: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 5,
  },
  amenityLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.text },
  about: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    lineHeight: 19,
  },
  reviewCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 8,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text },
  reviewRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reviewRatingText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.text },
  reviewText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textLight, lineHeight: 17 },
  reviewWhen: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.gray, marginTop: 6 },
  roomHint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 12,
  },
  footerLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight },
  footerPrice: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.orange,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  bookText: { color: C.white, fontSize: 14, fontFamily: 'Inter_700Bold' },
});
