/* ==========================================================================
   WHEELO - Production Ride Lifecycle Simulator with Audio Cues & AI Safety
   ========================================================================== */

const WheeloSimulation = (function () {
  let currentStage = 'IDLE';
  let speedMultiplier = 1.0;
  let activeRideData = null;
  let otpCode = '1234';

  function generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  function startRideSimulation(bookingData) {
    otpCode = generateOTP();
    currentStage = 'SEARCHING';

    activeRideData = {
      ...bookingData,
      otp: otpCode,
      progress: 0,
      stage: 'SEARCHING'
    };

    WheeloAudio.playBookingChime();
    WheeloMap.showRadarPulse();
    if (window.WheeloApp) window.WheeloApp.updateRideUI(activeRideData);

    setTimeout(() => {
      if (currentStage !== 'SEARCHING') return;
      assignCaptainStage();
    }, 3500);
  }

  function assignCaptainStage() {
    currentStage = 'ASSIGNED';
    activeRideData.stage = 'ASSIGNED';
    WheeloMap.hideRadarPulse();

    WheeloAudio.playIncomingAlert();

    const pickup = WheeloMap.getPickupLocation();
    const driverStart = [pickup.lat + 0.004, pickup.lng + 0.004];
    WheeloMap.setAssignedDriverMarker(activeRideData.vehicleId, driverStart);

    if (window.WheeloApp) window.WheeloApp.updateRideUI(activeRideData);

    const waypointsToPickup = [
      driverStart,
      [pickup.lat + 0.002, pickup.lng + 0.002],
      [pickup.lat, pickup.lng]
    ];

    const driverMarker = WheeloMap.getDriverMarker();
    WheeloMap.animateMarker(
      driverMarker,
      waypointsToPickup,
      activeRideData.vehicleId,
      speedMultiplier * 1.5,
      null,
      () => {
        currentStage = 'ARRIVED';
        activeRideData.stage = 'ARRIVED';
        WheeloAudio.playIncomingAlert();
        if (window.WheeloApp) window.WheeloApp.updateRideUI(activeRideData);
      }
    );
  }

  function verifyOTPAndStartTrip(enteredOtp) {
    if (enteredOtp !== otpCode) {
      return { success: false, message: 'Invalid OTP PIN! Please check the code shown on rider screen.' };
    }

    currentStage = 'IN_TRIP';
    activeRideData.stage = 'IN_TRIP';

    WheeloAudio.playOtpSuccess();

    if (window.WheeloApp) window.WheeloApp.updateRideUI(activeRideData);

    const route = WheeloMap.calculateAndDrawRoute();
    const driverMarker = WheeloMap.getDriverMarker();

    WheeloMap.animateMarker(
      driverMarker,
      route.waypoints,
      activeRideData.vehicleId,
      speedMultiplier,
      (progress) => {
        activeRideData.progress = progress;
        if (window.WheeloApp) window.WheeloApp.updateTripProgressUI(progress);

        // Turn by turn guidance update for Captain
        const nextInstruction = WheeloCaptain.getNextTurnInstruction(progress);
        if (window.WheeloApp) window.WheeloApp.updateCaptainNavigationUI(nextInstruction);
      },
      () => {
        currentStage = 'COMPLETED';
        activeRideData.stage = 'COMPLETED';
        activeRideData.progress = 100;

        WheeloAudio.playTripCompleteSound();

        if (activeRideData.paymentMethod === 'wallet') {
          WheeloPricing.deductWalletFunds(activeRideData.fare.finalFare, activeRideData.otp);
        }

        WheeloCaptain.completeCaptainTrip();

        // Save to persistent storage
        WheeloStorage.addRideHistory({
          id: activeRideData.otp,
          date: 'Just now',
          vehicle: activeRideData.fare.vehicleName,
          pickup: activeRideData.pickup.address,
          drop: activeRideData.drop.address,
          fare: activeRideData.fare.finalFare
        });

        if (window.WheeloApp) window.WheeloApp.onTripCompleted(activeRideData);
      }
    );

    return { success: true };
  }

  function setSpeedMultiplier(speed) {
    speedMultiplier = parseFloat(speed);
    return speedMultiplier;
  }

  function cancelRide() {
    currentStage = 'IDLE';
    WheeloMap.hideRadarPulse();
    activeRideData = null;
  }

  return {
    startRideSimulation,
    verifyOTPAndStartTrip,
    setSpeedMultiplier,
    cancelRide,
    getCurrentStage: () => currentStage,
    getSpeedMultiplier: () => speedMultiplier,
    getActiveRideData: () => activeRideData
  };
})();
