import type { Product } from '../types';

export const PRODUCTS: Product[] = [
  // BOOKS
  {
    id: 'books-python-course',
    name: 'Python Programming Course',
    price: 49,
    image: '/images/product-python-course.png',
    description: 'Complete Python course from beginner to advanced',
    category: 'BOOKS',
  },
  {
    id: 'books-data-structures',
    name: 'Data Structures Textbook',
    price: 35,
    image: '/images/category-books.png',
    description: 'Essential algorithms and data structures for CS students',
    category: 'BOOKS',
  },
  {
    id: 'books-web-dev-bootcamp',
    name: 'Web Development Bootcamp',
    price: 79,
    image: '/images/category-books.png',
    description: 'Full-stack web development comprehensive course',
    category: 'BOOKS',
  },
  {
    id: 'books-math-for-engineers',
    name: 'Mathematics for Engineers',
    price: 45,
    image: '/images/category-books.png',
    description: 'Advanced calculus and linear algebra textbook',
    category: 'BOOKS',
  },

  // FOOD
  {
    id: 'food-campus-lunch',
    name: 'Campus Lunch Meal',
    price: 8,
    image: '/images/product-campus-lunch.png',
    description: 'Healthy balanced meal from campus cafeteria',
    category: 'FOOD',
  },
  {
    id: 'food-coffee-snack',
    name: 'Coffee & Snack Combo',
    price: 5,
    image: '/images/category-food.png',
    description: 'Morning coffee with pastry from campus cafe',
    category: 'FOOD',
  },
  {
    id: 'food-weekly-meal-plan',
    name: 'Weekly Meal Plan',
    price: 45,
    image: '/images/category-food.png',
    description: '5-day healthy meal plan for busy students',
    category: 'FOOD',
  },
  {
    id: 'food-energy-drinks',
    name: 'Energy Drinks Pack',
    price: 12,
    image: '/images/category-food.png',
    description: 'Pack of 6 energy drinks for study sessions',
    category: 'FOOD',
  },

  // SOFTWARE
  {
    id: 'software-github-pro',
    name: 'GitHub Pro (1 month)',
    price: 10,
    image: '/images/product-github-pro.jpeg',
    description: 'Unlimited private repos and advanced features',
    category: 'SOFTWARE',
  },
  {
    id: 'software-aws-credits',
    name: 'AWS Student Credits',
    price: 25,
    image: '/images/category-software.png',
    description: 'Cloud computing credits for projects and learning',
    category: 'SOFTWARE',
  },
  {
    id: 'software-figma-pro',
    name: 'Figma Professional',
    price: 15,
    image: '/images/category-software.png',
    description: 'UI/UX design tool for student projects',
    category: 'SOFTWARE',
  },
  {
    id: 'software-jetbrains-pack',
    name: 'JetBrains IDE Pack',
    price: 20,
    image: '/images/category-software.png',
    description: 'All JetBrains IDEs for student developers',
    category: 'SOFTWARE',
  },

  // TRANSPORT
  {
    id: 'transport-monthly-bus-pass',
    name: 'Monthly Bus Pass',
    price: 30,
    image: '/images/product-bus-pass.png',
    description: 'Unlimited bus rides within the city for one month',
    category: 'TRANSPORT',
  },
  {
    id: 'transport-weekly-metro-card',
    name: 'Weekly Metro Card',
    price: 15,
    image: '/images/category-transport.png',
    description: '7-day unlimited metro access',
    category: 'TRANSPORT',
  },
  {
    id: 'transport-airport-transfer',
    name: 'Airport Transfer',
    price: 25,
    image: '/images/category-transport.png',
    description: 'One-way airport transfer service',
    category: 'TRANSPORT',
  },
  {
    id: 'transport-taxi-credits',
    name: 'Taxi Credits',
    price: 20,
    image: '/images/category-transport.png',
    description: 'Pre-paid taxi credits for safe rides',
    category: 'TRANSPORT',
  },

  // TUITION
  {
    id: 'tuition-semester-fee',
    name: 'Semester Registration Fee',
    price: 500,
    image: '/images/product-semester-fee.jpeg',
    description: 'Official university semester registration',
    category: 'TUITION',
  },
  {
    id: 'tuition-lab-access-fee',
    name: 'Lab Access Fee',
    price: 50,
    image: '/images/category-tuition.jpeg',
    description: 'Access to all university laboratories',
    category: 'TUITION',
  },
  {
    id: 'tuition-library-fee',
    name: 'Library Annual Fee',
    price: 30,
    image: '/images/category-tuition.jpeg',
    description: 'Full access to university library resources',
    category: 'TUITION',
  },
  {
    id: 'tuition-online-learning',
    name: 'Online Learning Platform',
    price: 99,
    image: '/images/category-tuition.jpeg',
    description: 'Annual subscription to university e-learning platform',
    category: 'TUITION',
  },

  // RENT
  {
    id: 'rent-monthly-dorm-room',
    name: 'Monthly Dorm Room',
    price: 400,
    image: '/images/product-apartment-rent.png',
    description: 'Single room in university dormitory',
    category: 'RENT',
  },
  {
    id: 'rent-utilities-payment',
    name: 'Utilities Payment',
    price: 80,
    image: '/images/category-rent.jpeg',
    description: 'Monthly electricity, water, and internet',
    category: 'RENT',
  },
  {
    id: 'rent-study-room-booking',
    name: 'Study Room Booking',
    price: 15,
    image: '/images/category-rent.jpeg',
    description: 'Private study room for one week',
    category: 'RENT',
  },
  {
    id: 'rent-storage-unit',
    name: 'Storage Unit (1 month)',
    price: 25,
    image: '/images/category-rent.jpeg',
    description: 'Secure storage for student belongings',
    category: 'RENT',
  },

  // LIFESTYLE
  {
    id: 'personal-gym-membership',
    name: 'Gym Membership (1 month)',
    price: 20,
    image: '/images/category-personal.jpeg',
    description: 'Access to university gym and sports facilities',
    category: 'LIFESTYLE',
  },
  {
    id: 'personal-printing-credits',
    name: 'Printing Credits',
    price: 10,
    image: '/images/category-personal.jpeg',
    description: '100 pages of printing at university library',
    category: 'LIFESTYLE',
  },
  {
    id: 'personal-student-insurance',
    name: 'Student Insurance',
    price: 35,
    image: '/images/category-personal.jpeg',
    description: 'Monthly student health insurance coverage',
    category: 'LIFESTYLE',
  },
  {
    id: 'personal-stationery-pack',
    name: 'Stationery Pack',
    price: 15,
    image: '/images/category-personal.jpeg',
    description: 'Notebooks, pens and essential stationery',
    category: 'LIFESTYLE',
  },
];

export function getProductsByCategory(category: string): Product[] {
  return PRODUCTS.filter((p) => p.category === category);
}

export function getFeaturedProducts(count: number): Product[] {
  const shuffled = [...PRODUCTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
