const API_URL = "https://script.google.com/macros/s/AKfycbyyun_QUMFygjjOUbPLLE9mJJQdLGOXPV8OvXlh-JM8Napr4Cx8tBRccHMlSCZ_vvBb/exec";
const ADMIN_EMAIL = "dvtruong141203@gmail.com";

window.onload = function() {
  const authExpiry = localStorage.getItem('auth_expiry');
  const now = new Date().getTime();
  // Nếu đã đăng nhập thành công trước đó, chuyển thẳng vào index.html
  if (authExpiry && now < parseInt(authExpiry)) {
    window.location.href = "index.html"; 
  }
};

function sendOtp() {
  const btn = document.getElementById('btnSendOtp');
  const loader = document.getElementById('loaderSend');
  const msg = document.getElementById('loginMsg');
  
  msg.innerText = "";
  btn.querySelector('span').style.display = 'none';
  loader.style.display = 'block';

  fetch(`${API_URL}?action=sendOTP&email=${encodeURIComponent(ADMIN_EMAIL)}&t=${new Date().getTime()}`)
    .then(res => res.json())
    .then(res => {
      btn.querySelector('span').style.display = 'inline';
      loader.style.display = 'none';
      if(res.success) {
        document.getElementById('loginStep1').style.display = 'none';
        document.getElementById('loginStep2').style.display = 'block';
        document.getElementById('otpInput').focus();
        msg.style.color = "var(--status-success)";
        msg.innerText = res.message;
      } else {
        msg.style.color = "var(--status-failed)";
        msg.innerText = res.message;
      }
    })
    .catch(err => {
      btn.querySelector('span').style.display = 'inline';
      loader.style.display = 'none';
      msg.style.color = "var(--status-failed)";
      msg.innerText = "Lỗi mạng khi gửi OTP!";
    });
}

function verifyOtp() {
  const otp = document.getElementById('otpInput').value.trim();
  const btn = document.getElementById('btnVerifyOtp');
  const loader = document.getElementById('loaderVerify');
  const msg = document.getElementById('loginMsg');
  
  if(otp.length !== 6) {
    msg.style.color = "var(--status-failed)";
    msg.innerText = "Vui lòng nhập đúng 6 số OTP";
    return;
  }

  msg.innerText = "";
  btn.querySelector('span').style.display = 'none';
  loader.style.display = 'block';

  fetch(`${API_URL}?action=verifyOTP&otp=${encodeURIComponent(otp)}&t=${new Date().getTime()}`)
    .then(res => res.json())
    .then(res => {
      btn.querySelector('span').style.display = 'inline';
      loader.style.display = 'none';
      
      if(res.success) {
        // Lưu thời hạn 5 phút vào bộ nhớ
        const expiryTime = new Date().getTime() + (5 * 60 * 1000);
        localStorage.setItem('auth_expiry', expiryTime);
        // Chuyển hướng sang App chính
        window.location.href = "index.html"; 
      } else {
        msg.style.color = "var(--status-failed)";
        msg.innerText = res.message;
      }
    })
    .catch(err => {
      btn.querySelector('span').style.display = 'inline';
      loader.style.display = 'none';
      msg.style.color = "var(--status-failed)";
      msg.innerText = "Lỗi mạng khi kiểm tra OTP!";
    });
}

function backToStep1() {
  document.getElementById('loginStep2').style.display = 'none';
  document.getElementById('loginStep1').style.display = 'block';
  document.getElementById('otpInput').value = '';
  document.getElementById('loginMsg').innerText = '';
}
