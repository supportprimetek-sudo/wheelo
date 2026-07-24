/* ==========================================================================
   WHEELO - Production LocalStorage & Persistent REST API Synchronizer
   ========================================================================== */

const WheeloStorage = (function () {
  const STORAGE_KEYS = {
    WALLET: 'wheelo_prod_wallet',
    TRANSACTIONS: 'wheelo_prod_transactions',
    SAVED_PLACES: 'wheelo_prod_saved_places',
    RIDE_HISTORY: 'wheelo_prod_ride_history',
    CAPTAIN_KYC: 'wheelo_prod_captain_kyc',
    SETTINGS: 'wheelo_prod_settings',
    USER_PROFILE: 'wheelo_prod_user_profile'
  };

  const DEFAULT_USER = {
    id: 'rider_ananya',
    name: 'Ananya Sharma',
    phone: '+91 98765 43210',
    email: 'ananya.sharma@example.com',
    initials: 'AS',
    isLoggedIn: true,
    memberTier: 'Gold Rider'
  };

  function getItem(key, defaultValue) {
    try {
      const data = localStorage.getItem(key);
      return data !== null ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.warn('LocalStorage read error:', e);
      return defaultValue;
    }
  }

  function setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage write error:', e);
    }
  }

  return {
    getUserProfile: () => getItem(STORAGE_KEYS.USER_PROFILE, DEFAULT_USER),
    saveUserProfile: (user) => {
      setItem(STORAGE_KEYS.USER_PROFILE, user);
      if (typeof WheeloAPI !== 'undefined' && typeof WheeloAPI.loginUser === 'function') {
        WheeloAPI.loginUser(user.phone).catch(e => console.warn('API login sync error:', e));
      }
    },
    logoutUser: () => {
      const user = getItem(STORAGE_KEYS.USER_PROFILE, DEFAULT_USER);
      user.isLoggedIn = false;
      setItem(STORAGE_KEYS.USER_PROFILE, user);
      return user;
    },
    getWalletBalance: () => getItem(STORAGE_KEYS.WALLET, 650.00),
    updateWalletBalance: (amount, type = 'Credit', title = 'Wallet Topup') => {
      let current = getItem(STORAGE_KEYS.WALLET, 650.00);
      const numAmt = parseFloat(amount);
      if (type === 'Credit') {
        current += numAmt;
      } else {
        current = Math.max(0, current - numAmt);
      }
      setItem(STORAGE_KEYS.WALLET, current);

      const txns = getItem(STORAGE_KEYS.TRANSACTIONS, []);
      const newTxn = {
        id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
        title: title,
        amount: numAmt,
        type: type,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };
      txns.unshift(newTxn);
      setItem(STORAGE_KEYS.TRANSACTIONS, txns);

      if (typeof WheeloAPI !== 'undefined' && typeof WheeloAPI.topupWallet === 'function') {
        WheeloAPI.topupWallet(numAmt, title).catch(e => console.warn('API wallet topup error:', e));
      }

      return current;
    },
    getTransactions: () => getItem(STORAGE_KEYS.TRANSACTIONS, [
      { id: 'TXN-9041', title: 'Welcome Bonus Credit', amount: 500.00, type: 'Credit', date: 'Jul 24, 2026' },
      { id: 'TXN-9042', title: 'UPI Topup via GPay', amount: 150.00, type: 'Credit', date: 'Jul 24, 2026' }
    ]),
    getSavedPlaces: () => getItem(STORAGE_KEYS.SAVED_PLACES, [
      { id: 'home', name: 'Home', address: 'BTM Layout 2nd Stage', lat: 12.9166, lng: 77.6101, icon: 'fa-house' },
      { id: 'work', name: 'Work / Office', address: 'Manyata Tech Park, Nagavara', lat: 13.0457, lng: 77.6200, icon: 'fa-briefcase' },
      { id: 'gym', name: 'Fitness Gym', address: 'Koramangala 5th Block', lat: 12.9348, lng: 77.6245, icon: 'fa-dumbbell' }
    ]),
    savePlace: (place) => {
      const places = getItem(STORAGE_KEYS.SAVED_PLACES, []);
      places.push(place);
      setItem(STORAGE_KEYS.SAVED_PLACES, places);

      if (typeof WheeloAPI !== 'undefined' && typeof WheeloAPI.addSavedPlace === 'function') {
        WheeloAPI.addSavedPlace(place).catch(e => console.warn('API place sync error:', e));
      }
    },
    getRideHistory: () => getItem(STORAGE_KEYS.RIDE_HISTORY, []),
    addRideHistory: (ride) => {
      const history = getItem(STORAGE_KEYS.RIDE_HISTORY, []);
      history.unshift(ride);
      setItem(STORAGE_KEYS.RIDE_HISTORY, history);
    },
    getCaptainKYC: () => getItem(STORAGE_KEYS.CAPTAIN_KYC, {
      verified: true,
      licenseNo: 'DL-0420210089421',
      expiryDate: '2032-11-15',
      rcStatus: 'Verified (KA-05-EV-4890)',
      insuranceStatus: 'Active (HDFC ERGO)',
      pollutionCert: 'Valid till Dec 2026',
      rating: 4.89
    }),
    updateCaptainKYC: (kyc) => setItem(STORAGE_KEYS.CAPTAIN_KYC, kyc),
    getSettings: () => getItem(STORAGE_KEYS.SETTINGS, { soundEnabled: true, theme: 'dark' }),
    updateSettings: (s) => setItem(STORAGE_KEYS.SETTINGS, s)
  };
})();
