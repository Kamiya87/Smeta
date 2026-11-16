const STORAGE_KEY = 'smeta-data-v1';
const body = document.getElementById('items-body');
const discountInput = document.getElementById('discount');
const vatInput = document.getElementById('vat');
const currencySelect = document.getElementById('currency');
const estimateNumberInput = document.getElementById('estimate-number');
const estimateDateInput = document.getElementById('estimate-date');
const supplierInput = document.getElementById('supplier-details');
const customerInput = document.getElementById('customer-details');
const commentInput = document.getElementById('comment');
let items = [{ name: '', quantity: '', price: '' }];
let copyFeedbackTimer;

function todayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
estimateDateInput.value = todayDate();

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

function unitPrice(value) {
  const [integer, fractional] = String(numberOrZero(value)).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped}${fractional ? `,${fractional}` : ''} ${currencySelect.value}`;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      items,
      discount: discountInput.value,
      vat: vatInput.value,
      currency: currencySelect.value,
      estimateNumber: estimateNumberInput.value,
      estimateDate: estimateDateInput.value,
      supplier: supplierInput.value,
      customer: customerInput.value,
      comment: commentInput.value
    }));
  } catch (_) { /* The calculator remains usable when browser storage is unavailable. */ }
}

function updatePrintDocument() {
  const [year, month, day] = estimateDateInput.value.split('-');
  const date = year && month && day ? `${day}.${month}.${year}` : '';
  document.getElementById('print-title').textContent = `Смета № ${estimateNumberInput.value.trim() || '—'}${date ? ` от ${date}` : ''}`;
  document.getElementById('print-supplier').textContent = supplierInput.value.trim() || '—';
  document.getElementById('print-customer').textContent = customerInput.value.trim() || '—';
  document.getElementById('print-comment').textContent = commentInput.value;
  save();
}

function newEstimate() {
  if (!window.confirm('Создать новую смету? Текущий черновик будет очищен.')) return;
  const currentNumber = Number(estimateNumberInput.value.trim());
  estimateNumberInput.value = Number.isSafeInteger(currentNumber) && currentNumber >= 0 && currentNumber < Number.MAX_SAFE_INTEGER
    ? String(currentNumber + 1) : '1';
  estimateDateInput.value = todayDate();
  supplierInput.value = '';
  customerInput.value = '';
  commentInput.value = '';
  discountInput.value = '0';
  vatInput.value = '0';
  currencySelect.value = '₸';
  items = [{ name: '', quantity: '', price: '' }];
  body.replaceChildren();
  addRow(items[0]);
  document.getElementById('manual-copy').hidden = true;
  document.getElementById('copy-feedback').textContent = '';
  clearTimeout(copyFeedbackTimer);
  calculate();
  updatePrintDocument();
  body.querySelector('.item-name').focus();
}

function shareText() {
  const lines = [document.getElementById('print-title').textContent];
  items.forEach((item, index) => {
    if (![item.name, item.quantity, item.price].some(value => String(value).trim())) return;
    const name = item.name.trim().replace(/\s+/g, ' ') || 'Без названия';
    const quantity = String(numberOrZero(item.quantity)).replace('.', ',');
    const price = unitPrice(item.price);
    const amount = body.rows[index].querySelector('.amount').textContent;
    lines.push(`• ${name} — ${quantity} шт × ${price} = ${amount}`);
  });
  lines.push(`Сумма: ${document.getElementById('subtotal').textContent}`);
  if (!document.getElementById('discount-row').hidden) {
    lines.push(`Скидка (${percentOrZero(discountInput.value, 100)} %): ${document.getElementById('discount-amount').textContent}`);
    lines.push(`Сумма со скидкой: ${document.getElementById('discounted-total').textContent}`);
  }
  if (!document.getElementById('vat-row').hidden) {
    lines.push(`НДС (${percentOrZero(vatInput.value)} %): ${document.getElementById('vat-amount').textContent}`);
  }
  lines.push(`Итого к оплате: ${document.getElementById('grand-total').textContent}`);
  return lines.join('\n');
}

async function copyForWhatsApp() {
  const text = shareText();
  const feedback = document.getElementById('copy-feedback');
  const manualCopy = document.getElementById('manual-copy');
  clearTimeout(copyFeedbackTimer);
  feedback.textContent = '';
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    manualCopy.hidden = true;
    feedback.textContent = 'Скопировано ✓';
    copyFeedbackTimer = setTimeout(() => { feedback.textContent = ''; }, 2000);
  } catch (_) {
    const copyText = document.getElementById('copy-text');
    copyText.value = text;
    manualCopy.hidden = false;
    copyText.focus();
    copyText.select();
  }
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
    <td class="name"><label>Наименование</label><input class="item-name" type="text" aria-label="Наименование позиции"><span class="print-cell print-name"></span></td>
    <td><label>Количество</label><input class="item-quantity" type="text" inputmode="decimal" aria-label="Количество"><span class="print-cell print-quantity"></span></td>
    <td><label>Цена</label><input class="item-price" type="text" inputmode="decimal" aria-label="Цена"><span class="print-cell print-price"></span></td>
    <td class="amount">0 ₸</td>
    <td class="actions"><button class="remove-button secondary" type="button" aria-label="Удалить позицию">×</button></td>`;
  row.querySelector('.item-name').value = item.name;
  row.querySelector('.item-quantity').value = item.quantity;
  row.querySelector('.item-price').value = item.price;
  row.querySelector('.print-name').textContent = item.name;
  row.querySelector('.print-quantity').textContent = item.quantity;
  row.querySelector('.print-price').textContent = item.price;
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
    estimateNumberInput.value = String(stored.estimateNumber ?? '1');
    if (typeof stored.estimateDate === 'string') estimateDateInput.value = stored.estimateDate;
    supplierInput.value = String(stored.supplier ?? '');
    customerInput.value = String(stored.customer ?? '');
    commentInput.value = String(stored.comment ?? '');
  } catch (_) { /* Ignore invalid saved data. */ }
}

body.addEventListener('input', event => {
  const row = event.target.closest('tr');
  if (!row) return;
  const index = [...body.rows].indexOf(row);
  if (event.target.classList.contains('item-name')) items[index].name = event.target.value;
  if (event.target.classList.contains('item-quantity')) items[index].quantity = event.target.value;
  if (event.target.classList.contains('item-price')) items[index].price = event.target.value;
  row.querySelector('.print-name').textContent = items[index].name;
  row.querySelector('.print-quantity').textContent = items[index].quantity;
  row.querySelector('.print-price').textContent = items[index].price;
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
for (const field of [estimateNumberInput, estimateDateInput, supplierInput, customerInput, commentInput]) {
  field.addEventListener('input', updatePrintDocument);
}
estimateDateInput.addEventListener('change', updatePrintDocument);
document.getElementById('print-button').addEventListener('click', () => window.print());
document.getElementById('new-button').addEventListener('click', newEstimate);
document.getElementById('copy-button').addEventListener('click', copyForWhatsApp);

restore();
items.forEach(addRow);
calculate();
updatePrintDocument();
