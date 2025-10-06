import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Users } from 'lucide-react-native';

type Group = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  totalExpenses: number;
};

export default function Groups() {
  const { user } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    if (!user) return;

    const { data: groupMembers } = await supabase
      .from('group_members')
      .select(`
        group_id,
        groups(
          id,
          name,
          description,
          created_at
        )
      `)
      .eq('user_id', user.id);

    if (groupMembers) {
      const groupsData = await Promise.all(
        groupMembers
          .filter(gm => gm.groups)
          .map(async (gm) => {
            const group = gm.groups as any;

            const { count: memberCount } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', group.id);

            const { data: expenses } = await supabase
              .from('expenses')
              .select('amount')
              .eq('group_id', group.id);

            const totalExpenses = expenses?.reduce(
              (sum, exp) => sum + Number(exp.amount),
              0
            ) || 0;

            return {
              id: group.id,
              name: group.name,
              description: group.description,
              memberCount: memberCount || 0,
              totalExpenses,
            };
          })
      );

      setGroups(groupsData);
    }

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Groups</Text>
        <Pressable style={styles.addButton}>
          <Plus size={24} color="#1CC29F" />
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={64} color="#CCCCCC" />
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptyText}>
              Create a group to start splitting expenses with friends
            </Text>
            <Pressable style={styles.createButton}>
              <Text style={styles.createButtonText}>Create Group</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.groupList}>
            {groups.map((group) => (
              <Pressable key={group.id} style={styles.groupCard}>
                <View style={styles.groupIcon}>
                  <Users size={24} color="#1CC29F" />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  {group.description && (
                    <Text style={styles.groupDescription}>{group.description}</Text>
                  )}
                  <View style={styles.groupStats}>
                    <Text style={styles.groupStat}>
                      {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                    </Text>
                    <Text style={styles.groupStatDot}>•</Text>
                    <Text style={styles.groupStat}>
                      ${group.totalExpenses.toFixed(2)} total
                    </Text>
                  </View>
                </View>
              </Pressable>
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
    marginBottom: 32,
  },
  createButton: {
    backgroundColor: '#1CC29F',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  groupList: {
    padding: 16,
    gap: 12,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  groupIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F9F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  groupStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupStat: {
    fontSize: 13,
    color: '#999999',
  },
  groupStatDot: {
    fontSize: 13,
    color: '#999999',
    marginHorizontal: 6,
  },
});
