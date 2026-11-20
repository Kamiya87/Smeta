const STORAGE_KEY = 'smeta-data-v1';
const SERVICES_KEY = 'hse-service-names-v1';
const body = document.getElementById('items-body');
const discountInput = document.getElementById('discount');
const vatInput = document.getElementById('vat');
const estimateNumberInput = document.getElementById('estimate-number');
const estimateDateInput = document.getElementById('estimate-date');
const commentInput = document.getElementById('comment');
const currencyInput = document.getElementById('currency');
let items = [{ name: '', quantity: '', price: '' }];
let services = [];
let copyFeedbackTimer;

function loadServices() {
  try {
    const saved = JSON.parse(localStorage.getItem(SERVICES_KEY));
    if (Array.isArray(saved)) {
      services = [...new Map(saved.filter(name => typeof name === 'string' && name.trim())
        .map(name => [name.trim().toLocaleLowerCase('ru'), name.trim()])).values()];
    }
  } catch (_) { services = []; }
}

function rememberService(name) {
  const value = String(name ?? '').trim();
  if (!value) return;
  const key = value.toLocaleLowerCase('ru');
  const index = services.findIndex(service => service.toLocaleLowerCase('ru') === key);
  if (index >= 0) services[index] = value;
  else services.push(value);
  try { localStorage.setItem(SERVICES_KEY, JSON.stringify(services)); } catch (_) { /* Keep suggestions for this session. */ }
}

function showSuggestions(row) {
  const input = row.querySelector('.item-name');
  const list = row.querySelector('.service-suggestions');
  const prefix = input.value.trim().toLocaleLowerCase('ru');
  list.replaceChildren();
  if (prefix) {
    services.filter(service => service.toLocaleLowerCase('ru').startsWith(prefix)
      && service.toLocaleLowerCase('ru') !== prefix).forEach(service => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'suggestion-button';
      button.textContent = service;
      list.append(button);
    });
  }
  list.hidden = !list.childElementCount;
}

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
  return `${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸`;
}

function unitPrice(value) {
  const [integer, fractional] = String(numberOrZero(value)).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped}${fractional ? `,${fractional}` : ''} ₸`;
}

function amountInWords(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 999999999) return '';
  const units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const feminineUnits = ['', 'одна', 'две', ...units.slice(3)];
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  const parts = [];

  function addGroup(number, feminine, forms) {
    if (!number) return;
    parts.push(hundreds[Math.floor(number / 100)]);
    const remainder = number % 100;
    if (remainder >= 10 && remainder < 20) parts.push(teens[remainder - 10]);
    else {
      parts.push(tens[Math.floor(remainder / 10)]);
      parts.push((feminine ? feminineUnits : units)[remainder % 10]);
    }
    if (forms) {
      const last = remainder >= 10 && remainder < 20 ? 0 : remainder % 10;
      parts.push(forms[last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2]);
    }
  }

  addGroup(Math.floor(value / 1000000), false, ['миллион', 'миллиона', 'миллионов']);
  addGroup(Math.floor(value / 1000) % 1000, true, ['тысяча', 'тысячи', 'тысяч']);
  addGroup(value % 1000, false);
  const words = parts.filter(Boolean).join(' ');
  return `${words[0].toUpperCase()}${words.slice(1)} тенге`;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      items,
      discount: discountInput.value,
      vat: vatInput.value,
      estimateNumber: estimateNumberInput.value,
      estimateDate: estimateDateInput.value,
      comment: commentInput.value
    }));
  } catch (_) { /* The calculator remains usable when browser storage is unavailable. */ }
}

function updatePrintDocument() {
  const [year, month, day] = estimateDateInput.value.split('-');
  const date = year && month && day ? `${day}.${month}.${year}` : '';
  document.getElementById('print-title').textContent = `Коммерческое предложение № ${estimateNumberInput.value.trim() || '—'}${date ? ` от ${date}` : ''}`;
  document.getElementById('print-comment').textContent = commentInput.value;
  save();
}

function newEstimate() {
  if (!window.confirm('Создать новое коммерческое предложение? Текущий черновик будет очищен.')) return;
  items.forEach(item => rememberService(item.name));
  const currentNumber = Number(estimateNumberInput.value.trim());
  estimateNumberInput.value = Number.isSafeInteger(currentNumber) && currentNumber >= 0 && currentNumber < Number.MAX_SAFE_INTEGER
    ? String(currentNumber + 1) : '1';
  estimateDateInput.value = todayDate();
  commentInput.value = '';
  discountInput.value = '0';
  vatInput.value = '16';
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
    const amount = money(Math.round(numberOrZero(item.quantity) * numberOrZero(item.price)));
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
  const amountWordsRow = document.getElementById('amount-words-row');
  if (!amountWordsRow.hidden) lines.push(`Сумма прописью: ${document.getElementById('amount-words').textContent}`);
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
    subtotal += safeAmount;
  });
  if (!Number.isFinite(subtotal)) subtotal = 0;

  const discount = Math.round(subtotal * percentOrZero(discountInput.value, 100) / 100);
  const discounted = subtotal - discount;
  const total = discounted;
  const vatRate = percentOrZero(vatInput.value);
  const vat = Math.round(total * (vatRate / (100 + vatRate)));
  document.getElementById('subtotal').textContent = money(subtotal);
  document.getElementById('discount-amount').textContent = money(discount);
  document.getElementById('discounted-total').textContent = money(discounted);
  document.getElementById('vat-amount').textContent = money(vat);
  document.getElementById('grand-total').textContent = money(total);
  const amountWords = document.getElementById('amount-words');
  const currency = currencyInput?.value ?? '₸';
  const words = currency === '₸' || currency === 'KZT' ? amountInWords(Math.round(total)) : '';
  amountWords.textContent = words;
  document.getElementById('amount-words-row').hidden = !words;
  document.getElementById('discount-row').hidden = discount === 0;
  document.getElementById('discounted-row').hidden = discounted === 0;
  document.getElementById('vat-row').hidden = vat === 0;
  renderPrintTable();
  save();
}

function renderPrintTable() {
  const rows = items.map(item => {
    const row = document.createElement('tr');
    for (const value of [item.name, item.quantity, unitPrice(item.price)]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  });
  document.getElementById('print-items-body').replaceChildren(...rows);
}

function preparePrint() {
  [...body.rows].forEach((row, index) => {
    const name = row.querySelector('.item-name').value;
    const quantity = row.querySelector('.item-quantity').value;
    const price = row.querySelector('.item-price').value;
    items[index] = { name, quantity, price };
    row.querySelector('.print-name').textContent = name;
    row.querySelector('.print-quantity').textContent = quantity;
    row.querySelector('.print-price').textContent = unitPrice(price);
  });
  calculate();
  updatePrintDocument();
}

function addRow(item) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td class="name"><label>Наименование</label><input class="item-name" type="text" aria-label="Наименование позиции" autocomplete="off"><div class="service-suggestions" aria-label="Подходящие услуги" hidden></div><span class="print-cell print-name"></span></td>
    <td><label>Количество</label><input class="item-quantity" type="text" inputmode="decimal" aria-label="Количество"><span class="print-cell print-quantity"></span></td>
    <td><label class="mobile-price-label">Цена, ₸</label><div class="price-field"><input class="item-price" type="text" inputmode="decimal" aria-label="Цена, тенге"><span class="price-currency" aria-hidden="true">₸</span></div><span class="print-cell print-price"></span></td>
    <td class="actions"><button class="remove-button secondary" type="button" aria-label="Удалить позицию">×</button></td>`;
  row.querySelector('.item-name').value = item.name;
  row.querySelector('.item-quantity').value = item.quantity;
  row.querySelector('.item-price').value = item.price;
  row.querySelector('.print-name').textContent = item.name;
  row.querySelector('.print-quantity').textContent = item.quantity;
  row.querySelector('.print-price').textContent = unitPrice(item.price);
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
    vatInput.value = String(stored.vat ?? '16');
    estimateNumberInput.value = String(stored.estimateNumber ?? '1');
    if (typeof stored.estimateDate === 'string') estimateDateInput.value = stored.estimateDate;
    commentInput.value = String(stored.comment ?? '');
  } catch (_) { /* Ignore invalid saved data. */ }
}

body.addEventListener('input', event => {
  const row = event.target.closest('tr');
  if (!row) return;
  const index = [...body.rows].indexOf(row);
  if (event.target.classList.contains('item-name')) {
    items[index].name = event.target.value;
    showSuggestions(row);
  }
  if (event.target.classList.contains('item-quantity')) items[index].quantity = event.target.value;
  if (event.target.classList.contains('item-price')) items[index].price = event.target.value;
  row.querySelector('.print-name').textContent = items[index].name;
  row.querySelector('.print-quantity').textContent = items[index].quantity;
  row.querySelector('.print-price').textContent = unitPrice(items[index].price);
  calculate();
});

body.addEventListener('focusin', event => {
  if (event.target.classList.contains('item-name')) showSuggestions(event.target.closest('tr'));
});

body.addEventListener('focusout', event => {
  const row = event.target.closest('tr');
  if (!row) return;
  const list = row.querySelector('.service-suggestions');
  if (event.target.classList.contains('item-name') && !list.contains(event.relatedTarget)) {
    rememberService(event.target.value);
    list.hidden = true;
  }
  if (event.target.classList.contains('suggestion-button') && !list.contains(event.relatedTarget)) {
    list.hidden = true;
  }
  if (!row.contains(event.relatedTarget)) list.hidden = true;
});

body.addEventListener('keydown', event => {
  if (event.target.classList.contains('item-name') && event.key === 'ArrowDown') {
    const first = event.target.closest('tr').querySelector('.suggestion-button');
    if (first) { event.preventDefault(); first.focus(); }
  } else if (event.target.classList.contains('suggestion-button')) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.target.closest('tr').querySelector('.service-suggestions').hidden = true;
      event.target.closest('tr').querySelector('.item-name').focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const buttons = [...event.target.parentElement.querySelectorAll('.suggestion-button')];
      const index = buttons.indexOf(event.target);
      const next = buttons[index + (event.key === 'ArrowDown' ? 1 : -1)];
      if (next) { event.preventDefault(); next.focus(); }
    }
  }
});

body.addEventListener('click', event => {
  const suggestion = event.target.closest('.suggestion-button');
  if (suggestion) {
    const row = suggestion.closest('tr');
    const index = [...body.rows].indexOf(row);
    items[index].name = suggestion.textContent;
    row.querySelector('.item-name').value = suggestion.textContent;
    row.querySelector('.print-name').textContent = suggestion.textContent;
    row.querySelector('.service-suggestions').hidden = true;
    calculate();
    row.querySelector('.item-name').focus();
    return;
  }
  if (!event.target.classList.contains('remove-button')) return;
  const row = event.target.closest('tr');
  const index = [...body.rows].indexOf(row);
  rememberService(items[index].name);
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
document.getElementById('clear-button').addEventListener('click', () => {
  items = [{ name: '', quantity: '', price: '' }];
  body.replaceChildren();
  addRow(items[0]);
  calculate();
  body.querySelector('.item-name').focus();
});
discountInput.addEventListener('input', calculate);
vatInput.addEventListener('input', calculate);
currencyInput?.addEventListener('change', calculate);
for (const field of [estimateNumberInput, estimateDateInput, commentInput]) {
  field.addEventListener('input', updatePrintDocument);
}
estimateDateInput.addEventListener('change', updatePrintDocument);
document.getElementById('print-button').addEventListener('click', () => {
  preparePrint();
  window.print();
});
window.addEventListener('beforeprint', preparePrint);
document.getElementById('new-button').addEventListener('click', newEstimate);
document.getElementById('copy-button').addEventListener('click', copyForWhatsApp);

restore();
loadServices();
items.forEach(item => rememberService(item.name));
items.forEach(addRow);
calculate();
updatePrintDocument();
