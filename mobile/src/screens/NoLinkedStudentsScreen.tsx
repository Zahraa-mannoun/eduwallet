import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, IconButton, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

export default function NoLinkedStudentsScreen({
  navigation,
}: Readonly<RootStackScreenProps<'NoLinkedStudents'>>) {
  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Student Receipts
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="account-off-outline" size={32} color={colors.muted} />
        </View>
        <Text style={styles.title}>No Linked Students</Text>
        <Text style={styles.subtitle}>
          You have no linked students yet. Link a student first to view their receipts.
        </Text>
        <Button
          mode="contained"
          style={styles.cta}
          onPress={() => navigation.navigate('ParentMain', { screen: 'Students' })}
        >
          Link a Student
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  backButton: {
    margin: 0,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 4,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  cta: {
    borderRadius: 10,
  },
});
