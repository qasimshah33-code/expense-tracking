import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Receipt, ArrowRightLeft } from 'lucide-react-native';

type ActivityItem = {
  id: string;
  type: 'expense' | 'settlement';
  description: string;
  amount: number;
  date: string;
  paidByName: string;
  groupName: string | null;
};

export default function Activity() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivity();
  }, []);

  const loadActivity = async () => {
    if (!user) return;

    const { data: expenses } = await supabase
      .from('expenses')
      .select(`
        id,
        description,
        amount,
        date,
        paid_by,
        profiles!expenses_paid_by_fkey(full_name),
        groups(name),
        expense_splits!inner(user_id)
      `)
      .eq('expense_splits.user_id', user.id)
      .order('date', { ascending: false })
      .limit(20);

    const { data: settlements } = await supabase
      .from('settlements')
      .select(`
        id,
        amount,
        date,
        note,
        from_user,
        to_user,
        fromProfile:profiles!settlements_from_user_fkey(full_name),
        toProfile:profiles!settlements_to_user_fkey(full_name),
        groups(name)
      `)
      .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
      .order('date', { ascending: false })
      .limit(20);

    const allActivities: ActivityItem[] = [];

    if (expenses) {
      expenses.forEach(exp => {
        allActivities.push({
          id: exp.id,
          type: 'expense',
          description: exp.description,
          amount: exp.amount,
          date: new Date(exp.date).toLocaleDateString(),
          paidByName: (exp.profiles as any)?.full_name || 'Unknown',
          groupName: (exp.groups as any)?.name || null,
        });
      });
    }

    if (settlements) {
      settlements.forEach(settlement => {
        const isFromUser = settlement.from_user === user.id;
        const otherUserName = isFromUser
          ? (settlement.toProfile as any)?.full_name
          : (settlement.fromProfile as any)?.full_name;

        allActivities.push({
          id: settlement.id,
          type: 'settlement',
          description: isFromUser
            ? `You paid ${otherUserName}`
            : `${otherUserName} paid you`,
          amount: settlement.amount,
          date: new Date(settlement.date).toLocaleDateString(),
          paidByName: otherUserName || 'Unknown',
          groupName: (settlement.groups as any)?.name || null,
        });
      });
    }

    allActivities.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    setActivities(allActivities);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : activities.length === 0 ? (
          <View style={styles.emptyState}>
            <Receipt size={64} color="#CCCCCC" />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptyText}>
              Your expenses and settlements will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.activityList}>
            {activities.map((activity) => (
              <View key={activity.id} style={styles.activityItem}>
                <View
                  style={[
                    styles.activityIcon,
                    activity.type === 'settlement' && styles.settlementIcon,
                  ]}
                >
                  {activity.type === 'expense' ? (
                    <Receipt size={20} color="#1CC29F" />
                  ) : (
                    <ArrowRightLeft size={20} color="#5B7FFF" />
                  )}
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityDescription}>{activity.description}</Text>
                  <Text style={styles.activityDetail}>
                    {activity.type === 'expense' &&
                      `${activity.paidByName} paid $${activity.amount}`}
                    {activity.type === 'settlement' && `$${activity.amount}`}
                  </Text>
                  {activity.groupName && (
                    <Text style={styles.activityGroup}>{activity.groupName}</Text>
                  )}
                </View>
                <Text style={styles.activityDate}>{activity.date}</Text>
              </View>
            ))}
          </View>
        )}
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
  content: {
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  activityList: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F9F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settlementIcon: {
    backgroundColor: '#EEF2FF',
  },
  activityInfo: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  activityDetail: {
    fontSize: 14,
    color: '#666666',
  },
  activityGroup: {
    fontSize: 13,
    color: '#1CC29F',
    marginTop: 2,
  },
  activityDate: {
    fontSize: 13,
    color: '#999999',
  },
});
