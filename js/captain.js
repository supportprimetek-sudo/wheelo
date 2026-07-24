/* ==========================================================================
   WHEELO - Production Captain / Driver Operating System Engine
   ========================================================================== */

const WheeloCaptain = (function () {
  let isOnline = true;
  let activeOffer = null;
  let activeTrip = null;
  let offerTimeRemaining = 15;

  let captainData = {
    name: 'Captain Driver',
    rating: 5.0,
    vehicleNo: 'Pending Onboarding',
    vehicleModel: 'Registered Vehicle',
    todayEarnings: 0,
    tripsCompleted: 0,
    acceptanceRate: 100,
    bonusEarned: 0
  };

  const TURN_INSTRUCTIONS = [
    'Head north on main corridor toward Tech Hub',
    'In 200m, turn right onto 100ft Main Road',
    'Keep left at the flyover signal',
    'In 150m, pass by MG Road Metro Gate 2',
    'Arriving at drop location on your left'
  ];

  function toggleOnlineStatus(status) {
    isOnline = status !== undefined ? status : !isOnline;
    return isOnline;
  }

  function getOnlineStatus() {
    return isOnline;
  }

  function getCaptainProfile() {
    return captainData;
  }

  function getKYCStatus() {
    return WheeloStorage.getCaptainKYC();
  }

  function createRideOffer(bookingDetails) {
    if (!isOnline) return null;

    const estimatedEarnings = Math.round(bookingDetails.fare.finalFare * 0.85);

    activeOffer = {
      id: 'OFFER-' + Math.floor(1000 + Math.random() * 9000),
      pickup: bookingDetails.pickup.address,
      drop: bookingDetails.drop.address,
      distanceKm: bookingDetails.fare.distanceKm,
      timeMin: bookingDetails.fare.timeMin,
      totalFare: bookingDetails.fare.finalFare,
      driverEarnings: estimatedEarnings,
      vehicleId: bookingDetails.vehicleId,
      customerName: 'Ananya Sharma',
      customerRating: 4.95,
      otp: bookingDetails.otp
    };

    offerTimeRemaining = 15;
    return activeOffer;
  }

  function acceptOffer() {
    if (!activeOffer) return false;
    activeTrip = { ...activeOffer, status: 'ACCEPTED' };
    activeOffer = null;
    return activeTrip;
  }

  function declineOffer(reason = 'Far Pickup') {
    activeOffer = null;
    console.log('Offer declined by captain:', reason);
  }

  function getNextTurnInstruction(progressPercent) {
    if (progressPercent < 20) return TURN_INSTRUCTIONS[0];
    if (progressPercent < 40) return TURN_INSTRUCTIONS[1];
    if (progressPercent < 65) return TURN_INSTRUCTIONS[2];
    if (progressPercent < 85) return TURN_INSTRUCTIONS[3];
    return TURN_INSTRUCTIONS[4];
  }

  function completeCaptainTrip() {
    if (!activeTrip) return;
    captainData.todayEarnings += activeTrip.driverEarnings;
    captainData.tripsCompleted += 1;
    activeTrip = null;
  }

  return {
    toggleOnlineStatus,
    getOnlineStatus,
    getCaptainProfile,
    getKYCStatus,
    createRideOffer,
    acceptOffer,
    declineOffer,
    getNextTurnInstruction,
    completeCaptainTrip,
    getActiveOffer: () => activeOffer,
    getActiveTrip: () => activeTrip
  };
})();
