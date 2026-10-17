export interface HotelRoom {
  id: string;
  name: string;
  bed: string;
  size: string;
  guests: number;
  amenities: string[];
  price: number;
  originalPrice: number;
  freeCancel: boolean;
  breakfast: boolean;
}

export interface HotelReview {
  name: string;
  rating: number;
  text: string;
  when: string;
}

export interface Hotel {
  id: string;
  name: string;
  area: string;
  city: string;
  stars: 3 | 4 | 5;
  rating: number;
  reviews: string;
  price: number;
  originalPrice: number;
  tags: string[];
  amenities: string[];
  propertyType: 'Hotel' | 'Resort' | 'Homestay' | 'Apartment';
  freeCancel: boolean;
  breakfast: boolean;
  distance: string;
  description: string;
  rooms: HotelRoom[];
  fanReviews: HotelReview[];
  tint: string;
}

export interface HotelSearchParams {
  city: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  adults: number;
  children: number;
}

export const HOTEL_CITIES = [
  'Goa',
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Jaipur',
  'Manali',
  'Udaipur',
  'Shimla',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Pune',
];

export const HOTELS: Hotel[] = [
  {
    id: 'h1',
    name: 'WishMe Grand Beach Resort',
    area: 'Calangute Beach',
    city: 'Goa',
    stars: 5,
    rating: 4.6,
    reviews: '2.4K',
    price: 4899,
    originalPrice: 7200,
    tags: ['Couple Friendly', 'Beach Access'],
    amenities: ['Wi-Fi', 'Pool', 'Spa', 'Breakfast', 'Parking'],
    propertyType: 'Resort',
    freeCancel: true,
    breakfast: true,
    distance: '0.4 km from beach',
    description:
      'Sea-facing rooms, infinity pool and private beach access. Ideal for couples and families looking for a relaxed Goa stay.',
    tint: '#0F766E',
    rooms: [
      {
        id: 'r1',
        name: 'Deluxe Sea View',
        bed: '1 King Bed',
        size: '28 sq.m',
        guests: 2,
        amenities: ['Ocean view', 'AC', 'Wi-Fi', 'Mini bar'],
        price: 4899,
        originalPrice: 7200,
        freeCancel: true,
        breakfast: true,
      },
      {
        id: 'r2',
        name: 'Premium Suite',
        bed: '1 King + Sofa',
        size: '42 sq.m',
        guests: 3,
        amenities: ['Balcony', 'AC', 'Bathtub', 'Breakfast'],
        price: 6799,
        originalPrice: 9200,
        freeCancel: true,
        breakfast: true,
      },
    ],
    fanReviews: [
      {
        name: 'Ananya R.',
        rating: 5,
        text: 'Stunning beach view and very clean rooms. Breakfast buffet was excellent.',
        when: '3 days ago',
      },
      {
        name: 'Rohit K.',
        rating: 4,
        text: 'Great location near Calangute. Staff were helpful throughout.',
        when: '1 week ago',
      },
    ],
  },
  {
    id: 'h2',
    name: 'UrbanStay Business Hotel',
    area: 'Bandra Kurla Complex',
    city: 'Mumbai',
    stars: 4,
    rating: 4.3,
    reviews: '1.8K',
    price: 3599,
    originalPrice: 4999,
    tags: ['Business', 'Metro Nearby'],
    amenities: ['Wi-Fi', 'Gym', 'Restaurant', 'Parking'],
    propertyType: 'Hotel',
    freeCancel: true,
    breakfast: false,
    distance: '1.2 km from BKC',
    description:
      'Modern business hotel with fast Wi-Fi, work desks and easy access to BKC meetings and city transit.',
    tint: '#B026FF',
    rooms: [
      {
        id: 'r3',
        name: 'Superior Twin',
        bed: '2 Twin Beds',
        size: '22 sq.m',
        guests: 2,
        amenities: ['Work desk', 'AC', 'Wi-Fi'],
        price: 3599,
        originalPrice: 4999,
        freeCancel: true,
        breakfast: false,
      },
      {
        id: 'r4',
        name: 'Executive King',
        bed: '1 King Bed',
        size: '26 sq.m',
        guests: 2,
        amenities: ['City view', 'AC', 'Breakfast'],
        price: 4299,
        originalPrice: 5600,
        freeCancel: false,
        breakfast: true,
      },
    ],
    fanReviews: [
      {
        name: 'Priya S.',
        rating: 4,
        text: 'Clean and quiet. Perfect for a short business trip.',
        when: '5 days ago',
      },
    ],
  },
  {
    id: 'h3',
    name: 'Heritage Haveli Palace',
    area: 'Near City Palace',
    city: 'Jaipur',
    stars: 5,
    rating: 4.8,
    reviews: '3.1K',
    price: 5599,
    originalPrice: 8100,
    tags: ['Heritage', 'Family'],
    amenities: ['Wi-Fi', 'Pool', 'Restaurant', 'Spa', 'Parking'],
    propertyType: 'Hotel',
    freeCancel: true,
    breakfast: true,
    distance: '0.8 km from City Palace',
    description:
      'Royal Rajasthani architecture with courtyard dining, rooftop views and spacious family rooms.',
    tint: '#B45309',
    rooms: [
      {
        id: 'r5',
        name: 'Heritage Double',
        bed: '1 Queen Bed',
        size: '30 sq.m',
        guests: 2,
        amenities: ['Heritage decor', 'AC', 'Breakfast'],
        price: 5599,
        originalPrice: 8100,
        freeCancel: true,
        breakfast: true,
      },
      {
        id: 'r6',
        name: 'Royal Family Suite',
        bed: '2 Queen Beds',
        size: '48 sq.m',
        guests: 4,
        amenities: ['Living area', 'AC', 'Breakfast', 'Courtyard view'],
        price: 8499,
        originalPrice: 11200,
        freeCancel: true,
        breakfast: true,
      },
    ],
    fanReviews: [
      {
        name: 'Neha M.',
        rating: 5,
        text: 'Felt like staying in a palace. Food and hospitality were top notch.',
        when: '2 days ago',
      },
    ],
  },
  {
    id: 'h4',
    name: 'PineView Mountain Homestay',
    area: 'Old Manali',
    city: 'Manali',
    stars: 3,
    rating: 4.4,
    reviews: '986',
    price: 2199,
    originalPrice: 3200,
    tags: ['Mountain View', 'Homestay'],
    amenities: ['Wi-Fi', 'Parking', 'Hot Water', 'Kitchen'],
    propertyType: 'Homestay',
    freeCancel: false,
    breakfast: true,
    distance: '2.5 km from Mall Road',
    description:
      'Cozy wooden rooms with pine forest views, home-cooked breakfast and a peaceful hillside vibe.',
    tint: '#166534',
    rooms: [
      {
        id: 'r7',
        name: 'Valley View Room',
        bed: '1 Double Bed',
        size: '18 sq.m',
        guests: 2,
        amenities: ['Mountain view', 'Heater', 'Breakfast'],
        price: 2199,
        originalPrice: 3200,
        freeCancel: false,
        breakfast: true,
      },
      {
        id: 'r8',
        name: 'Family Cottage',
        bed: '2 Double Beds',
        size: '32 sq.m',
        guests: 4,
        amenities: ['Kitchenette', 'Heater', 'Balcony'],
        price: 3499,
        originalPrice: 4800,
        freeCancel: false,
        breakfast: true,
      },
    ],
    fanReviews: [
      {
        name: 'Kabir T.',
        rating: 5,
        text: 'Warm hosts and beautiful views. Highly recommend for couples.',
        when: '4 days ago',
      },
    ],
  },
  {
    id: 'h5',
    name: 'LakeSide Luxury Apartments',
    area: 'Fateh Sagar Lake',
    city: 'Udaipur',
    stars: 4,
    rating: 4.5,
    reviews: '1.2K',
    price: 3999,
    originalPrice: 5600,
    tags: ['Lake View', 'Apartment'],
    amenities: ['Wi-Fi', 'Kitchen', 'Parking', 'AC'],
    propertyType: 'Apartment',
    freeCancel: true,
    breakfast: false,
    distance: '0.6 km from Fateh Sagar',
    description:
      'Self-catering apartments with lake views, modern kitchens and space for longer family stays.',
    tint: '#FF5F1F',
    rooms: [
      {
        id: 'r9',
        name: '1 BHK Lake View',
        bed: '1 King Bed',
        size: '45 sq.m',
        guests: 3,
        amenities: ['Kitchen', 'AC', 'Lake view'],
        price: 3999,
        originalPrice: 5600,
        freeCancel: true,
        breakfast: false,
      },
      {
        id: 'r10',
        name: '2 BHK Family',
        bed: '2 King Beds',
        size: '70 sq.m',
        guests: 5,
        amenities: ['Kitchen', 'AC', 'Living room'],
        price: 6299,
        originalPrice: 8400,
        freeCancel: true,
        breakfast: false,
      },
    ],
    fanReviews: [
      {
        name: 'Sana P.',
        rating: 4,
        text: 'Spacious apartment and lovely lake sunset from the balcony.',
        when: '6 days ago',
      },
    ],
  },
  {
    id: 'h6',
    name: 'CityNest Budget Inn',
    area: 'Connaught Place',
    city: 'Delhi',
    stars: 3,
    rating: 4.0,
    reviews: '4.5K',
    price: 1899,
    originalPrice: 2799,
    tags: ['Budget', 'Central'],
    amenities: ['Wi-Fi', 'AC', 'Parking'],
    propertyType: 'Hotel',
    freeCancel: true,
    breakfast: false,
    distance: '0.3 km from CP Metro',
    description:
      'Affordable central stay with clean AC rooms, perfect for short city trips and transit nights.',
    tint: '#FF2E88',
    rooms: [
      {
        id: 'r11',
        name: 'Standard AC',
        bed: '1 Double Bed',
        size: '16 sq.m',
        guests: 2,
        amenities: ['AC', 'Wi-Fi'],
        price: 1899,
        originalPrice: 2799,
        freeCancel: true,
        breakfast: false,
      },
      {
        id: 'r12',
        name: 'Deluxe Twin',
        bed: '2 Twin Beds',
        size: '20 sq.m',
        guests: 2,
        amenities: ['AC', 'Wi-Fi', 'TV'],
        price: 2299,
        originalPrice: 3200,
        freeCancel: true,
        breakfast: false,
      },
    ],
    fanReviews: [
      {
        name: 'Amit V.',
        rating: 4,
        text: 'Value for money and very close to metro. Rooms are compact but clean.',
        when: '1 week ago',
      },
    ],
  },
];

export function getHotelById(id: string) {
  return HOTELS.find((h) => h.id === id);
}
