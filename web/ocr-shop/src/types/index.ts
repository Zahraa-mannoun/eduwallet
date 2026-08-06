// No RENT or PERSONAL_SAVINGS — this shop only ever detects categories a purchase could
// plausibly be for; those two aren't purchasable merchant categories.
export type Category = 'FOOD' | 'BOOKS' | 'SOFTWARE' | 'TRANSPORT' | 'LIFESTYLE' | 'TUITION' | 'GENERAL';

// Deliberately no `category` field — this shop detects it from name + description at
// checkout instead of a predefined label (see lib/ocr.ts).
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export type UserType = 'STUDENT' | 'PARENT' | 'INSTITUTION' | 'ADMIN';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  userType: UserType;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface LoginResponseData {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface UseCardResponseData {
  transaction: {
    id: string;
    amount: string;
    currency: string;
    category: Category;
    status: string;
    note: string | null;
    createdAt: string;
  };
}
