class UI {
  constructor() {
    this.budgetFeedback = document.querySelector(".budget-feedback");
    this.expenseFeedback = document.querySelector(".expense-feedback");
    this.budgetForm = document.getElementById("budget-form");
    this.budgetInput = document.getElementById("budget-input");
    this.budgetAmount = document.getElementById("budget-amount");
    this.expenseAmount = document.getElementById("expense-amount");
    this.balance = document.getElementById("balance");
    this.balanceAmount = document.getElementById("balance-amount");
    this.expenseForm = document.getElementById("expense-form");
    this.expenseInput = document.getElementById("expense-input");
    this.amountInput = document.getElementById("amount-input");
    this.expenseList = document.getElementById("expense-list");
    this.itemList = [];
    this.itemID = 0;
  }

  // submit budget method
  submitBudgetForm() {
    const value = this.budgetInput.value;
    if (value === '' || value < 0) {
      this.budgetFeedback.classList.add('showItem');
      this.budgetFeedback.innerHTML = `<p>Value cannot be empty or negative</p>`;
      const self = this;
      setTimeout(function () {
        self.budgetFeedback.classList.remove('showItem');
      }, 2500);
    } else {
      this.budgetAmount.textContent = value;
      this.budgetInput.value = '';
      this.showBalance();
    }
  }

  // show Balance
  showBalance() {
    const expense = this.totalExpense();
    const total = parseInt(this.budgetAmount.textContent) - expense;
    this.balanceAmount.textContent = total;
    if (total < 0) {
      this.balance.classList.remove('showGreen', 'showBlack');
      this.balance.classList.add('showRed');
    } else if (total === 0) {
      this.balance.classList.remove('showGreen', 'showRed');
      this.balance.classList.add('showBlack');
    } else {
      this.balance.classList.remove('showRed', 'showBlack');
      this.balance.classList.add('showGreen');
    }
  }

  // total expense
  totalExpense() {
    let total = 0;
    if (this.itemList.length > 0) {
      total = this.itemList.reduce(function (acc, curr) {
        acc += curr.amount;
        return acc;
      }, 0);
    }
    this.expenseAmount.textContent = total;
    return total;
  }

  // submit Expense form
  submitExpenseForm() {
    const expense = this.expenseInput.value;
    const amount = this.amountInput.value;

    if (expense === '' || amount === '' || amount < 0) {
      this.expenseFeedback.classList.add('showItem');
      this.expenseFeedback.innerHTML = `<p>Values cannot be empty or negative</p>`;
      const self = this;
      setTimeout(function () {
        self.expenseFeedback.classList.remove('showItem');
      }, 2500);
    } else {
      let amnt = parseInt(amount);
      this.expenseInput.value = '';
      this.amountInput.value = '';
      let expns = {
        id: this.itemID,
        title: expense,
        amount: amnt
      };
      this.itemID++;
      this.itemList.push(expns);
      this.addExpense(expns);
      this.showBalance();
    }
  }

  // add expense
  addExpense(expense) {
    const div = document.createElement('div');
    div.classList.add('expense');
    div.innerHTML = `<div class="expense-item d-flex justify-content-between align-items-baseline">

    <h6 class="expense-title mb-0 text-uppercase list-item">- ${expense.title}</h6>
    <h5 class="expense-amount mb-0 list-item">${expense.amount}</h5>

    <div class="expense-icons list-item">

     <a href="#" class="edit-icon mx-2" data-id="${expense.id}">
      <i class="fas fa-edit"></i>
     </a>
     <a href="#" class="delete-icon" data-id="${expense.id}">
      <i class="fas fa-trash"></i>
     </a>
    </div>
   </div>
`;
    this.expenseList.appendChild(div);
  }

  // edit expense
  editExpense(element) {
    let id = parseInt(element.dataset.id);
    let parent = element.parentElement.parentElement.parentElement;

    // remove from dom
    this.expenseList.removeChild(parent);
    //remove item from list
    let expense = this.itemList.filter(function (item) {
      return item.id === id;
    });

    let itemListTemp = this.itemList.filter(function (item) {
      return item.id !== id;
    });

    this.itemList = itemListTemp;
    this.showBalance();

    // show values in expense form
    this.expenseInput.value = expense[0].title;
    this.amountInput.value = expense[0].amount;

  }

  deleteExpense(element) {
    this.editExpense(element);
    this.expenseInput.value = '';
    this.amountInput.value = '';
  }
}

function eventListeners() {

  const budgetForm = document.getElementById('budget-form');
  const expenseForm = document.getElementById('expense-form');
  const expenseList = document.getElementById('expense-list');

  // new instance of UI class
  const ui = new UI();

  // budget form submit
  budgetForm.addEventListener('submit', function (event) {

    event.preventDefault();
    ui.submitBudgetForm();
  });

  // expense form submit
  expenseForm.addEventListener('submit', function (event) {

    event.preventDefault();
    ui.submitExpenseForm();
  });
  // expense list click
  expenseList.addEventListener('click', function (event) {
    if (event.target.parentElement.classList.contains('edit-icon')) {
      ui.editExpense(event.target.parentElement);
    } else if (event.target.parentElement.classList.contains('delete-icon')) {
      ui.deleteExpense(event.target.parentElement);
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  eventListeners();
});