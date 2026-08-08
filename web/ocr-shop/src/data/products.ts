import type { Product } from '../types';

// Deliberately unordered and uncategorized in the UI — ScanMart doesn't sort by category,
// it detects one from name + description at checkout (see lib/ocr.ts). Descriptions are
// written so the intended category's keywords clearly outnumber any incidental overlap
// with another category's list (e.g. "coffee" contains the substring "fee", a TUITION
// keyword, but FOOD still wins by a wide margin).
export const PRODUCTS: Product[] = [
  {
    id: 'artisan-coffee-blend',
    name: 'Artisan Coffee Blend',
    description: 'Rich, aromatic coffee for your daily drink. Freshly roasted and organic.',
    price: 12.99,
    image: '/images/coffee-blend.png',
  },
  {
    id: 'fresh-pasta-pack',
    name: 'Fresh Pasta Pack',
    description: 'Fresh handmade pasta, ready for a quick meal.',
    price: 8.5,
    image: '/images/pasta-pack.png',
  },
  {
    id: 'organic-juice-box',
    name: 'Organic Juice Box',
    description: 'Organic fruit juice, a refreshing drink for any meal.',
    price: 4.25,
    image: '/images/juice-box.png',
  },
  {
    id: 'advanced-programming-guide',
    name: 'Advanced Programming Guide',
    description:
      'A comprehensive programming guide for computer science students, ideal study material and course reference.',
    price: 45.0,
    image: '/images/programming-guide.png',
  },
  {
    id: 'mathematics-textbook-vol-2',
    name: 'Mathematics Textbook Vol.2',
    description: 'The definitive mathematics textbook for academic coursework and exam study.',
    price: 60.0,
    image: '/images/math-textbook.png',
  },
  {
    id: 'academic-writing-handbook',
    name: 'Academic Writing Handbook',
    description:
      'A complete academic writing handbook to guide your research papers and study sessions.',
    price: 28.75,
    image: '/images/writing-handbook.png',
  },
  {
    id: 'design-suite-pro-license',
    name: 'Design Suite Pro License',
    description: 'Professional design suite software with a full license and creative tools included.',
    price: 199.99,
    image: '/images/design-suite.png',
  },
  {
    id: 'cloud-storage-annual-plan',
    name: 'Cloud Storage Annual Plan',
    description: 'Secure cloud storage subscription plan for all your files and backups.',
    price: 49.99,
    image: '/images/cloud-storage.png',
  },
  {
    id: 'developer-tools-bundle',
    name: 'Developer Tools Bundle',
    description: 'Complete developer tools and software suite for building modern apps.',
    price: 89.0,
    image: '/images/dev-tools.png',
  },
  {
    id: 'monthly-bus-pass',
    name: 'Monthly Bus Pass',
    description: 'Unlimited monthly bus pass for getting around town.',
    price: 35.0,
    image: '/images/bus-pass.jpg',
  },
  {
    id: 'taxi-app-credit',
    name: 'Taxi App Credit',
    description: 'Prepaid ride credit for taxi trips, valid on monthly transport routes.',
    price: 20.0,
    image: '/images/taxi-credit.jpg',
  },
  {
    id: 'parking-season-pass',
    name: 'Parking Season Pass',
    description: 'Reserved parking pass for your daily commute and transport needs.',
    price: 75.0,
    image: '/images/parking-pass.jpg',
  },
  {
    id: 'skincare-essential-kit',
    name: 'Skincare Essential Kit',
    description:
      'Complete skincare and beauty routine featuring premium cosmetics for daily wellness.',
    price: 32.5,
    image: '/images/skincare-kit.jpg',
  },
  {
    id: 'fashion-accessories-pack',
    name: 'Fashion Accessories Pack',
    description: 'Trendy fashion accessories and beauty items for everyday style, includes cosmetics.',
    price: 24.99,
    image: '/images/fashion-pack.jpg',
  },
  {
    id: 'wellness-bundle',
    name: 'Wellness Bundle',
    description: 'A curated wellness and beauty package with skincare and cosmetics items.',
    price: 40.0,
    image: '/images/wellness-bundle.jpg',
  },
  {
    id: 'student-starter-pack',
    name: 'Student Starter Pack',
    description: 'A campus starter kit with essential items every new student needs.',
    price: 55.0,
    image: '/images/starter-pack.jpg',
  },
  {
    id: 'campus-essential-kit',
    name: 'Campus Essential Kit',
    description: 'Everything essential for campus life, bundled into one starter kit.',
    price: 42.0,
    image: '/images/campus-kit.jpg',
  },
];

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((product) => product.id === id);
}
