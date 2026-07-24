/* ==========================================================================
   WHEELO - Production Relational Database Engine (Persistent JSON / SQLite)
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'wheelo.db.json');

const defaultDb = {
  users: [
    {
      id: 'rider_ananya',
      name: 'Ananya Sharma',
      email: 'ananya.sharma@example.com',
      password: 'password123',
      phone: '+91 98765 43210',
      role: 'rider',
      wallet_balance: 650.00,
      member_tier: 'Gold Rider',
      blocked: false,
      created_at: new Date().toISOString()
    },
    {
      id: 'captain_ramesh',
      name: 'Ramesh Kumar',
      email: 'ramesh.captain@wheelo.app',
      password: 'password123',
      phone: '+91 91234 56789',
      role: 'captain',
      vehicle_no: 'KA-05-EV-4890',
      vehicle_model: 'Yamaha FZ-S (Bike Taxi)',
      today_earnings: 1420.00,
      trips_completed: 12,
      rating: 4.89,
      blocked: false,
      created_at: new Date().toISOString()
    }
  ],
  vehicles: [
    { id: 'bike', name: 'Wheelo Bike', baseFare: 15, perKmRate: 5, perMinRate: 1.0, minFare: 25, capacity: '1 Rider', icon: 'fa-motorcycle', badge: 'FASTEST' },
    { id: 'auto', name: 'Wheelo Auto', baseFare: 20, perKmRate: 5, perMinRate: 1.5, minFare: 35, capacity: '3 Passengers', icon: 'fa-taxi', badge: 'POPULAR' },
    { id: 'cab', name: 'Economy Cab', baseFare: 30, perKmRate: 5, perMinRate: 2.0, minFare: 50, capacity: '4 Passengers', icon: 'fa-car-side', badge: 'AC' },
    { id: 'sedan', name: 'Premium Sedan', baseFare: 45, perKmRate: 5, perMinRate: 2.5, minFare: 75, capacity: '4 Passengers', icon: 'fa-car', badge: 'LUXURY' },
    { id: 'parcel', name: 'Express Parcel', baseFare: 20, perKmRate: 5, perMinRate: 1.0, minFare: 30, capacity: 'Package', icon: 'fa-box-open', badge: 'INSTANT' }
  ],
  saved_places: [
    { id: 'home', userId: 'rider_ananya', name: 'Home', address: 'BTM Layout 2nd Stage', lat: 12.9166, lng: 77.6101, icon: 'fa-house' },
    { id: 'work', userId: 'rider_ananya', name: 'Work / Office', address: 'Manyata Tech Park, Nagavara', lat: 13.0457, lng: 77.6200, icon: 'fa-briefcase' },
    { id: 'gym', userId: 'rider_ananya', name: 'Fitness Gym', address: 'Koramangala 5th Block', lat: 12.9348, lng: 77.6245, icon: 'fa-dumbbell' }
  ],
  coupons: {
    'FIRST50': { discountPercent: 50, maxDiscount: 40, desc: '50% OFF (Max ₹40)' },
    'WHEELO20': { discountPercent: 20, maxDiscount: 50, desc: '20% OFF (Max ₹50)' },
    'FREERIDE': { discountPercent: 100, maxDiscount: 100, desc: 'Flat ₹100 OFF' }
  },
  transactions: [
    {
      id: 'TXN-9041',
      userId: 'rider_ananya',
      title: 'Welcome Bonus Credit',
      amount: 500.00,
      type: 'Credit',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    },
    {
      id: 'TXN-9042',
      userId: 'rider_ananya',
      title: 'UPI Topup via GPay',
      amount: 150.00,
      type: 'Credit',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  ],
  rides: [],
  driver_kyc: {
    verified: true,
    license_no: 'DL-0420210089421',
    rc_no: 'KA-05-EV-4890',
    expiry_date: '2032-11-15',
    rc_status: 'Verified (KA-05-EV-4890)',
    insurance_status: 'Active (HDFC ERGO)',
    license_doc: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200',
    rc_doc: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=200',
    rating: 4.89
  }
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

  // User Management CRUD
  getAllUsers() {
    const db = this.load();
    return db.users || defaultDb.users;
  }

  deleteUser(userId) {
    const db = this.load();
    const initialLen = db.users.length;
    db.users = db.users.filter(u => u.id !== userId);
    this.save(db);
    return db.users.length < initialLen;
  }

  toggleBlockUser(userId) {
    const db = this.load();
    const user = db.users.find(u => u.id === userId);
    if (!user) return null;
    user.blocked = !user.blocked;
    this.save(db);
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
      role: 'rider',
      wallet_balance: 500.00,
      member_tier: 'Gold Rider',
      blocked: false,
      created_at: new Date().toISOString()
    };

    db.users.push(newUser);
    this.save(db);
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
      license_no: kycData.licenseNo || 'DL-PENDING',
      rc_no: kycData.rcNo || 'KA-05-PENDING',
      license_doc: kycData.licenseDoc || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200',
      rc_doc: kycData.rcDoc || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=200',
      submitted_at: new Date().toISOString()
    };
    this.save(db);
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
    return newVehicle;
  }

  deleteVehicle(id) {
    const db = this.load();
    if (!db.vehicles) return false;
    db.vehicles = db.vehicles.filter(v => v.id !== id);
    this.save(db);
    return true;
  }

  // Driver KYC CRUD
  updateKYCStatus(verified = true) {
    const db = this.load();
    if (!db.driver_kyc) db.driver_kyc = defaultDb.driver_kyc;
    db.driver_kyc.verified = verified;
    db.driver_kyc.status = verified ? 'VERIFIED' : 'REJECTED';
    this.save(db);
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
    return place;
  }

  // Wallet & Transactions
  getWalletBalance(userId = 'rider_ananya') {
    const user = this.getUser(userId);
    return user ? user.wallet_balance : 650.00;
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

    return { balance: user ? user.wallet_balance : 650.00, transaction: txn };
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

  // Ride Operations
  createRide(rideData) {
    const db = this.load();
    const ride = {
      id: 'RIDE-' + Math.floor(10000 + Math.random() * 90000),
      rider_id: 'rider_ananya',
      ...rideData,
      status: 'SEARCHING',
      created_at: new Date().toISOString()
    };
    if (!db.rides) db.rides = [];
    db.rides.unshift(ride);
    this.save(db);
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
    return ride;
  }

  getKYC() {
    const db = this.load();
    return db.driver_kyc;
  }
}

module.exports = new DatabaseEngine();
