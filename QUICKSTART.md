# Quick Start Guide

## Setup

1. Navigate to the mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
npm install
```

3. Start the app:
```bash
npm start
```

## Running on Devices

### iOS (Mac only)
```bash
npm run ios
```

### Android
```bash
npm run android
```

### Web (for testing)
```bash
npm run web
```

## Features Overview

### Dashboard (Home Tab)
- View current month's balance, income, and expenses
- Navigate between months using arrow buttons
- See savings rate percentage
- Long-press on an expense to edit it
- Tap the × button to delete an expense
- Tap the + button to add a new expense

### Analytics Tab
- View spending breakdown by category (pie chart)
- Track budget progress for each category
- See which categories are over/under budget with color-coded progress bars

### Settings Tab
- **Monthly Income**: Set your income for the current month
- **Currency**: Choose from USD, EUR, GBP, JPY, INR, CAD, AUD
- **Manage Accounts**: 
  - Add new accounts (Checking, Savings, Credit Card, Cash)
  - Rename existing accounts
  - Archive/Unarchive accounts
- **Manage Categories**: 
  - Add custom categories
  - Set budget limits for each category
  - Delete categories
- **Data Management**:
  - Export all data as JSON
  - Reset current month (deletes all income and expenses for the month)

## Tips

- All data is stored locally on your device
- Recurring expenses are automatically carried over to new months
- You can have multiple accounts and track them separately
- Budget progress bars turn yellow at 75% and red at 100%

## Troubleshooting

If you encounter any issues:

1. Clear the cache:
```bash
npm start -- --clear
```

2. Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

3. Reset Expo:
```bash
npx expo start -c
```
