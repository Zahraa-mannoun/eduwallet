import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import IconBadge from './IconBadge';
import { USER_TYPES } from '../constants/userTypes';
import { colors } from '../theme/colors';
import type { UserType } from '../context/AuthContext';

type UserTypeSelectorProps = Readonly<{
  value: UserType;
  onChange: (type: UserType) => void;
}>;

export default function UserTypeSelector({ value, onChange }: UserTypeSelectorProps) {
  return (
    <View style={styles.typeRow}>
      {USER_TYPES.map((type) => {
        const selected = value === type.key;
        return (
          <TouchableRipple
            key={type.key}
            onPress={() => onChange(type.key)}
            style={[styles.typeCard, selected && styles.typeCardSelected]}
            borderless
          >
            <View style={styles.typeCardContent}>
              <IconBadge
                icon={type.icon}
                color={selected ? colors.primary : colors.muted}
                size={40}
                iconSize={22}
                style={styles.typeIconBadge}
              />
              <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>
                {type.label}
              </Text>
            </View>
          </TouchableRipple>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  typeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EAF0FA',
  },
  typeCardContent: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 6,
  },
  typeIconBadge: {
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
  },
  typeLabelSelected: {
    color: colors.primary,
  },
});
