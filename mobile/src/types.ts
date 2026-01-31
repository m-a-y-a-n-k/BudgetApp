export interface Expense {
  id: number;
  title: string;
  amount: number;
  value: number;
  date: string;
  category: string[];
}

export interface AccountData {
  income: number;
  expenses: Expense[];
  categoryBudgets: {
    [category: string]: number;
  };
}

export interface MonthData {
  nextExpenseId: number;
  accounts: {
    [acctId: string]: AccountData;
  };
}

export interface Account {
  id: number;
  name: string;
  type: string;
  archived: boolean;
  createdAt: number;
  categories: string[];
}

export interface BudgetState {
  version: number;
  currentMonth: string;
  activeAccountId: number | 'all';
  accounts: Account[];
  months: {
    [monthKey: string]: MonthData;
  };
  currency: string;
}

export interface BudgetActions {
  addExpense: (expense: Omit<Expense, 'id' | 'value'>, acctId?: number) => Promise<void>;
  editExpense: (id: number, acctId: number, updatedExpense: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: number, acctId: number) => Promise<void>;
  setCurrency: (currency: string) => Promise<void>;
  setIncome: (amount: number, acctId?: number) => Promise<void>;
  addCategory: (name: string, acctId?: number) => Promise<void>;
  deleteCategory: (name: string, acctId?: number) => Promise<void>;
  setCategoryBudget: (category: string, amount: number, acctId?: number) => Promise<void>;
  setCategoryBudgets: (budgets: { [category: string]: number }, acctId?: number) => Promise<void>;
  addAccount: (name: string, type: string, initialBalance?: number) => Promise<void>;
  renameAccount: (id: number, newName: string) => Promise<void>;
  archiveAccount: (id: number, archived: boolean) => Promise<void>;
  changeMonth: (monthKey: string) => Promise<void>;
  switchAccount: (acctId: number | 'all') => Promise<void>;
  exportData: () => Promise<string | null>;
  resetMonth: () => Promise<void>;
  loadData: () => Promise<void>;
  setCurrentMonth: (monthKey: string) => void;
}

export interface UseBudgetDataReturn {
  state: BudgetState | null;
  loading: boolean;
  currentMonth: string;
  currencySymbol: string;
  actions: BudgetActions;
}
