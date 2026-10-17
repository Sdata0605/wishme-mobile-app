import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Shown wherever a flight came from the demo data and not from an airline, so nobody mistakes it for a real ticket. */
export function DemoFareNotice({ booked = false }: { booked?: boolean }) {
  return (
    <View style={s.box} accessibilityRole="alert">
      <Text style={s.title}>Demo flights</Text>
      <Text style={s.body}>
        {booked
          ? 'This was a demo booking. No ticket was issued by an airline and the PNR is not real.'
          : 'Live fares are not available right now, so these are sample flights and prices. Booking one will not issue a real ticket.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderColor: 'rgba(245,158,11,0.55)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  title: { color: '#D97706', fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  body: { color: '#B45309', fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginTop: 2 },
});
