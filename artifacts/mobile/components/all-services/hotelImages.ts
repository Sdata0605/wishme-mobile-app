import type { ImageSourcePropType } from 'react-native';
import type { Hotel } from './hotelData';

/** Hotel photos bundled with the app (Unsplash, free licence): the properties, and their rooms. */
export const HOTEL_PHOTOS = {
  beachResort: require('../../assets/images/hotel-beach-resort.jpg'),
  poolNight: require('../../assets/images/hotel-pool-night.jpg'),
  palmVillas: require('../../assets/images/hotel-palm-villas.jpg'),
  tropicalPool: require('../../assets/images/hotel-tropical-pool.jpg'),
  whiteResort: require('../../assets/images/hotel-white-resort.jpg'),
  infinityDeck: require('../../assets/images/hotel-infinity-deck.jpg'),
  cliffResort: require('../../assets/images/hotel-cliff-resort.jpg'),
  cityPool: require('../../assets/images/hotel-city-pool.jpg'),
  roomWoodenSuite: require('../../assets/images/hotel-room-wooden-suite.jpg'),
  roomHeritage: require('../../assets/images/hotel-room-heritage.jpg'),
  roomClassic: require('../../assets/images/hotel-room-classic.jpg'),
  roomBusiness: require('../../assets/images/hotel-room-business.jpg'),
  roomLuxuryLoft: require('../../assets/images/hotel-room-luxury-loft.jpg'),
  roomDeluxe: require('../../assets/images/hotel-room-deluxe.jpg'),
  roomMountainView: require('../../assets/images/hotel-room-mountain-view.jpg'),
  roomFamilyTwin: require('../../assets/images/hotel-room-family-twin.jpg'),
} satisfies Record<string, ImageSourcePropType>;

const H = HOTEL_PHOTOS;

/** Each hotel's gallery, cover first. */
const GALLERY: Record<string, ImageSourcePropType[]> = {
  h1: [H.beachResort, H.infinityDeck, H.tropicalPool, H.roomWoodenSuite, H.roomLuxuryLoft],
  h2: [H.cityPool, H.roomBusiness, H.roomDeluxe, H.roomFamilyTwin],
  h3: [H.whiteResort, H.roomHeritage, H.roomClassic],
  h4: [H.roomMountainView, H.roomWoodenSuite, H.roomFamilyTwin],
  h5: [H.poolNight, H.roomLuxuryLoft, H.roomClassic, H.cliffResort],
  h6: [H.roomDeluxe, H.roomBusiness, H.roomFamilyTwin],
};

const ROOM: Record<string, ImageSourcePropType> = {
  r1: H.roomWoodenSuite,
  r2: H.roomLuxuryLoft,
  r3: H.roomFamilyTwin,
  r4: H.roomBusiness,
  r5: H.roomHeritage,
  r6: H.roomClassic,
  r7: H.roomMountainView,
  r8: H.roomFamilyTwin,
  r9: H.roomLuxuryLoft,
  r10: H.roomClassic,
  r11: H.roomDeluxe,
  r12: H.roomFamilyTwin,
};

export function hotelGallery(hotel: Pick<Hotel, 'id'>): ImageSourcePropType[] {
  return GALLERY[hotel.id] ?? [H.cityPool, H.roomDeluxe];
}

export function hotelCover(hotel: Pick<Hotel, 'id'>): ImageSourcePropType {
  return hotelGallery(hotel)[0];
}

export function roomPhoto(roomId: string): ImageSourcePropType {
  return ROOM[roomId] ?? H.roomDeluxe;
}
