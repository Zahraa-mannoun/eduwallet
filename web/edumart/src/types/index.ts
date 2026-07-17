export type Category = 'BOOKS' | 'FOOD' | 'SOFTWARE' | 'TRANSPORT' | 'TUITION' | 'RENT' | 'PERSONAL';

export interface CategoryInfo {
  key: Category;
  name: string;
  image: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: Category;
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
