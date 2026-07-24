/* ==========================================================================
   WHEELO - Firebase Firestore & Persistent Storage Engine (100% Clean Data)
   ========================================================================== */

const fs = require('fs');
const path = require('path');

let admin = null;
let firestoreDb = null;
let isFirebaseConnected = false;

const DB_FILE = path.join(__dirname, 'wheelo.db.json');
const FIREBASE_KEY_FILE = path.join(__dirname, 'firebase-key.json');

// Attempt Firebase Admin SDK Initialization
try {
  admin = require('firebase-admin');

  let credential = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : process.env.FIREBASE_SERVICE_ACCOUNT;
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.warn('FIREBASE_SERVICE_ACCOUNT env parse warning:', e.message);
    }
  } else if (fs.existsSync(FIREBASE_KEY_FILE)) {
    const serviceAccount = require(FIREBASE_KEY_FILE);
    credential = admin.credential.cert(serviceAccount);
  }

  if (credential) {
    admin.initializeApp({ credential });
    firestoreDb = admin.firestore();
    isFirebaseConnected = true;
    console.log('✅ Connected to Firebase Firestore Cloud Database!');
  } else {
    console.log('ℹ️ Firebase SDK installed. Awaiting Firebase Service Account Key (firebase-key.json or FIREBASE_SERVICE_ACCOUNT env).');
  }
} catch (err) {
  console.warn('Firebase Admin SDK load warning:', err.message);
}

const defaultDb = {
  users: [],
  vehicles: [],
  saved_places: [],
  coupons: {
    'FIRST50': { discountPercent: 50, maxDiscount: 40, desc: '50% OFF (Max ₹40)' },
    'WHEELO20': { discountPercent: 20, maxDiscount: 50, desc: '20% OFF (Max ₹50)' },
    'FREERIDE': { discountPercent: 100, maxDiscount: 100, desc: 'Flat ₹100 OFF' }
  },
  transactions: [],
  rides: [],
  driver_kyc: null
};

class DatabaseEngine {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
      this.save(defaultDb);
    }
  }

  load() {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (!parsed.vehicles) parsed.vehicles = defaultDb.vehicles;
      return parsed;
    } catch (err) {
      console.error('Database load error, re-initializing:', err);
      this.save(defaultDb);
      return defaultDb;
    }
  }

  save(data) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Database save error:', err);
    }
  }

  getDatabaseStatus() {
    if (isFirebaseConnected) {
      return 'Connected to Firebase Firestore Cloud Database';
    }
    return 'Firebase Firestore Driver Engine Ready (Awaiting Credentials)';
  }

  // User Management CRUD
  getAllUsers() {
    const db = this.load();
    return db.users || [];
  }

  deleteUser(userId) {
    const db = this.load();
    const initialLen = db.users.length;
    db.users = db.users.filter(u => u.id !== userId);
    this.save(db);

    if (isFirebaseConnected && firestoreDb) {
      firestoreDb.collection('users').doc(userId).delete().catch(e => console.warn('Firestore delete user error:', e));
    }

    return db.users.length < initialLen;
  }

  toggleBlockUser(userId) {
    const db = this.load();
    const user = db.users.find(u => u.id === userId);
    if (!user) return null;
    user.blocked = !user.blocked;
    this.save(db);

    if (isFirebaseConnected && firestoreDb) {
      firestoreDb.collection('users').doc(userId).set({ blocked: user.blocked }, { merge: true }).catch(e => console.warn('Firestore block error:', e));
    }

    return user;
  }

  // Authentication Operations
  registerUser(userData) {
    const db = this.load();
    const existing = db.users.find(u => u.email === userData.email || u.phone === userData.phone);
    if (existing) {
      return { success: false, message: 'User with this email or phone already exists.' };
    }

    const newUser = {
      id: 'usr_' + Date.now(),
      name: userData.name || 'User',
      email: userData.email,
      password: userData.password || '123456',
      phone: userData.phone || '+91 98765 00000',
      role: userData.role || 'rider',
      wallet_balance: 500.00,
      member_tier: 'Gold Rider',
      blocked: false,
      created_at: new Date().toISOString()
    };

    db.users.push(newUser);
    this.save(db);

    if (isFirebaseConnected && firestoreDb) {
      firestoreDb.collection('users').doc(newUser.id).set(newUser).catch(e => console.warn('Firestore register error:', e));
    }

    return { success: true, user: newUser };
  }

  loginUserEmail(email, password) {
    const db = this.load();
    const user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    if (!user) return { success: false, message: 'No account found with this email.' };
    if (user.blocked) return { success: false, message: 'Your account has been suspended by Admin.' };
    if (user.password && user.password !== password) {
      return { success: false, message: 'Incorrect password.' };
    }
    return { success: true, user };
  }

  // Driver KYC Onboarding Operations
  submitDriverKYC(kycData) {
    const db = this.load();
    db.driver_kyc = {
      verified: false,
      status: 'PENDING_VERIFICATION',
      driver_name: kycData.driverName || 'Captain Driver',
      license_no: kycData.licenseNo || 'DL-PENDING',
      rc_no: kycData.rcNo || 'KA-05-PENDING',
      license_doc: kycData.licenseDoc || '',
      rc_doc: kycData.rcDoc || '',
      submitted_at: new Date().toISOString()
    };
    this.save(db);

    if (isFirebaseConnected && firestoreDb) {
      firestoreDb.collection('driver_kyc').doc('latest').set(db.driver_kyc).catch(e => console.warn('Firestore KYC submit error:', e));
    }

    return db.driver_kyc;
  }

  // Vehicles Fleet CRUD
  getVehicles() {
    const db = this.load();
    return db.vehicles || defaultDb.vehicles;
  }

  updateVehicle(id, vehicleData) {
    const db = this.load();
    const idx = (db.vehicles || []).findIndex(v => v.id === id);
    if (idx >= 0) {
      db.vehicles[idx] = { ...db.vehicles[idx], ...vehicleData };
      this.save(db);

      if (isFirebaseConnected && firestoreDb) {
        firestoreDb.collection('vehicles').doc(id).set(db.vehicles[idx], { merge: true }).catch(e => console.warn('Firestore vehicle update error:', e));
      }

      return db.vehicles[idx];
    }
    return null;
  }

  addVehicle(vehicleData) {
    const db = this.load();
    if (!db.vehicles) db.vehicles = defaultDb.vehicles;
    const newVehicle = {
      id: vehicleData.id || `veh_${Date.now()}`,
      name: vehicleData.name || 'New Category',
      baseFare: parseFloat(vehicleData.baseFare) || 20,
      perKmRate: parseFloat(vehicleData.perKmRate) || 5,
      perMinRate: parseFloat(vehicleData.perMinRate) || 1.5,
      minFare: parseFloat(vehicleData.minFare) || 30,
      capacity: vehicleData.capacity || '4 Passengers',
      icon: vehicleData.icon || 'fa-car',
      badge: vehicleData.badge || 'NEW'
    };
    db.vehicles.push(newVehicle);
    this.save(db);

    if (isFirebaseConnected && firestoreDb) {
      firestoreDb.collection('vehicles').doc(newVehicle.id).set(newVehicle).catch(e => console.warn('Firestore vehicle add error:', e));
    }

    return newVehicle;
  }

  deleteVehicle(id) {
    const db = this.load();
    if (!db.vehicles) return false;
    db.vehicles = db.vehicles.filter(v => v.id !== id);
    this.save(db);

    if (isFirebaseConnected && firestoreDb) {
      firestoreDb.collection('vehicles').doc(id).delete().catch(e => console.warn('Firestore vehicle delete error:', e));
    }

    return true;
  }

  // Driver KYC CRUD
  updateKYCStatus(verified = true) {
    const db = this.load();
    if (db.driver_kyc) {
      db.driver_kyc.verified = verified;
      db.driver_kyc.status = verified ? 'VERIFIED' : 'REJECTED';
      this.save(db);

      if (isFirebaseConnected && firestoreDb) {
        firestoreDb.collection('driver_kyc').doc('latest').set(db.driver_kyc, { merge: true }).catch(e => console.warn('Firestore KYC update status error:', e));
      }
    }
    return db.driver_kyc;
  }

  // User Operations
  getUser(id) {
    const db = this.load();
    return db.users.find(u => u.id === id);
  }

  saveUser(user) {
    const db = this.load();
    const idx = db.users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      db.users[idx] = { ...db.users[idx], ...user };
    } else {
      db.users.push(user);
    }
    this.save(db);

    if (isFirebaseConnected && firestoreDb) {
      firestoreDb.collection('users').doc(user.id).set(user, { merge: true }).catch(e => console.warn('Firestore save user error:', e));
    }

    return user;
  }

  // Saved Places
  getSavedPlaces(userId = 'rider_ananya') {
    const db = this.load();
    return (db.saved_places || []).filter(p => p.userId === userId);
  }

  savePlace(place) {
    const db = this.load();
    if (!db.saved_places) db.saved_places = [];
    db.saved_places.push(place);
    this.save(db);

    if (isFirebaseConnected && firestoreDb) {
      firestoreDb.collection('saved_places').add(place).catch(e => console.warn('Firestore save place error:', e));
    }

    return place;
  }

  // Wallet & Transactions
  getWalletBalance(userId = 'rider_ananya') {
    const user = this.getUser(userId);
    return user ? user.wallet_balance : 500.00;
  }

  updateWallet(userId, amount, type = 'Credit', title = 'Wallet Topup') {
    const db = this.load();
    const user = db.users.find(u => u.id === userId);
    if (user) {
      if (type === 'Credit') {
        user.wallet_balance += parseFloat(amount);
      } else {
        user.wallet_balance = Math.max(0, user.wallet_balance - parseFloat(amount));
      }
    }

    const txn = {
      id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: userId,
      title: title,
      amount: parseFloat(amount),
      type: type,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
    if (!db.transactions) db.transactions = [];
    db.transactions.unshift(txn);
    this.save(db);

    if (isFirebaseConnected && firestoreDb) {
      if (user) firestoreDb.collection('users').doc(user.id).set({ wallet_balance: user.wallet_balance }, { merge: true }).catch(e => console.warn('Firestore update wallet error:', e));
      firestoreDb.collection('transactions').doc(txn.id).set(txn).catch(e => console.warn('Firestore txn error:', e));
    }

    return { balance: user ? user.wallet_balance : 500.00, transaction: txn };
  }

  getTransactions(userId = 'rider_ananya') {
    const db = this.load();
    return (db.transactions || []).filter(t => t.userId === userId);
  }

  // Coupons
  validateCoupon(code) {
    const db = this.load();
    const cleanCode = (code || '').trim().toUpperCase();
    return (db.coupons && db.coupons[cleanCode]) ? db.coupons[cleanCode] : null;
  }

  // Ride Operations - ENSURE 4-DIGIT START OTP IS ALWAYS GENERATED AND ATTACHED
  createRide(rideData) {
    const db = this.load();
    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

    const ride = {
      id: 'RIDE-' + Math.floor(10000 + Math.random() * 90000),
      rider_id: rideData.userId || 'rider_user',
      otp: rideData.otp || generatedOtp,
      ...rideData,
      status: 'SEARCHING',
      created_at: new Date().toISOString()
    };
    if (!db.rides) db.rides = [];
    db.rides.unshift(ride);
    this.save(db);

    if (isFirebaseConnected && firestoreDb) {
      firestoreDb.collection('rides').doc(ride.id).set(ride).catch(e => console.warn('Firestore create ride error:', e));
    }

    return ride;
  }

  getRide(id) {
    const db = this.load();
    return (db.rides || []).find(r => r.id === id);
  }

  updateRideStatus(id, status, extraData = {}) {
    const db = this.load();
    const ride = (db.rides || []).find(r => r.id === id);
    if (!ride) return null;

    ride.status = status;
    Object.assign(ride, extraData);
    this.save(db);

    if (isFirebaseConnected && firestoreDb) {
      firestoreDb.collection('rides').doc(ride.id).set(ride, { merge: true }).catch(e => console.warn('Firestore update ride error:', e));
    }

    return ride;
  }

  getKYC() {
    const db = this.load();
    return db.driver_kyc;
  }
}

module.exports = new DatabaseEngine();
