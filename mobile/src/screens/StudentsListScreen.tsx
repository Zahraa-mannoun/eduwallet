import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Snackbar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { ParentTabScreenProps } from '../navigation/types';

const STUDENT_BALANCE = 1250.0;

export default function StudentsListScreen({ navigation }: ParentTabScreenProps<'Students'>) {
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Students
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.studentRow} onPress={() => navigation.navigate('Home')}>
          <Avatar.Text size={48} label="ZS" style={styles.avatar} color={colors.onPrimary} />
          <View style={styles.studentMiddle}>
            <Text style={styles.studentName}>Zahraa Student</Text>
            <Text style={styles.studentUniversity}>American University of Beirut</Text>
          </View>
          <Text style={styles.studentBalance}>${STUDENT_BALANCE.toFixed(2)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addRow} onPress={() => setSnackbarVisible(true)}>
          <MaterialCommunityIcons name="plus-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.addRowText}>Link Another Student</Text>
        </TouchableOpacity>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
      >
        Linking additional students is coming soon.
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  studentMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    fontWeight: '700',
    color: colors.onPrimary,
  },
  studentUniversity: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  studentBalance: {
    fontWeight: '700',
    color: colors.onPrimary,
    fontSize: 15,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 16,
  },
  addRowText: {
    marginLeft: 8,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
});
