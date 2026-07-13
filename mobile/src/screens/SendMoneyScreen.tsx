import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput as NativeTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Chip,
  IconButton,
  Searchbar,
  Text,
  TextInput,
  TouchableRipple,
} from 'react-native-paper';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition } from '../constants/budgetCategories';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

type Contact = {
  id: string;
  name: string;
  email: string;
  initials: string;
};

const CONTACTS: Contact[] = [
  { id: '1', name: 'Layla Hassan', email: 'layla.hassan@lau.edu.lb', initials: 'LH' },
  { id: '2', name: 'Omar Fares', email: 'omar.fares@aub.edu.lb', initials: 'OF' },
  { id: '3', name: 'Sara Khalil', email: 'sara.khalil@usek.edu.lb', initials: 'SK' },
];

type TransactionResult = {
  id: string;
  recipient: Contact;
  amount: number;
  category: BudgetCategoryDefinition;
  note: string;
  timestamp: Date;
};

const renderCategoryChipIcon = (category: BudgetCategoryDefinition) => () => (
  <IconBadge icon={category.icon} color={category.color} size={20} iconSize={12} />
);

export default function SendMoneyScreen({ navigation }: RootStackScreenProps<'SendMoney'>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [recipient, setRecipient] = useState<Contact | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<BudgetCategoryDefinition | null>(null);
  const [note, setNote] = useState('');
  const [transaction, setTransaction] = useState<TransactionResult | null>(null);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.trim().toLowerCase();
    return CONTACTS.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) || contact.email.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const parsedAmount = Number(amount);
  const canSend = Boolean(recipient) && parsedAmount > 0 && Boolean(category);

  const handleSelectContact = (contact: Contact) => {
    setRecipient(contact);
    setSearchQuery('');
  };

  const handleSend = () => {
    if (!recipient || !category) return;
    setTransaction({
      id: `TXN-${Date.now().toString(36).toUpperCase()}`,
      recipient,
      amount: parsedAmount,
      category,
      note: note.trim(),
      timestamp: new Date(),
    });
  };

  const handleSendAnother = () => {
    setTransaction(null);
    setRecipient(null);
    setAmount('');
    setCategory(null);
    setNote('');
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Send Money
        </Text>
      </View>

      {transaction ? (
        <ScrollView contentContainerStyle={styles.successContent}>
          <IconBadge icon="check-circle-outline" color={colors.accent} size={88} iconSize={48} />
          <Text variant="headlineSmall" style={styles.successTitle}>
            Money Sent!
          </Text>
          <Text style={styles.successAmount}>
            ${transaction.amount.toFixed(2)} to {transaction.recipient.name}
          </Text>

          <View style={styles.receiptCard}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Transaction ID</Text>
              <Text style={styles.receiptValue}>{transaction.id}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Category</Text>
              <Chip
                icon={renderCategoryChipIcon(transaction.category)}
                style={[styles.receiptCategoryChip, { backgroundColor: `${transaction.category.color}14` }]}
                textStyle={{ color: transaction.category.color, fontWeight: '700' }}
                compact
              >
                {transaction.category.label}
              </Chip>
            </View>
            {transaction.note ? (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Note</Text>
                <Text style={styles.receiptValue}>{transaction.note}</Text>
              </View>
            ) : null}
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Date</Text>
              <Text style={styles.receiptValue}>
                {transaction.timestamp.toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>

          <Button
            mode="contained"
            buttonColor={colors.primary}
            style={styles.doneButton}
            contentStyle={styles.doneButtonContent}
            onPress={() => navigation.goBack()}
          >
            Done
          </Button>
          <Button mode="text" textColor={colors.primary} onPress={handleSendAnother}>
            Send Another
          </Button>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Searchbar
            placeholder="Search by name or email"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchbar}
            iconColor={colors.muted}
          />

          {searchResults.length > 0 ? (
            <View style={styles.searchResults}>
              {searchResults.map((contact) => (
                <TouchableOpacity
                  key={contact.id}
                  style={styles.searchResultRow}
                  onPress={() => handleSelectContact(contact)}
                >
                  <Avatar.Text size={40} label={contact.initials} style={styles.contactAvatar} color={colors.onPrimary} />
                  <View style={styles.searchResultText}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactEmail}>{contact.email}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.recentSection}>
              <Text style={styles.sectionLabel}>Recent Contacts</Text>
              <View style={styles.recentRow}>
                {CONTACTS.map((contact) => (
                  <TouchableOpacity
                    key={contact.id}
                    style={styles.recentContact}
                    onPress={() => handleSelectContact(contact)}
                  >
                    <Avatar.Text size={52} label={contact.initials} style={styles.contactAvatar} color={colors.onPrimary} />
                    <Text style={styles.recentContactName} numberOfLines={1}>
                      {contact.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {recipient ? (
            <Chip
              avatar={<Avatar.Text size={24} label={recipient.initials} color={colors.onPrimary} style={styles.contactAvatar} />}
              onClose={() => setRecipient(null)}
              style={styles.recipientChip}
            >
              To: {recipient.name}
            </Chip>
          ) : null}

          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <NativeTextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={(text: string) => setAmount(text.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
            />
          </View>

          <Text style={styles.sectionLabel}>Category (education lock)</Text>
          <View style={styles.categoryGrid}>
            {BUDGET_CATEGORIES.map((cat) => {
              const selected = category?.key === cat.key;
              return (
                <TouchableRipple
                  key={cat.key}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.categoryItem,
                    selected && { borderColor: cat.color, backgroundColor: `${cat.color}14` },
                  ]}
                  borderless
                >
                  <View style={styles.categoryItemContent}>
                    <IconBadge icon={cat.icon} color={cat.color} size={36} iconSize={20} />
                    <Text style={[styles.categoryItemLabel, selected && { color: cat.color }]}>
                      {cat.label}
                    </Text>
                  </View>
                </TouchableRipple>
              );
            })}
          </View>

          <TextInput
            mode="outlined"
            label="Note (optional)"
            placeholder="What's this for?"
            value={note}
            onChangeText={setNote}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            style={styles.noteInput}
            multiline
          />

          <Button
            mode="contained"
            buttonColor={colors.primary}
            disabled={!canSend}
            style={styles.sendButton}
            contentStyle={styles.sendButtonContent}
            onPress={handleSend}
          >
            Send Money
          </Button>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  searchbar: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    marginBottom: 16,
  },
  searchResults: {
    marginBottom: 8,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  searchResultText: {
    marginLeft: 12,
  },
  contactAvatar: {
    backgroundColor: colors.primary,
  },
  contactName: {
    fontWeight: '600',
    color: colors.heading,
  },
  contactEmail: {
    fontSize: 12,
    color: colors.muted,
  },
  recentSection: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  recentContact: {
    alignItems: 'center',
    width: 72,
    marginRight: 8,
  },
  recentContactName: {
    fontSize: 12,
    color: colors.label,
    fontWeight: '600',
    marginTop: 6,
  },
  recipientChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 20,
    backgroundColor: '#EAF0FA',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  currencySymbol: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.heading,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.heading,
    minWidth: 120,
    textAlign: 'center',
    padding: 0,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  categoryItem: {
    width: '31%',
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  categoryItemContent: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  categoryItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 6,
  },
  noteInput: {
    backgroundColor: colors.inputBackground,
    marginBottom: 20,
  },
  sendButton: {
    borderRadius: 10,
  },
  sendButtonContent: {
    paddingVertical: 6,
  },
  successContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  successTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginTop: 16,
  },
  successAmount: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 24,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  receiptLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  receiptValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.heading,
  },
  receiptCategoryChip: {
    height: 28,
  },
  doneButton: {
    width: '100%',
    borderRadius: 10,
    marginBottom: 8,
  },
  doneButtonContent: {
    paddingVertical: 6,
  },
});
