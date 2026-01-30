# BudgetApp - React Native

A comprehensive budget tracking mobile application built with React Native and Expo.

## Features

- 📊 **Dashboard**: View your monthly income, expenses, and balance at a glance
- 📈 **Analytics**: Visualize spending by category with charts and budget progress tracking
- ⚙️ **Settings**: Manage categories, set category budgets, configure currency, and set monthly income
- 💰 **Multi-Account Support**: Track multiple accounts (checking, savings, etc.)
- 🔄 **Recurring Expenses**: Automatically carry over recurring expenses to new months
- 🌍 **Multi-Currency**: Support for USD, EUR, GBP, JPY, INR, CAD, AUD
- 📱 **Offline-First**: All data stored locally using AsyncStorage

## Project Structure

```
BudgetApp/
├── mobile/              # React Native app
│   ├── app/            # Expo Router screens
│   │   ├── (tabs)/    # Tab navigation screens
│   │   │   ├── index.tsx      # Dashboard
│   │   │   ├── analytics.tsx  # Analytics & Charts
│   │   │   └── settings.tsx   # Settings
│   │   └── modal.tsx  # Add expense modal
│   ├── src/
│   │   ├── hooks/     # Custom hooks (useBudgetData)
│   │   ├── storage.js # AsyncStorage wrapper
│   │   └── theme.js   # App theme & colors
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (installed automatically)
- iOS Simulator (for Mac) or Android Emulator

### Installation

1. Navigate to the mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Run on your preferred platform:
```bash
# iOS (Mac only)
npm run ios

# Android
npm run android

# Web (for testing)
npm run web
```

## Usage

### Dashboard
- View your current month's financial summary
- See recent transactions
- Tap the **+** button to add a new expense

### Add Expense
- Enter amount, description, date, and category
- Expenses are automatically saved to the current month

### Analytics
- View spending breakdown by category (pie chart)
- Track budget progress for each category
- See which categories are over/under budget

### Settings
- **Monthly Income**: Set your income for the current month
- **Currency**: Choose from 7 supported currencies
- **Categories**: Add, edit budgets, or delete custom categories

## Data Storage

All data is stored locally on your device using AsyncStorage. The app uses a versioned storage schema to ensure data integrity across updates.

### Storage Schema
```javascript
{
  version: 2,
  currentMonth: "2026-01",
  activeAccountId: 1,
  accounts: [...],
  months: {
    "2026-01": {
      nextExpenseId: 0,
      accounts: {
        "1": {
          income: 5000,
          expenses: [...]
        }
      }
    }
  },
  categories: [...],
  currency: "USD",
  categoryBudgets: {}
}
```

## Technologies Used

- **React Native** - Mobile framework
- **Expo** - Development platform
- **Expo Router** - File-based routing
- **AsyncStorage** - Local data persistence
- **React Native Chart Kit** - Data visualization
- **React Native SVG** - Chart rendering

## Development

### Project Commands

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in web browser
npm run lint       # Run ESLint
```

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the MIT License.
