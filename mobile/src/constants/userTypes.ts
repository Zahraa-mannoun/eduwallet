import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { UserType } from '../context/AuthContext';

export type UserTypeDefinition = {
  key: UserType;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

export const USER_TYPES: UserTypeDefinition[] = [
  { key: 'STUDENT', label: 'Student', icon: 'school-outline' },
  { key: 'PARENT', label: 'Parent', icon: 'account-heart-outline' },
  { key: 'INSTITUTION', label: 'Institution', icon: 'bank-outline' },
];
