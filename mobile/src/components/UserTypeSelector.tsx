import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, TouchableRipple } from 'react-native-paper';
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
            style={styles.typeCardWrapper}
            borderless
          >
            {selected ? (
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.typeCard, styles.typeCardSelected]}
              >
                <MaterialCommunityIcons name={type.icon} size={22} color={colors.onPrimary} />
                <Text style={[styles.typeLabel, styles.typeLabelSelected]}>{type.label}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.typeCard}>
                <MaterialCommunityIcons name={type.icon} size={22} color={colors.muted} />
                <Text style={styles.typeLabel}>{type.label}</Text>
              </View>
            )}
          </TouchableRipple>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  typeRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 4,
  },
  typeCardWrapper: {
    flex: 1,
    borderRadius: 14,
  },
  typeCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 14,
  },
  typeCardSelected: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  typeLabelSelected: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
