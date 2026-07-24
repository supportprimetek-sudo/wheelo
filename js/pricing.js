/* ==========================================================================
   WHEELO - Enterprise Dynamic Pricing & Vehicle Fleet Engine
   ========================================================================== */

const WheeloPricing = (function () {
  let vehicleTariffsList = [
    { id: 'bike', name: 'Wheelo Bike', baseFare: 15, perKmRate: 5, perMinRate: 1.0, minFare: 25, capacity: '1 Rider', icon: 'fa-motorcycle', badge: 'FASTEST' },
    { id: 'auto', name: 'Wheelo Auto', baseFare: 20, perKmRate: 5, perMinRate: 1.5, minFare: 35, capacity: '3 Passengers', icon: 'fa-taxi', badge: 'POPULAR' },
    { id: 'cab', name: 'Economy Cab', baseFare: 30, perKmRate: 5, perMinRate: 2.0, minFare: 50, capacity: '4 Passengers', icon: 'fa-car-side', badge: 'AC' },
    { id: 'sedan', name: 'Premium Sedan', baseFare: 45, perKmRate: 5, perMinRate: 2.5, minFare: 75, capacity: '4 Passengers', icon: 'fa-car', badge: 'LUXURY' },
    { id: 'parcel', name: 'Express Parcel', baseFare: 20, perKmRate: 5, perMinRate: 1.0, minFare: 30, capacity: 'Package', icon: 'fa-box-open', badge: 'INSTANT' }
  ];

  let activeCoupon = null;
  let hasIntermediateStop = false;
  let driverTip = 0;
  let isScheduledBooking = false;

  async function syncVehiclesFromAPI() {
    if (typeof WheeloAPI !== 'undefined' && typeof WheeloAPI.getVehicles === 'function') {
      const data = await WheeloAPI.getVehicles();
      if (data && Array.isArray(data) && data.length > 0) {
        vehicleTariffsList = data;
      }
    }
    return vehicleTariffsList;
  }

  function calculateFare(vehicleId, distanceKm, durationMin = 15) {
    const tariff = vehicleTariffsList.find(v => v.id === vehicleId) || vehicleTariffsList[0];
    
    const distanceCost = distanceKm * tariff.perKmRate;
    const timeCost = durationMin * tariff.perMinRate;
    const stopFee = hasIntermediateStop ? 30 : 0;
    const scheduleFee = isScheduledBooking ? 25 : 0;

    let subtotal = tariff.baseFare + distanceCost + timeCost + stopFee + scheduleFee;
    let finalFare = Math.max(tariff.minFare, subtotal);
    let discountAmount = 0;

    if (activeCoupon) {
      discountAmount = Math.min(40, (finalFare * 50) / 100);
      finalFare = Math.max(10, finalFare - discountAmount);
    }

    finalFare += driverTip;

    return {
      vehicleId: tariff.id,
      vehicleName: tariff.name,
      baseFare: tariff.baseFare,
      perKmRate: tariff.perKmRate,
      distanceKm: parseFloat(distanceKm).toFixed(1),
      distanceCost: distanceCost.toFixed(2),
      timeCost: timeCost.toFixed(2),
      stopFee: stopFee,
      scheduleFee: scheduleFee,
      driverTip: driverTip,
      discountAmount: discountAmount.toFixed(2),
      finalFare: Math.round(finalFare),
      etaMin: Math.max(2, Math.ceil(distanceKm * 0.8))
    };
  }

  function applyCoupon(code) {
    if (!code) return { success: false, message: 'Please enter a promo code' };
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode === 'FIRST50' || cleanCode === 'WHEELO20') {
      activeCoupon = cleanCode;
      return { success: true, code: cleanCode, coupon: { desc: '50% OFF Applied' } };
    }
    return { success: false, message: 'Invalid promo code' };
  }

  function getWalletBalance() {
    if (typeof WheeloStorage !== 'undefined' && typeof WheeloStorage.getWalletBalance === 'function') {
      return WheeloStorage.getWalletBalance();
    }
    return 650.00;
  }

  function addWalletFunds(amount, title = 'Wallet Topup') {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return false;
    if (typeof WheeloStorage !== 'undefined' && typeof WheeloStorage.updateWalletBalance === 'function') {
      WheeloStorage.updateWalletBalance(amt, 'Credit', title);
    }
    return true;
  }

  function getTransactions() {
    if (typeof WheeloStorage !== 'undefined' && typeof WheeloStorage.getTransactions === 'function') {
      return WheeloStorage.getTransactions();
    }
    return [];
  }

  return {
    getVehicleTariffsList: () => vehicleTariffsList,
    syncVehiclesFromAPI,
    calculateFare,
    applyCoupon,
    setHasIntermediateStop: (val) => { hasIntermediateStop = val; },
    setDriverTip: (val) => { driverTip = val; },
    setIsScheduledBooking: (val) => { isScheduledBooking = val; },
    getWalletBalance,
    addWalletFunds,
    getTransactions
  };
})();
