import AsyncStorage from '@react-native-async-storage/async-storage';
import { BudgetState } from './types';

const STORAGE_KEY = "budgetapp:data:v1";
const CURRENT_VERSION = 3;

export const DEFAULT_CATEGORIES = [
  "Groceries", "Rent/Mortgage", "Utilities", "Dining", "Transport",
  "Health", "Shopping", "Subscriptions", "Travel", "Other"
];

export const formatMonthKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

export const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getDefaultState = (): BudgetState => ({
  version: CURRENT_VERSION,
  currentMonth: formatMonthKey(new Date()),
  activeAccountId: 1,
  accounts: [
    {
      id: 1,
      name: "Main",
      type: "Checking",
      archived: false,
      createdAt: Date.now(),
      categories: [...DEFAULT_CATEGORIES],
    },
  ],
  months: {},
  currency: "USD",
});

export const AppStorage = {
  async load(): Promise<BudgetState> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return getDefaultState();
      }
      const parsed = JSON.parse(raw);
      
      if (!parsed.accounts) {
          return getDefaultState();
      }

      parsed.accounts.forEach((acct: any) => {
          if (!acct.categories) {
              acct.categories = parsed.categories || [...DEFAULT_CATEGORIES];
          }
      });

      if (parsed.months) {
          Object.keys(parsed.months).forEach(monthKey => {
              const mData = parsed.months[monthKey];
              if (mData.accounts) {
                  Object.keys(mData.accounts).forEach(acctId => {
                      if (!mData.accounts[acctId].categoryBudgets) {
                          mData.accounts[acctId].categoryBudgets = parsed.categoryBudgets || {};
                      }
                  });
              }
          });
      }

      delete parsed.categories;
      delete parsed.categoryBudgets;
      
      return parsed as BudgetState;
    } catch (e) {
      console.error("Failed to load storage", e);
      return getDefaultState();
    }
  },

  async save(state: BudgetState): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save storage", e);
    }
  },
  
  async clear(): Promise<void> {
      await AsyncStorage.removeItem(STORAGE_KEY);
  }
};
