const API_URL = "https://script.google.com/macros/s/AKfycbyyun_QUMFygjjOUbPLLE9mJJQdLGOXPV8OvXlh-JM8Napr4Cx8tBRccHMlSCZ_vvBb/exec";

let globalRecords = [], currentTransaction = null, autoUpdateTimeout, allBanksList = [];
let currentFilter = 'All', searchQuery = '', currentPage = 1;
const itemsPerPage = 10;

// BẢO MẬT NGẦM (Không hiển thị timer)
function verifyAuthSilent() {
  const authExpiry = localStorage.getItem('auth_expiry');
  if (!authExpiry || Date.now() >= parseInt(authExpiry)) {
    localStorage.removeItem('auth_expiry'); window.location.replace("./login.html"); return false;
  }
  return true;
}

window.onload = function() {
  if (verifyAuthSilent()) {
    setInterval(verifyAuthSilent, 5000);
    loadData(false);
    preloadBanksFromVietQR();
  }
};

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verifyAuthSilent(); });

function switchTab(tabId, el) {
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); el.classList.add('active');
  document.querySelectorAll('.tab-view').forEach(tab => tab.classList.remove('active')); document.getElementById('tab-' + tabId).classList.add('active');
  if (tabId === 'banks') loadBankAccounts();
}

// ----------------------------------------------------
// QUẢN LÝ NGÂN HÀNG (CARDS UI)
// ----------------------------------------------------
function preloadBanksFromVietQR() {
  fetch('https://api.vietqr.io/v2/banks').then(res => res.json()).then(data => { if(data.code === '00') allBanksList = data.data; }).catch(() => {});
}

function removeVietnameseTones(str) {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a"); str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e"); 
  str = str.replace(/ì|í|ị|ỉ|ĩ/g,"i"); str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o"); 
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u"); str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,"y"); str = str.replace(/đ/g,"d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A"); str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I"); str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|MỠ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U"); str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y"); str = str.replace(/Đ/g, "D");
  return str.toUpperCase();
}

function formatOwnerName(el) { let pos = el.selectionStart; el.value = removeVietnameseTones(el.value); el.setSelectionRange(pos, pos); }

function loadBankAccounts() {
  const container = document.getElementById('bankCardsContainer');
  container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:40px; font-weight:600;">Đang tải dữ liệu...</div>`;

  fetch(`${API_URL}?action=getBanks&t=${Date.now()}`).then(res => res.json()).then(res => {
      if(!res.success || res.data.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:40px; font-weight:600;">Chưa có tài khoản nào</div>`; return;
      }
      container.innerHTML = '';
      res.data.forEach(bk => {
        const bankObj = allBanksList.find(b => b.bin === bk.bin || b.shortName === bk.bankName);
        const logoUrl = bankObj ? bankObj.logo : 'https://img.icons8.com/fluency/48/bank.png';
        const isActive = bk.status.includes('dùng');
        
        container.innerHTML += `
          <div class="bank-card-item">
            <div class="bank-card-left">
              <div class="bank-logo-box"><img src="${logoUrl}"></div>
              <div class="bank-info-box">
                <span class="bank-name-text">${bk.bankName}</span>
                <span class="bank-acc-text">${bk.accNumber}</span>
                <span class="bank-owner-text">${bk.accOwner}</span>
              </div>
            </div>
            <div class="bank-action-box">
              <span class="bank-status-pill ${isActive ? 'active' : 'inactive'}" onclick="setActiveBank('${bk.id}')">${isActive ? 'Đang dùng' : 'Chọn dùng'}</span>
            </div>
          </div>`;
      });
    });
}

function setActiveBank(bankId) {
  showToast("Đang xử lý...");
  fetch(`${API_URL}?action=setActiveBank&id=${bankId}&t=${Date.now()}`).then(res => res.json()).then(res => { showToast(res.message); loadBankAccounts(); });
}

function openBankForm() {
  document.querySelectorAll('#mainModal .add-view, #mainModal .receipt-view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-bank-form').classList.add('active'); document.getElementById('mainModal').classList.add('active');
}

function toggleBankList() {
  const dropdown = document.getElementById('bankDropdownList'); dropdown.classList.toggle('show');
  if(dropdown.children.length === 0 && allBanksList.length > 0) {
    dropdown.innerHTML = '';
    allBanksList.forEach(b => {
      const item = document.createElement('div'); item.className = 'bank-item';
      item.innerHTML = `<img src="${b.logo}"><span><b style="color:var(--text-main); font-size:14px;">${b.shortName}</b><br><span style="font-size:11px; color:var(--text-muted);">${b.name}</span></span>`;
      item.onclick = () => {
        document.getElementById('bankBinInput').value = b.bin; document.getElementById('bankNameInput').value = b.shortName;
        document.getElementById('selectedBankName').innerText = b.shortName;
        const img = document.getElementById('selectedBankLogo'); img.src = b.logo; img.style.display = 'block'; dropdown.classList.remove('show');
      };
      dropdown.appendChild(item);
    });
  }
}

function saveBankConfig() {
  const bin = document.getElementById('bankBinInput').value, name = document.getElementById('bankNameInput').value, acc = document.getElementById('bankAccInput').value.replace(/\s+/g, ''), owner = document.getElementById('bankOwnerInput').value.trim();
  const btn = document.getElementById('btnSaveBank'), loader = document.getElementById('loaderSaveBank');
  if (!bin || !acc || !owner) { showToast("Vui lòng điền đủ thông tin!"); return; }
  btn.style.display = 'none'; loader.style.display = 'block';

  fetch(`${API_URL}?action=addBank&bankName=${encodeURIComponent(name)}&bin=${encodeURIComponent(bin)}&accNumber=${encodeURIComponent(acc)}&accOwner=${encodeURIComponent(owner)}&t=${Date.now()}`)
    .then(res => res.json()).then(res => {
      btn.style.display = 'block'; loader.style.display = 'none';
      if(res.success) { 
        showToast("Đã lưu ngân hàng!"); closeModal(); 
        document.getElementById('bankAccInput').value = ''; document.getElementById('bankOwnerInput').value = '';
        loadBankAccounts(); 
      } else { showToast("Lỗi: " + res.message); }
    });
}

// ----------------------------------------------------
// ĐỒNG BỘ NGẦM CHUẨN 1.5 GIÂY
// ----------------------------------------------------
function formatCurrency(val) { return (!val || val == 0 || val === "0") ? "" : val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
function formatInput(el) { let raw = el.value.replace(/[^0-9]/g, ''); el.value = raw ? (parseInt(raw, 10) === 0 ? '' : formatCurrency(parseInt(raw, 10))) : ''; }
function adjustAmount(step) {
  const input = document.getElementById('amount'); let currentVal = parseInt(input.value.replace(/\./g, ''), 10) || 0;
  let newVal = Math.min(Math.max(currentVal + step, 2000), 2000000000); input.value = formatCurrency(newVal);
}
function getRawAmount() { return parseInt(document.getElementById('amount').value.replace(/\./g, ''), 10) || 0; }
function onSearchInput() { searchQuery = document.getElementById('searchInput').value.trim().toLowerCase(); currentPage = 1; renderDeckView(globalRecords); }
function setFilter(filterType, btnEl) { currentFilter = filterType; currentPage = 1; document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active')); btnEl.classList.add('active'); renderDeckView(globalRecords); }
function changePage(direction) { currentPage += direction; renderDeckView(globalRecords); }

function loadData(isSilent = false) {
  if(!verifyAuthSilent()) return;
  fetch(`${API_URL}?action=get&t=${Date.now()}`).then(res => res.text()).then(text => {
      let res; try { res = JSON.parse(text); } catch(e) { return; }
      if (!res.success) {
         if(!isSilent) document.getElementById('deckView').innerHTML = `<div style="text-align:center; padding:20px; font-weight:700;">${res.message}</div>`;
         autoUpdateTimeout = setTimeout(() => loadData(true), 1500); return;
      }
      globalRecords = res.data; renderDeckView(globalRecords); checkAndAutoUpdateModal(globalRecords);
      autoUpdateTimeout = setTimeout(() => loadData(true), 1500); // CHUẨN 1.5S
    }).catch(() => { autoUpdateTimeout = setTimeout(() => loadData(true), 1500); });
}

function renderDeckView(records) {
  const container = document.getElementById('deckView');
  if(!records || records.length === 0) { container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted); font-weight:600;">Chưa có giao dịch nào</div>'; document.getElementById('pageInfo').innerText = '1 / 1'; return; }
  
  let filtered = records;
  if (currentFilter !== 'All') filtered = filtered.filter(r => r.status && r.status.includes(currentFilter));
  if (searchQuery) filtered = filtered.filter(r => r.id && r.id.toLowerCase().includes(searchQuery));
  if (filtered.length === 0) { container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted); font-weight:600;">Không tìm thấy kết quả</div>'; return; }

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  document.getElementById('pageInfo').innerText = `${currentPage} / ${totalPages}`;
  document.getElementById('prevBtn').disabled = (currentPage === 1); document.getElementById('nextBtn').disabled = (currentPage === totalPages);

  const startIdx = (currentPage - 1) * itemsPerPage; container.innerHTML = '';
  filtered.slice(startIdx, startIdx + itemsPerPage).forEach((record) => {
    const originalIndex = globalRecords.indexOf(record);
    const card = document.createElement('div'); card.className = 'card'; card.onclick = () => openModal(originalIndex);
    
    let stClass = record.status.includes('Chờ') ? 'pending' : (record.status.includes('Đã') ? 'success' : 'failed');
    let stText = record.status.includes('Chờ') ? 'Đang xử lí' : (record.status.includes('Đã') ? 'Hoàn tất' : 'Thất bại');

    card.innerHTML = `
      <div class="card-left">
        <span class="card-id">#${record.id}</span>
        <span class="card-time">${record.time || '---'}</span>
      </div>
      <div class="card-right">
        <div class="card-amount">${formatCurrency(record.amount)}</div>
        <div class="status-badge ${stClass}">${stText}</div>
      </div>`;
    container.appendChild(card);
  });
}

function openAddModal() { document.querySelectorAll('#mainModal .add-view, #mainModal .receipt-view').forEach(el => el.classList.remove('active')); document.getElementById('view-add').classList.add('active'); document.getElementById('message').innerHTML = ''; document.getElementById('mainModal').classList.add('active'); }

function submitForm() {
  const amount = getRawAmount(), msgDiv = document.getElementById('message'), btn = document.getElementById('submitBtn'), loader = document.getElementById('loadingBtn');
  if (!amount || amount < 2000 || amount > 2000000000) { msgDiv.innerHTML = '<span style="color: var(--status-failed);">Mức tối thiểu là 2.000</span>'; return; }
  btn.style.display = 'none'; loader.style.display = 'block'; msgDiv.innerHTML = '';

  fetch(`${API_URL}?action=add&amount=${amount}&t=${Date.now()}`)
    .then(res => res.json()).then(response => {
      btn.style.display = 'block'; loader.style.display = 'none';
      if(response.success) { document.getElementById('amount').value = ''; populateModal(response.data); } 
      else { msgDiv.innerHTML = `<span style="color: var(--status-failed);">${response.message}</span>`; }
    });
}

function checkAndAutoUpdateModal(records) {
  if(!currentTransaction) return;
  const modal = document.getElementById('mainModal');
  if(!modal.classList.contains('active') || document.getElementById('view-add').classList.contains('active')) return;
  const latestData = records.find(r => r.id === currentTransaction.id);
  if(latestData && currentTransaction.status?.includes('Chờ') && latestData.status?.includes('Đã')) {
    currentTransaction = latestData; populateModal(currentTransaction); showToast('Giao dịch đã hoàn tất!');
  }
}

function openModal(index) { populateModal(globalRecords[index]); }

function populateModal(data) {
  currentTransaction = data; 
  document.querySelectorAll('#mainModal .add-view, #mainModal .receipt-view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-receipt').classList.add('active');

  document.getElementById('rc-id').innerText = '#' + data.id;
  document.getElementById('rc-time').innerText = data.time;
  document.getElementById('rc-amount-row').innerText = formatCurrency(data.amount) + ' VND';
  
  const statusTextEl = document.getElementById('rc-status-text'), payTimeRow = document.getElementById('row-paytime'), btnGoToPay = document.getElementById('btnGoToPayment');

  if (data.status?.includes('Chờ')) {
    statusTextEl.innerText = 'Đang xử lí'; statusTextEl.className = 'status-badge pending';
    payTimeRow.style.display = 'none'; btnGoToPay.style.display = 'block'; 
  } else if (data.status?.includes('Đã')) {
    statusTextEl.innerText = 'Hoàn tất'; statusTextEl.className = 'status-badge success';
    payTimeRow.style.display = 'flex'; document.getElementById('rc-paytime').innerText = data.paymentTime || '---';
    btnGoToPay.style.display = 'none';
  } else {
    statusTextEl.innerText = 'Thất bại'; statusTextEl.className = 'status-badge failed';
    payTimeRow.style.display = 'none'; btnGoToPay.style.display = 'none';
  }
  document.getElementById('mainModal').classList.add('active');
}

function openPaymentView() {
  if(!currentTransaction || !currentTransaction.id) return;
  window.open("https://viettruong141203.github.io/payment/?id=" + currentTransaction.id, "_blank"); 
}

function closeModal() { document.getElementById('mainModal').classList.remove('active'); }
function copyDirect(text) { navigator.clipboard.writeText(text).then(() => showToast('Đã sao chép!')); }
function showToast(msg) { const toast = document.getElementById('toastMsg'); toast.innerText = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2500); }
