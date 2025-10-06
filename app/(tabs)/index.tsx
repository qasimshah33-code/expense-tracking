import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react-native';

type Balance = {
  userId: string;
  userName: string;
  amount: number;
};

type RecentExpense = {
  id: string;
  description: string;
  amount: number;
  date: string;
  paidByName: string;
  groupName: string | null;
};

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;

    const { data: expenses } = await supabase
      .from('expenses')
      .select(`
        id,
        description,
        amount,
        date,
        paid_by,
        group_id,
        profiles!expenses_paid_by_fkey(full_name),
        groups(name),
        expense_splits(user_id, amount)
      `)
      .order('date', { ascending: false })
      .limit(10);

    if (expenses) {
      const recent = expenses.map(exp => ({
        id: exp.id,
        description: exp.description,
        amount: exp.amount,
        date: new Date(exp.date).toLocaleDateString(),
        paidByName: (exp.profiles as any)?.full_name || 'Unknown',
        groupName: (exp.groups as any)?.name || null,
      }));
      setRecentExpenses(recent);

      const balanceMap = new Map<string, { name: string; amount: number }>();

      for (const exp of expenses) {
        const splits = exp.expense_splits as any[];
        const paidBy = exp.paid_by;
        const paidByName = (exp.profiles as any)?.full_name || 'Unknown';

        if (paidBy === user.id) {
          for (const split of splits) {
            if (split.user_id !== user.id) {
              const existing = balanceMap.get(split.user_id) || { name: '', amount: 0 };
              existing.amount += Number(split.amount);
              balanceMap.set(split.user_id, existing);
            }
          }
        } else {
          const mySplit = splits.find(s => s.user_id === user.id);
          if (mySplit) {
            const existing = balanceMap.get(paidBy) || { name: paidByName, amount: 0 };
            existing.amount -= Number(mySplit.amount);
            balanceMap.set(paidBy, existing);
          }
        }
      }

      const balancesList = Array.from(balanceMap.entries())
        .map(([userId, data]) => ({
          userId,
          userName: data.name,
          amount: data.amount,
        }))
        .filter(b => Math.abs(b.amount) > 0.01);

      setBalances(balancesList);
    }

    setLoading(false);
  };

  const totalOwed = balances
    .filter(b => b.amount < 0)
    .reduce((sum, b) => sum + Math.abs(b.amount), 0);

  const totalOwedToYou = balances
    .filter(b => b.amount > 0)
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SplitWise</Text>
        <Pressable style={styles.addButton}>
          <Plus size={24} color="#1CC29F" />
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceTitle}>Your Balance</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <View style={styles.balanceIconContainer}>
                <TrendingDown size={20} color="#E53E3E" />
              </View>
              <Text style={styles.balanceLabel}>You owe</Text>
              <Text style={[styles.balanceAmount, styles.negativeAmount]}>
                ${totalOwed.toFixed(2)}
              </Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <View style={styles.balanceIconContainer}>
                <TrendingUp size={20} color="#1CC29F" />
              </View>
              <Text style={styles.balanceLabel}>You are owed</Text>
              <Text style={[styles.balanceAmount, styles.positiveAmount]}>
                ${totalOwedToYou.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {balances.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Balances</Text>
            {balances.map((balance) => (
              <View key={balance.userId} style={styles.balanceListItem}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {balance.userName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.balanceInfo}>
                  <Text style={styles.balanceName}>{balance.userName}</Text>
                  <Text
                    style={[
                      styles.balanceText,
                      balance.amount > 0 ? styles.positiveText : styles.negativeText,
                    ]}
                  >
                    {balance.amount > 0
                      ? `owes you $${balance.amount.toFixed(2)}`
                      : `you owe $${Math.abs(balance.amount).toFixed(2)}`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentExpenses.length === 0 ? (
            <Text style={styles.emptyText}>No expenses yet</Text>
          ) : (
            recentExpenses.map((expense) => (
              <View key={expense.id} style={styles.expenseItem}>
                <View style={styles.expenseIcon}>
                  <Text style={styles.expenseIconText}>$</Text>
                </View>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseDescription}>{expense.description}</Text>
                  <Text style={styles.expenseDetail}>
                    {expense.paidByName} paid ${expense.amount}
                  </Text>
                  {expense.groupName && (
                    <Text style={styles.expenseGroup}>{expense.groupName}</Text>
                  )}
                </View>
                <Text style={styles.expenseDate}>{expense.date}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F9F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceIconContainer: {
    marginBottom: 8,
  },
  balanceDivider: {
    width: 1,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 16,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '700',
  },
  negativeAmount: {
    color: '#E53E3E',
  },
  positiveAmount: {
    color: '#1CC29F',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  balanceListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F9F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1CC29F',
  },
  balanceInfo: {
    flex: 1,
  },
  balanceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  balanceText: {
    fontSize: 14,
  },
  positiveText: {
    color: '#1CC29F',
  },
  negativeText: {
    color: '#E53E3E',
  },
  emptyText: {
    fontSize: 15,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseIconText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  expenseDetail: {
    fontSize: 14,
    color: '#666666',
  },
  expenseGroup: {
    fontSize: 13,
    color: '#1CC29F',
    marginTop: 2,
  },
  expenseDate: {
    fontSize: 13,
    color: '#999999',
  },
});
