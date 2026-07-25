// app.js
let currentUser = null;
let walletData = null;
let miningInterval = null;
let minedAmount = 0;

// مراقبة حالة المستخدم
auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;
  await loadWallet();
  setupNavigation();
  setupMining();
  setupTransfers();
  setupWalletUI();
  updateRank();
});

// تحميل المحفظة من Firestore
async function loadWallet() {
  const doc = await db.collection('wallets').doc(currentUser.uid).get();
  walletData = doc.data();
  if (!walletData) {
    // إنشاء افتراضي إذا لم توجد
    await db.collection('wallets').doc(currentUser.uid).set({
      nc_balance: 0, cash_balance: 0, nc_capacity: 100000, cash_capacity: 1000,
      mining_level: 0, cash_mining_unlocked: false, totalEarned: 0
    });
    return loadWallet();
  }
  updateWalletUI();
}

// تحديث واجهة المحفظة
function updateWalletUI() {
  if (!walletData) return;
  document.getElementById('walletNc').innerText = walletData.nc_balance.toFixed(2);
  document.getElementById('walletCash').innerText = walletData.cash_balance.toFixed(2);
  const ncPct = (walletData.nc_balance / walletData.nc_capacity) * 100;
  document.getElementById('ncCapFill').style.width = Math.min(ncPct, 100) + '%';
  document.getElementById('ncCapText').innerText = walletData.nc_balance.toFixed(2);
  document.getElementById('ncCapMax').innerText = walletData.nc_capacity.toLocaleString();
  // تحديث السرعة المعروضة
  const speed = getCurrentSpeed();
  document.getElementById('displaySpeed').innerText = speed;
  document.getElementById('miningRate').innerText = speed + ' NC/ث';
}

// حساب السرعة الحالية
function getCurrentSpeed() {
  if (!walletData) return 0.0001;
  const level = walletData.mining_level || 0;
  const speeds = [0.0001, 0.001, 0.01, 0.1, 1];
  return speeds[Math.min(level, 4)];
}

// ----- إدارة التعدين -----
let sessionRef = null;

async function setupMining() {
  // التحقق إذا كانت جلسة تعدين نشطة عند فتح الصفحة
  const snap = await db.collection('mining_sessions').doc(currentUser.uid).get();
  if (snap.exists && snap.data().isActive) {
    // استئناف العد (حساب الوقت من السيرفر)
    startMiningLoop(snap.data().startTime.toDate());
  }
}

document.getElementById('miningToggle').onclick = async function() {
  const snap = await db.collection('mining_sessions').doc(currentUser.uid).get();
  if (snap.exists && snap.data().isActive) {
    // إيقاف التعدين (خسارة كل شيء)
    await db.collection('mining_sessions').doc(currentUser.uid).delete();
    clearInterval(miningInterval);
    minedAmount = 0;
    document.getElementById('currentMined').innerText = '0.0000';
    document.getElementById('miningStatus').innerText = 'متوقف ❌';
    document.getElementById('miningStatus').style.color = '#e74c3c';
  } else {
    // بدء التعدين
    const startTime = new Date();
    await db.collection('mining_sessions').doc(currentUser.uid).set({
      startTime: firebase.firestore.Timestamp.fromDate(startTime),
      isActive: true
    });
    document.getElementById('miningStatus').innerText = 'يعمل ⚡';
    document.getElementById('miningStatus').style.color = '#4A8BFF';
    startMiningLoop(startTime);
  }
};

function startMiningLoop(startTime) {
  clearInterval(miningInterval);
  miningInterval = setInterval(async () => {
    const now = new Date();
    const diff = (now - startTime) / 1000; // ثواني
    const speed = getCurrentSpeed();
    minedAmount = diff * speed;
    document.getElementById('currentMined').innerText = minedAmount.toFixed(6);
  }, 500);
}

// زر الجمع
document.getElementById('collectBtn').onclick = async function() {
  if (!currentUser) return;
  try {
    // استدعاء Cloud Function للتحقق من المبلغ وإضافته للمحفظة
    const collectFn = functions.httpsCallable('collectMining');
    const result = await collectFn({ uid: currentUser.uid });
    alert('تم جمع ' + result.data.collected + ' NC بنجاح!');
    // إعادة ضبط العداد
    clearInterval(miningInterval);
    minedAmount = 0;
    document.getElementById('currentMined').innerText = '0.0000';
    document.getElementById('miningStatus').innerText = 'متوقف ❌';
    document.getElementById('miningStatus').style.color = '#e74c3c';
    await db.collection('mining_sessions').doc(currentUser.uid).delete();
    await loadWallet(); // تحديث المحفظة
  } catch(e) {
    alert('خطأ في الجمع: ' + e.message);
  }
};

// ----- التنقل بين الصفحات -----
function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-item');
  const pages = ['pageMining', 'pageWallet', 'pageTransfer', 'pageGames', 'pageSettings'];
  navBtns.forEach(btn => {
    btn.onclick = function() {
      navBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      pages.forEach(p => document.getElementById(p).classList.add('hidden'));
      const target = document.getElementById(this.dataset.page);
      if (target) target.classList.remove('hidden');
    };
  });
}

// ----- التحويلات (P2P و الصرف) -----
function setupTransfers() {
  // تحويل P2P
  document.getElementById('sendTransferBtn').onclick = async function() {
    const receiverId = document.getElementById('receiverId').value.trim();
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const currency = document.getElementById('transferCurrency').value;
    if (!receiverId || !amount || amount <= 0) return alert('أدخل بيانات صحيحة');
    try {
      const fn = functions.httpsCallable('sendTransfer');
      await fn({ senderId: currentUser.uid, receiverId, amount, currency });
      alert('تم الإرسال بنجاح!');
      await loadWallet();
    } catch(e) { alert('فشل الإرسال: ' + e.message); }
  };

  // صرف NC إلى كاش
  document.getElementById('exchangeBtn').onclick = async function() {
    const amount = parseFloat(document.getElementById('exchangeAmount').value);
    if (!amount || amount <= 0) return alert('أدخل مبلغاً صحيحاً');
    try {
      const fn = functions.httpsCallable('exchangeNcToCash');
      await fn({ uid: currentUser.uid, amount });
      alert('تم الصرف بنجاح!');
      await loadWallet();
    } catch(e) { alert('فشل الصرف: ' + e.message); }
  };
}

// ----- تحديث الرتبة -----
function updateRank() {
  const total = walletData?.totalEarned || 0;
  let rank = 'مبتدئ';
  if (total >= 100000000) rank = 'بروفيسور';
  else if (total >= 1000000) rank = 'خارق';
  else if (total >= 500000) rank = 'خبير';
  else if (total >= 200000) rank = 'متعلم';
  document.getElementById('userRank').innerText = rank;
  document.getElementById('settingsRank').innerText = rank;
}

// تسجيل الخروج
document.getElementById('logoutBtn').onclick = () => { auth.signOut(); };
