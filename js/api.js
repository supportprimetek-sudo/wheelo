/* ==========================================================================
   WHEELO - Frontend REST API Client
   ========================================================================== */

const WheeloAPI = (function () {
  const BASE_URL = window.location.origin.includes('http') ? window.location.origin : 'http://localhost:3000';

  async function request(endpoint, options = {}) {
    try {
      const response = await fetch(`${BASE_URL}/api${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Server Request Failed');
      }

      return await response.json();
    } catch (e) {
      console.warn(`API Error [${endpoint}]:`, e.message);
      return null;
    }
  }

  return {
    checkHealth: () => request('/health'),
    getAdminDashboard: () => request('/admin/dashboard'),
    getVehicles: () => request('/vehicles'),
    updateVehicle: (id, vehicleData) => request('/admin/vehicles/update', {
      method: 'POST',
      body: JSON.stringify({ id, vehicleData })
    }),
    addVehicle: (vehicleData) => request('/admin/vehicles/add', {
      method: 'POST',
      body: JSON.stringify(vehicleData)
    }),
    deleteVehicle: (id) => request('/admin/vehicles/delete', {
      method: 'POST',
      body: JSON.stringify({ id })
    }),
    updateKYCStatus: (verified) => request('/admin/kyc/update', {
      method: 'POST',
      body: JSON.stringify({ verified })
    }),
    getUser: (userId = 'rider_ananya') => request(`/users/${userId}`),
    registerUser: (userData) => request('/users/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
    loginUserEmail: (email, password) => request('/users/login-email', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
    loginUser: (phone) => request('/users/login', {
      method: 'POST',
      body: JSON.stringify({ phone })
    }),
    submitDriverKYC: (kycData) => request('/captain/kyc/submit', {
      method: 'POST',
      body: JSON.stringify(kycData)
    }),
    getSavedPlaces: (userId = 'rider_ananya') => request(`/places?userId=${userId}`),
    addSavedPlace: (place) => request('/places', {
      method: 'POST',
      body: JSON.stringify(place)
    }),
    validateCoupon: (code) => request(`/coupons/validate?code=${encodeURIComponent(code)}`),
    getTransactions: (userId = 'rider_ananya') => request(`/wallet/transactions?userId=${userId}`),
    topupWallet: (amount, paymentMethod) => request('/wallet/topup', {
      method: 'POST',
      body: JSON.stringify({ userId: 'rider_ananya', amount, paymentMethod })
    }),
    bookRide: (bookingData) => request('/rides/book', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    }),
    getRide: (rideId) => request(`/rides/${rideId}`),
    acceptRide: (rideId) => request(`/rides/${rideId}/accept`, { method: 'POST' }),
    startRide: (rideId, otp) => request(`/rides/${rideId}/start`, {
      method: 'POST',
      body: JSON.stringify({ otp })
    }),
    completeRide: (rideId) => request(`/rides/${rideId}/complete`, { method: 'POST' }),
    getCaptainKYC: () => request('/captain/kyc')
  };
})();
