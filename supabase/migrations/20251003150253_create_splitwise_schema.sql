/*
  # Splitwise App Database Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, references auth.users)
      - `email` (text)
      - `full_name` (text)
      - `avatar_url` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `groups`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text, optional)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `group_members`
      - `id` (uuid, primary key)
      - `group_id` (uuid, references groups)
      - `user_id` (uuid, references profiles)
      - `joined_at` (timestamp)
    
    - `expenses`
      - `id` (uuid, primary key)
      - `group_id` (uuid, references groups, optional for personal expenses)
      - `description` (text)
      - `amount` (numeric)
      - `currency` (text, default USD)
      - `paid_by` (uuid, references profiles)
      - `date` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `expense_splits`
      - `id` (uuid, primary key)
      - `expense_id` (uuid, references expenses)
      - `user_id` (uuid, references profiles)
      - `amount` (numeric)
      - `paid` (boolean, default false)
    
    - `settlements`
      - `id` (uuid, primary key)
      - `group_id` (uuid, references groups, optional)
      - `from_user` (uuid, references profiles)
      - `to_user` (uuid, references profiles)
      - `amount` (numeric)
      - `currency` (text, default USD)
      - `date` (timestamp)
      - `note` (text, optional)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated users to:
      - Read their own profile
      - Update their own profile
      - Read groups they are members of
      - Create groups
      - Add expenses to groups they belong to
      - View expenses in their groups
      - Create settlements
      - View settlements they're involved in
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text DEFAULT 'USD',
  paid_by uuid REFERENCES profiles(id) NOT NULL,
  date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create expense_splits table
CREATE TABLE IF NOT EXISTS expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid REFERENCES expenses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  paid boolean DEFAULT false
);

ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

-- Create settlements table
CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  from_user uuid REFERENCES profiles(id) NOT NULL,
  to_user uuid REFERENCES profiles(id) NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text DEFAULT 'USD',
  date timestamptz DEFAULT now(),
  note text,
  created_at timestamptz DEFAULT now(),
  CHECK (from_user != to_user)
);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can view profiles of group members"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm1
      INNER JOIN group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.id
    )
  );

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Groups policies
CREATE POLICY "Users can view groups they are members of"
  ON groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creators can update their groups"
  ON groups FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Group members policies
CREATE POLICY "Users can view members of their groups"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group creators can add members"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can remove themselves from groups"
  ON group_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Expenses policies
CREATE POLICY "Users can view expenses in their groups"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    group_id IS NULL AND paid_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = expenses.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    paid_by = auth.uid()
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM group_members
        WHERE group_members.group_id = expenses.group_id
        AND group_members.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Expense creator can update"
  ON expenses FOR UPDATE
  TO authenticated
  USING (paid_by = auth.uid())
  WITH CHECK (paid_by = auth.uid());

CREATE POLICY "Expense creator can delete"
  ON expenses FOR DELETE
  TO authenticated
  USING (paid_by = auth.uid());

-- Expense splits policies
CREATE POLICY "Users can view splits for expenses they're involved in"
  ON expense_splits FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_splits.expense_id
      AND expenses.paid_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM expenses
      INNER JOIN group_members ON expenses.group_id = group_members.group_id
      WHERE expenses.id = expense_splits.expense_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Expense payer can create splits"
  ON expense_splits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_splits.expense_id
      AND expenses.paid_by = auth.uid()
    )
  );

CREATE POLICY "Expense payer can update splits"
  ON expense_splits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_splits.expense_id
      AND expenses.paid_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_splits.expense_id
      AND expenses.paid_by = auth.uid()
    )
  );

-- Settlements policies
CREATE POLICY "Users can view settlements they're involved in"
  ON settlements FOR SELECT
  TO authenticated
  USING (
    from_user = auth.uid() OR to_user = auth.uid()
  );

CREATE POLICY "Users can create settlements they're paying"
  ON settlements FOR INSERT
  TO authenticated
  WITH CHECK (
    from_user = auth.uid()
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM group_members
        WHERE group_members.group_id = settlements.group_id
        AND group_members.user_id = auth.uid()
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user_id ON expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_from_user ON settlements(from_user);
CREATE INDEX IF NOT EXISTS idx_settlements_to_user ON settlements(to_user);
CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON settlements(group_id);
