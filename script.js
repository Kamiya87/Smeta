const STORAGE_KEY = 'smeta-data-v1';
const body = document.getElementById('items-body');
const discountInput = document.getElementById('discount');
const vatInput = document.getElementById('vat');
const currencySelect = document.getElementById('currency');
let items = [{ name: '', quantity: '', price: '' }];

function numberOrZero(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (text === '') return 0;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function percentOrZero(value, maximum = Infinity) {
  const number = numberOrZero(value);
  return number <= maximum ? number : 0;
}

function money(value) {
  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  return `${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${currencySelect.value}`;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      items,
      discount: discountInput.value,
      vat: vatInput.value,
      currency: currencySelect.value
    }));
  } catch (_) { /* The calculator remains usable when browser storage is unavailable. */ }
}

function calculate() {
  let subtotal = 0;
  [...body.rows].forEach((row, index) => {
    const item = items[index];
    const amount = Math.round(numberOrZero(item.quantity) * numberOrZero(item.price));
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    row.querySelector('.amount').textContent = money(safeAmount);
    subtotal += safeAmount;
  });
  if (!Number.isFinite(subtotal)) subtotal = 0;

  const discount = Math.round(subtotal * percentOrZero(discountInput.value, 100) / 100);
  const discounted = subtotal - discount;
  const vat = Math.round(discounted * percentOrZero(vatInput.value) / 100);
  const total = discounted + vat;
  document.getElementById('subtotal').textContent = money(subtotal);
  document.getElementById('discount-amount').textContent = money(discount);
  document.getElementById('discounted-total').textContent = money(discounted);
  document.getElementById('vat-amount').textContent = money(vat);
  document.getElementById('grand-total').textContent = money(total);
  document.getElementById('discount-row').hidden = discount === 0;
  document.getElementById('discounted-row').hidden = discounted === 0;
  document.getElementById('vat-row').hidden = vat === 0;
  save();
}

function addRow(item) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td class="name"><label>Наименование</label><input class="item-name" type="text" aria-label="Наименование позиции"></td>
    <td><label>Количество</label><input class="item-quantity" type="text" inputmode="decimal" aria-label="Количество"></td>
    <td><label>Цена</label><input class="item-price" type="text" inputmode="decimal" aria-label="Цена"></td>
    <td class="amount">0 ₸</td>
    <td class="actions"><button class="remove-button secondary" type="button" aria-label="Удалить позицию">×</button></td>`;
  row.querySelector('.item-name').value = item.name;
  row.querySelector('.item-quantity').value = item.quantity;
  row.querySelector('.item-price').value = item.price;
  body.append(row);
}

function restore() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== 'object') return;
    if (Array.isArray(stored.items) && stored.items.length) {
      items = stored.items.filter(item => item && typeof item === 'object').map(item => ({
        name: String(item.name ?? ''),
        quantity: String(item.quantity ?? ''),
        price: String(item.price ?? '')
      }));
      if (!items.length) items = [{ name: '', quantity: '', price: '' }];
    }
    discountInput.value = String(stored.discount ?? '0');
    vatInput.value = String(stored.vat ?? '0');
    if ([...currencySelect.options].some(option => option.value === stored.currency)) {
      currencySelect.value = stored.currency;
    }
  } catch (_) { /* Ignore invalid saved data. */ }
}

body.addEventListener('input', event => {
  const row = event.target.closest('tr');
  if (!row) return;
  const index = [...body.rows].indexOf(row);
  if (event.target.classList.contains('item-name')) items[index].name = event.target.value;
  if (event.target.classList.contains('item-quantity')) items[index].quantity = event.target.value;
  if (event.target.classList.contains('item-price')) items[index].price = event.target.value;
  calculate();
});

body.addEventListener('click', event => {
  if (!event.target.classList.contains('remove-button')) return;
  const row = event.target.closest('tr');
  const index = [...body.rows].indexOf(row);
  items.splice(index, 1);
  row.remove();
  if (!items.length) {
    items.push({ name: '', quantity: '', price: '' });
    addRow(items[0]);
  }
  calculate();
});

document.getElementById('add-button').addEventListener('click', () => {
  const item = { name: '', quantity: '', price: '' };
  items.push(item);
  addRow(item);
  calculate();
  body.lastElementChild.querySelector('.item-name').focus();
});
discountInput.addEventListener('input', calculate);
vatInput.addEventListener('input', calculate);
currencySelect.addEventListener('change', calculate);
document.getElementById('print-button').addEventListener('click', () => window.print());

restore();
items.forEach(addRow);
calculate();
