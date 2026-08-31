const API_URL = "https://script.google.com/macros/s/AKfycbyyun_QUMFygjjOUbPLLE9mJJQdLGOXPV8OvXlh-JM8Napr4Cx8tBRccHMlSCZ_vvBb/exec";

let globalRecords = [];
let currentTransaction = null;
let autoUpdateTimeout; 
let sessionInterval;
let allBanksList = [];

let currentFilter = 'All';
let searchQuery = '';
let currentPage = 1;
const itemsPerPage = 10;

window.onload = function() {
  const authExpiry = localStorage.getItem('auth_expiry');
  const now = new Date().getTime();
  if (!authExpiry || now >= parseInt(authExpiry)) {
    window.location.href = "login.html";
    return;
  }
  startSessionTimer(parseInt(authExpiry));
  loadData(false);
  preloadBanksFromVietQR();
};

function startSessionTimer(expiryTime) {
  clearInterval(sessionInterval);
  const timeDisplay = document.getElementById('timeRemaining');
  function updateTimer() {
    const now = new Date().getTime();
    const distance = expiryTime - now;
    if (distance <= 0) {
      clearInterval(sessionInterval);
      logout(); 
      return;
    }
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    timeDisplay.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  updateTimer(); 
  sessionInterval = setInterval(updateTimer, 1000);
}

function logout() {
  localStorage.removeItem('auth_expiry');
  window.location.href = "login.html";
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const authExpiry = localStorage.getItem('auth_expiry');
    if (!authExpiry || new Date().getTime() >= parseInt(authExpiry)) logout();
  }
});

// ----------------------------------------------------
// LOGIC QUẢN LÝ NGÂN HÀNG (VIETQR API + GOOGLE SHEET)
// ----------------------------------------------------
function preloadBanksFromVietQR() {
  fetch('https://api.vietqr.io/v2/banks')
    .then(res => res.json())
    .then(data => {
      if(data.code === '00') allBanksList = data.data;
    }).catch(() => {});
}

function removeVietnameseTones(str) {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a"); 
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e"); 
  str = str.replace(/ì|í|ị|ỉ|ĩ/g,"i"); 
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o"); 
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u"); 
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,"y"); 
  str = str.replace(/đ/g,"d");
  return str.toUpperCase();
}

function formatOwnerName(el) {
  let pos = el.selectionStart;
  el.value = removeVietnameseTones(el.value);
  el.setSelectionRange(pos, pos);
}

function openBankManager() {
  document.querySelectorAll('#mainModal .add-view, #mainModal .receipt-view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-bank-mgr').classList.add('active');
  document.getElementById('mainModal').classList.add('active');
  loadBankAccounts();
}

function loadBankAccounts() {
  const tbody = document.getElementById('bankTableBody');
  tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Đang tải dữ liệu...</td></tr>`;

  fetch(`${API_URL}?action=getBanks&t=${new Date().getTime()}`)
    .then(res => res.json())
    .then(res => {
      if(!res.success || res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:20px;">Chưa có tài khoản nào</td></tr>`;
        return;
      }
      tbody.innerHTML = '';
      res.data.forEach(bk => {
        const bankObj = allBanksList.find(b => b.bin === bk.bin || b.shortName === bk.bankName);
        const logoUrl = bankObj ? bankObj.logo : 'https://img.icons8.com/fluency/48/bank.png';
        const isActive = bk.status.includes('dùng');

        tbody.innerHTML += `
          <tr>
            <td>
              <img src="${logoUrl}" class="bank-logo-mini">
              <span>${bk.bankName}</span>
            </td>
            <td>
              <span class="mono">${bk.accNumber}</span><br>
              <small style="color:var(--text-muted); font-size:11px;">${bk.accOwner}</small>
            </td>
            <td>
              <span class="bank-badge ${isActive ? 'active' : 'inactive'}" onclick="setActiveBank('${bk.id}')">
                ${isActive ? 'Đang dùng' : 'Chọn dùng'}
              </span>
            </td>
          </tr>`;
      });
    });
}

function setActiveBank(bankId) {
  fetch(`${API_URL}?action=setActiveBank&id=${bankId}&t=${new Date().getTime()}`)
    .then(res => res.json())
    .then(res => {
      showToast(res.message);
      loadBankAccounts();
    });
}

function openBankForm() {
  document.querySelectorAll('#mainModal .add-view, #mainModal .receipt-view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-bank-form').classList.add('active');
}

function toggleBankList() {
  const dropdown = document.getElementById('bankDropdownList');
  dropdown.classList.toggle('show');

  if(dropdown.children.length === 0 && allBanksList.length > 0) {
    dropdown.innerHTML = '';
    allBanksList.forEach(b => {
      const item = document.createElement('div');
      item.className = 'bank-item';
      item.innerHTML = `<img src="${b.logo}"><span><b>${b.shortName}</b> - ${b.name}</span>`;
      item.onclick = () => {
        document.getElementById('bankBinInput').value = b.bin;
        document.getElementById('bankNameInput').value = b.shortName;
        document.getElementById('selectedBankName').innerText = b.shortName;
        const img = document.getElementById('selectedBankLogo');
        img.src = b.logo;
        img.style.display = 'block';
        dropdown.classList.remove('show');
      };
      dropdown.appendChild(item);
    });
  }
}

function saveBankConfig() {
  const bin = document.getElementById('bankBinInput').value;
  const name = document.getElementById('bankNameInput').value;
  const acc = document.getElementById('bankAccInput').value.trim();
  const owner = document.getElementById('bankOwnerInput').value.trim();
  const btn = document.getElementById('btnSaveBank');
  const loader = document.getElementById('loaderSaveBank');

  if (!bin || !acc || !owner) {
    showToast("Vui lòng điền đủ thông tin!");
    return;
  }

  btn.style.display = 'none';
  loader.style.display = 'block';

  fetch(`${API_URL}?action=addBank&bankName=${encodeURIComponent(name)}&bin=${encodeURIComponent(bin)}&accNumber=${encodeURIComponent(acc)}&accOwner=${encodeURIComponent(owner)}&t=${new Date().getTime()}`)
    .then(res => res.json())
    .then(res => {
      btn.style.display = 'block';
      loader.style.display = 'none';
      if(res.success) {
        showToast("Đã lưu ngân hàng vào Sheet!");
        openBankManager();
      } else {
        showToast("Lỗi: " + res.message);
      }
    });
}

// ----------------------------------------------------
// XỬ LÝ DỮ LIỆU GIAO DỊCH
// ----------------------------------------------------
function formatCurrency(val) { 
  if (!val || val == 0 || val === "0") return "";
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); 
}

function formatInput(el) {
  let raw = el.value.replace(/[^0-9]/g, '');
  el.value = raw ? (parseInt(raw, 10) === 0 ? '' : formatCurrency(parseInt(raw, 10))) : '';
}

function adjustAmount(step) {
  const input = document.getElementById('amount');
  let currentVal = parseInt(input.value.replace(/\./g, ''), 10) || 0;
  let newVal = Math.min(Math.max(currentVal + step, 2000), 2000000000);
  input.value = formatCurrency(newVal);
}

function getRawAmount() {
  return parseInt(document.getElementById('amount').value.replace(/\./g, ''), 10) || 0;
}

function onSearchInput() {
  searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();
  currentPage = 1; 
  renderDeckView(globalRecords);
}

function setFilter(filterType, btnEl) {
  currentFilter = filterType; 
  currentPage = 1; 
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  btnEl.classList.add('active'); 
  renderDeckView(globalRecords);
}

function changePage(direction) {
  currentPage += direction; 
  renderDeckView(globalRecords);
}

function loadData(isSilent = false) {
  fetch(`${API_URL}?action=get&t=${new Date().getTime()}`)
    .then(res => res.json())
    .then(res => {
      if (!res.success) return;
      globalRecords = res.data;
      renderDeckView(globalRecords);
      checkAndAutoUpdateModal(globalRecords);
      autoUpdateTimeout = setTimeout(() => loadData(true), 2000);
    })
    .catch(() => {
      autoUpdateTimeout = setTimeout(() => loadData(true), 5000);
    });
}

function renderDeckView(records) {
  const container = document.getElementById('deckView');
  if(!records || records.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px; font-size: 14px;">Chưa có giao dịch nào</div>';
    document.getElementById('pageInfo').innerText = '1 / 1'; 
    return;
  }

  let filtered = records;
  if (currentFilter !== 'All') filtered = filtered.filter(r => r.status && r.status.includes(currentFilter));
  if (searchQuery) filtered = filtered.filter(r => r.id && r.id.toLowerCase().includes(searchQuery));

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px; font-size: 14px;">Không tìm thấy kết quả</div>';
    document.getElementById('pageInfo').innerText = '1 / 1';
    document.getElementById('prevBtn').disabled = true; 
    document.getElementById('nextBtn').disabled = true;
    return;
  }

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);

  document.getElementById('pageInfo').innerText = `${currentPage} / ${totalPages}`;
  document.getElementById('prevBtn').disabled = (currentPage === 1);
  document.getElementById('nextBtn').disabled = (currentPage === totalPages);

  const startIdx = (currentPage - 1) * itemsPerPage;
  const currentSlice = filtered.slice(startIdx, startIdx + itemsPerPage);

  container.innerHTML = '';
  currentSlice.forEach((record) => {
    const originalIndex = globalRecords.indexOf(record);
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = () => openModal(originalIndex);
    
    let stClass = record.status.includes('Chờ') ? 'pending' : (record.status.includes('Đã') ? 'success' : 'failed');
    let stText = record.status.includes('Chờ') ? 'Đang xử lí' : (record.status.includes('Đã') ? 'Hoàn tất' : 'Thất bại');

    card.innerHTML = `
      <div class="card-left">
        <div class="card-info">
          <div class="card-id-wrap">
            <span class="card-id">#${record.id}</span>
            <button class="icon-copy-mini" onclick="event.stopPropagation(); copyDirect('${record.id}')">
              <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
          <span class="card-time">${record.time || '---'}</span>
        </div>
      </div>
      <div class="card-right">
        <div class="card-amount">${formatCurrency(record.amount)}</div>
        <div class="status-text ${stClass}">${stText}</div>
      </div>`;
    container.appendChild(card);
  });
}

function openAddModal() {
  document.querySelectorAll('#mainModal .add-view, #mainModal .receipt-view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-add').classList.add('active');
  document.getElementById('message').innerHTML = ''; 
  document.getElementById('mainModal').classList.add('active');
}

function submitForm() {
  const amount = getRawAmount();
  const msgDiv = document.getElementById('message');
  const btn = document.getElementById('submitBtn');
  const loader = document.getElementById('loadingBtn');

  if (!amount || amount < 2000 || amount > 2000000000) {
    msgDiv.innerHTML = '<span style="color: var(--status-failed);">Mức tối thiểu là 2.000</span>'; 
    return;
  }
  btn.style.display = 'none'; 
  loader.style.display = 'block'; 
  msgDiv.innerHTML = '';

  fetch(`${API_URL}?action=add&amount=${amount}&t=${new Date().getTime()}`)
    .then(res => res.json())
    .then(response => {
      btn.style.display = 'block'; 
      loader.style.display = 'none';
      if(response.success) {
        document.getElementById('amount').value = '';
        populateModal(response.data); 
      } else {
        msgDiv.innerHTML = `<span style="color: var(--status-failed);">${response.message}</span>`;
      }
    });
}

function checkAndAutoUpdateModal(records) {
  if(!currentTransaction) return;
  const modal = document.getElementById('mainModal');
  if(!modal.classList.contains('active') || document.getElementById('view-add').classList.contains('active')) return;

  const latestData = records.find(r => r.id === currentTransaction.id);
  if(latestData && currentTransaction.status?.includes('Chờ') && latestData.status?.includes('Đã')) {
    currentTransaction = latestData;
    populateModal(currentTransaction);
    showToast('Giao dịch đã hoàn tất!');
  }
}

function openModal(index) { 
  populateModal(globalRecords[index]); 
}

function populateModal(data) {
  currentTransaction = data; 
  document.querySelectorAll('#mainModal .add-view, #mainModal .receipt-view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-receipt').classList.add('active');

  document.getElementById('rc-id').innerText = '#' + data.id;
  document.getElementById('rc-time').innerText = data.time;
  document.getElementById('rc-amount-row').innerText = formatCurrency(data.amount) + ' VND';
  
  const statusTextEl = document.getElementById('rc-status-text');
  const payTimeRow = document.getElementById('row-paytime');
  const btnGoToPay = document.getElementById('btnGoToPayment');

  if (data.status?.includes('Chờ')) {
    statusTextEl.innerText = 'Đang xử lí'; 
    statusTextEl.className = 'status-text-only pending';
    payTimeRow.style.display = 'none'; 
    btnGoToPay.style.display = 'block'; 
  } else if (data.status?.includes('Đã')) {
    statusTextEl.innerText = 'Hoàn tất'; 
    statusTextEl.className = 'status-text-only success';
    payTimeRow.style.display = 'flex'; 
    document.getElementById('rc-paytime').innerText = data.paymentTime || '---';
    btnGoToPay.style.display = 'none';
  } else {
    statusTextEl.innerText = 'Thất bại'; 
    statusTextEl.className = 'status-text-only failed';
    payTimeRow.style.display = 'none'; 
    btnGoToPay.style.display = 'none';
  }
  document.getElementById('mainModal').classList.add('active');
}

function openPaymentView() {
  if(!currentTransaction || !currentTransaction.id) return;
  window.open("https://viettruong141203.github.io/payment/?id=" + currentTransaction.id, "_blank"); 
}

function closeModal() { 
  document.getElementById('mainModal').classList.remove('active'); 
}

function copyDirect(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Đã sao chép!'));
}

function showToast(msg) {
  const toast = document.getElementById('toastMsg');
  toast.innerText = msg; 
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
