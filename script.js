const API_URL = "https://script.google.com/macros/s/AKfycbyyun_QUMFygjjOUbPLLE9mJJQdLGOXPV8OvXlh-JM8Napr4Cx8tBRccHMlSCZ_vvBb/exec";

let globalRecords = [];
let currentTransaction = null;
let autoUpdateTimeout; 
let sessionInterval;

let currentFilter = 'All';
let searchQuery = '';
let currentPage = 1;
const itemsPerPage = 10;

// LUÔN BẢO VỆ TRANG BẰNG CÁCH KIỂM TRA ĐĂNG NHẬP ĐẦU TIÊN
window.onload = function() {
  const authExpiry = localStorage.getItem('auth_expiry');
  const now = new Date().getTime();
  if (!authExpiry || now >= parseInt(authExpiry)) {
    window.location.href = "login.html"; // Đá văng về trang đăng nhập
    return;
  }
  startSessionTimer(parseInt(authExpiry));
  loadData(false);
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
    if (!authExpiry || new Date().getTime() >= parseInt(authExpiry)) {
      logout();
    }
  }
});

// XỬ LÝ LÕI DỮ LIỆU
function formatCurrency(val) { 
  if (!val || val == 0 || val === "0") return "";
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); 
}

function formatInput(el) {
  let raw = el.value.replace(/[^0-9]/g, '');
  if(raw) {
     let num = parseInt(raw, 10);
     if(num === 0) el.value = ''; else el.value = formatCurrency(num);
  } else { el.value = ''; }
}

function adjustAmount(step) {
  const input = document.getElementById('amount');
  let raw = input.value.replace(/\./g, '');
  let currentVal = parseInt(raw, 10);
  if(isNaN(currentVal)) currentVal = 0;
  let newVal = currentVal + step;
  if (newVal < 2000) newVal = 2000;
  if (newVal > 2000000000) newVal = 2000000000;
  input.value = formatCurrency(newVal);
}

function getRawAmount() {
  const val = document.getElementById('amount').value.replace(/\./g, '');
  let num = parseInt(val, 10);
  return isNaN(num) ? 0 : num;
}

function onSearchInput() {
  searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();
  currentPage = 1; renderDeckView(globalRecords);
}

function setFilter(filterType, btnEl) {
  currentFilter = filterType; currentPage = 1; 
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  btnEl.classList.add('active'); renderDeckView(globalRecords);
}

function changePage(direction) {
  currentPage += direction; renderDeckView(globalRecords);
}

function loadData(isSilent = false) {
  fetch(`${API_URL}?action=get&t=${new Date().getTime()}`)
    .then(response => response.text())
    .then(text => {
      let res;
      try { res = JSON.parse(text); } catch(e) { return; }
      if (!res.success) {
         if(!isSilent) document.getElementById('deckView').innerHTML = `<div style="color: var(--status-failed); text-align: center; padding: 20px; font-weight: bold; font-size: 14px;">${res.message}</div>`;
         autoUpdateTimeout = setTimeout(() => loadData(true), 5000); return;
      }
      globalRecords = res.data;
      renderDeckView(globalRecords);
      checkAndAutoUpdateModal(globalRecords);
      autoUpdateTimeout = setTimeout(() => loadData(true), 2000);
    })
    .catch(err => {
      if(!isSilent) document.getElementById('deckView').innerHTML = `<div style="color: var(--status-failed); text-align: center; padding: 20px; font-weight: bold; font-size: 14px;">Lỗi mạng: Đang tải lại...</div>`;
      autoUpdateTimeout = setTimeout(() => loadData(true), 5000); 
    });
}

function renderDeckView(records) {
  const container = document.getElementById('deckView');
  if(!records || records.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-weight: 500; padding: 40px; font-size: 14px;">Chưa có giao dịch nào</div>';
    document.getElementById('pageInfo').innerText = '1 / 1'; return;
  }

  let filtered = records;
  if (currentFilter !== 'All') filtered = filtered.filter(r => r.status && r.status.includes(currentFilter));
  if (searchQuery) filtered = filtered.filter(r => r.id && r.id.toLowerCase().includes(searchQuery));

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-weight: 500; padding: 40px; font-size: 14px;">Không tìm thấy kết quả</div>';
    document.getElementById('pageInfo').innerText = '1 / 1';
    document.getElementById('prevBtn').disabled = true; document.getElementById('nextBtn').disabled = true;
    return;
  }

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  document.getElementById('pageInfo').innerText = `${currentPage} / ${totalPages}`;
  document.getElementById('prevBtn').disabled = (currentPage === 1);
  document.getElementById('nextBtn').disabled = (currentPage === totalPages);

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const currentSlice = filtered.slice(startIdx, endIdx);

  container.innerHTML = '';
  currentSlice.forEach((record) => {
    const originalIndex = globalRecords.indexOf(record);
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = () => openModal(originalIndex);
    
    let stClass = 'failed'; let stText = 'Thất bại';
    if(record.status.includes('Chờ')) { stClass = 'pending'; stText = 'Đang xử lí'; }
    else if(record.status.includes('Đã')) { stClass = 'success'; stText = 'Hoàn tất'; }

    card.innerHTML = `
      <div class="card-left">
        <div class="card-info">
          <div class="card-id-wrap">
            <span class="card-id">#${record.id}</span>
            <button class="icon-copy-mini" onclick="event.stopPropagation(); copyDirect('${record.id}')">
              <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
          <span class="card-time">${record.time || '---'}</span>
        </div>
      </div>
      <div class="card-right">
        <div class="card-amount">${formatCurrency(record.amount)}</div>
        <div class="status-text ${stClass}">${stText}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function openAddModal() {
  document.getElementById('view-receipt').classList.remove('active');
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
    msgDiv.innerHTML = '<span style="color: var(--status-failed);">Mức tối thiểu là 2.000</span>'; return;
  }
  btn.style.display = 'none'; loader.style.display = 'block'; msgDiv.innerHTML = '';

  fetch(`${API_URL}?action=add&amount=${amount}&t=${new Date().getTime()}`)
    .then(response => response.json())
    .then(response => {
      btn.style.display = 'block'; loader.style.display = 'none';
      if(response.success) {
        document.getElementById('amount').value = '';
        currentFilter = 'All'; currentPage = 1; document.getElementById('searchInput').value = ''; searchQuery = '';
        document.querySelectorAll('.filter-btn').forEach((b,i) => {
          if(i===0) b.classList.add('active'); else b.classList.remove('active');
        });
        populateModal(response.data); 
      } else {
        msgDiv.innerHTML = `<span style="color: var(--status-failed);">${response.message}</span>`;
      }
    })
    .catch(err => {
       btn.style.display = 'block'; loader.style.display = 'none';
       msgDiv.innerHTML = `<span style="color: var(--status-failed);">Lỗi đường truyền</span>`;
    });
}

function checkAndAutoUpdateModal(records) {
  if(!currentTransaction) return;
  const modal = document.getElementById('mainModal');
  if(!modal.classList.contains('active')) return;
  if(document.getElementById('view-add').classList.contains('active')) return;

  const latestData = records.find(r => r.id === currentTransaction.id);
  if(latestData) {
    if(currentTransaction.status?.includes('Chờ') && latestData.status?.includes('Đã')) {
       currentTransaction = latestData;
       populateModal(currentTransaction);
       showToast('Giao dịch đã được thanh toán!');
    } else {
       currentTransaction = latestData;
    }
  }
}

function openModal(index) { populateModal(globalRecords[index]); }

function populateModal(data) {
  currentTransaction = data; 
  document.getElementById('view-add').classList.remove('active');
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
    payTimeRow.style.display = 'none'; btnGoToPay.style.display = 'block'; 
  } else if (data.status?.includes('Đã')) {
    statusTextEl.innerText = 'Hoàn tất'; 
    statusTextEl.className = 'status-text-only success';
    payTimeRow.style.display = 'flex'; 
    document.getElementById('rc-paytime').innerText = data.paymentTime || '---';
    btnGoToPay.style.display = 'none';
  } else {
    statusTextEl.innerText = 'Thất bại'; 
    statusTextEl.className = 'status-text-only failed';
    payTimeRow.style.display = 'none'; btnGoToPay.style.display = 'none';
  }
  document.getElementById('mainModal').classList.add('active');
}

function openPaymentView() {
  const data = currentTransaction;
  if(!data || !data.id) return;
  window.open("https://viettruong141203.github.io/payment/?id=" + data.id, "_blank"); 
}

function closeModal() { document.getElementById('mainModal').classList.remove('active'); }

function fallbackCopyTextToClipboard(text) {
  var textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0"; textArea.style.left = "0"; textArea.style.position = "fixed";
  document.body.appendChild(textArea); textArea.focus(); textArea.select();
  try { document.execCommand('copy'); showToast('Đã sao chép!'); } catch (err) {}
  document.body.removeChild(textArea);
}

function copyDirect(text) {
  if (!navigator.clipboard) { fallbackCopyTextToClipboard(text); return; }
  navigator.clipboard.writeText(text).then(function() { showToast('Đã sao chép!'); }, function() { fallbackCopyTextToClipboard(text); });
}

function showToast(msg) {
  const toast = document.getElementById('toastMsg');
  toast.innerText = msg; toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
