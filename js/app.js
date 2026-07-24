/* ==========================================================================
   WHEELO - Enterprise Application Controller & State Orchestrator
   ========================================================================== */

const WheeloApp = (function () {
  let activeMode = 'rider';
  let selectedVehicle = 'bike';
  let selectedPayment = 'wallet';
  let mapSelectMode = 'pickup';
  let currentCalculatedFares = {};
  let qrCountdownTimer = null;
  let searchDebounceTimer = null;
  let deferredPwaPrompt = null;

  async function init() {
    WheeloMap.initMap('map');

    bindHeaderEvents();
    bindRiderPanelEvents();
    bindCaptainPanelEvents();
    bindModalEvents();
    bindMapLayerSwitcher();
    bindRealPlaceSearch();
    bindProfileAuthEvents();
    bindDriverKYCOnboardingEvents();
    initPWAInstallation();

    renderSavedPlacesChips();
    renderLandmarkChips();
    updateUserProfileUI();

    await syncAndRenderVehicleCards();

    setTimeout(() => {
      updateCalculatedFares();
    }, 600);

    updateWalletDisplay();

    // Check login session on load - if logged out, immediately prompt login screen
    const user = WheeloStorage.getUserProfile();
    if (!user || !user.isLoggedIn) {
      setTimeout(() => {
        openLoginModal();
      }, 800);
    }

    console.log('WHEELO Enterprise Production App Ready.');
  }

  async function syncAndRenderVehicleCards() {
    const list = await WheeloPricing.syncVehiclesFromAPI();
    const container = document.querySelector('.vehicle-selector');
    if (!container) return;

    container.innerHTML = '<div class="section-label">Select Vehicle Category</div>';

    list.forEach((v, idx) => {
      const isSel = v.id === selectedVehicle || idx === 0;
      if (isSel) selectedVehicle = v.id;

      const card = document.createElement('div');
      card.className = `vehicle-card ${isSel ? 'selected' : ''}`;
      card.dataset.vehicle = v.id;
      card.innerHTML = `
        <div class="vehicle-left">
          <div class="vehicle-icon-wrap"><i class="fas ${v.icon || 'fa-car'}"></i></div>
          <div class="vehicle-info">
            <h4>${v.name} ${v.badge ? `<span class="badge-tag">${v.badge}</span>` : ''}</h4>
            <p>${v.capacity}</p>
            <span id="eta-${v.id}" class="eta-tag">2 mins away</span>
          </div>
        </div>
        <div class="vehicle-right">
          <div id="fare-${v.id}" class="fare-price">₹${v.minFare}</div>
        </div>
      `;

      card.addEventListener('click', function () {
        document.querySelectorAll('.vehicle-card').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        selectedVehicle = this.dataset.vehicle;
      });

      container.appendChild(card);
    });
  }

  function initPWAInstallation() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('[PWA] ServiceWorker registered:', reg.scope))
        .catch(err => console.warn('[PWA] ServiceWorker registration error:', err));
    }

    const pwaBanner = document.getElementById('pwa-install-banner');
    const btnInstall = document.getElementById('btn-pwa-install');
    const btnDismiss = document.getElementById('btn-pwa-dismiss');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPwaPrompt = e;
      if (pwaBanner) pwaBanner.style.display = 'flex';
    });

    if (btnInstall) {
      btnInstall.addEventListener('click', async () => {
        if (deferredPwaPrompt) {
          deferredPwaPrompt.prompt();
          const choiceResult = await deferredPwaPrompt.userChoice;
          if (choiceResult.outcome === 'accepted') {
            console.log('[PWA] User accepted the PWA install prompt');
          }
          deferredPwaPrompt = null;
        }
        if (pwaBanner) pwaBanner.style.display = 'none';
      });
    }

    if (btnDismiss) {
      btnDismiss.addEventListener('click', () => {
        if (pwaBanner) pwaBanner.style.display = 'none';
      });
    }
  }

  function bindHeaderEvents() {
    const btnRiderMode = document.getElementById('btn-mode-rider');
    const btnCaptainMode = document.getElementById('btn-mode-captain');

    btnRiderMode.addEventListener('click', () => setMode('rider'));
    btnCaptainMode.addEventListener('click', () => setMode('captain'));

    const walletBtn = document.getElementById('wallet-badge-btn');
    if (walletBtn) walletBtn.addEventListener('click', openWalletModal);
    const sosBtn = document.getElementById('sos-btn');
    if (sosBtn) sosBtn.addEventListener('click', openSOSModal);

    const soundBtn = document.getElementById('btn-sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const isMuted = WheeloAudio.toggleMute();
        soundBtn.innerHTML = isMuted ? '<i class="fas fa-volume-xmark"></i>' : '<i class="fas fa-volume-high"></i>';
        soundBtn.style.color = isMuted ? '#EF4444' : '#FFD100';
      });
    }
  }

  function bindProfileAuthEvents() {
    const avatarBtn = document.getElementById('header-profile-avatar');
    if (avatarBtn) {
      avatarBtn.addEventListener('click', () => {
        const user = WheeloStorage.getUserProfile();
        if (user && user.isLoggedIn) {
          openProfileModal();
        } else {
          openLoginModal();
        }
      });
    }

    const tabAuthLogin = document.getElementById('tab-auth-login');
    const tabAuthSignup = document.getElementById('tab-auth-signup');
    const formLogin = document.getElementById('auth-form-login');
    const formSignup = document.getElementById('auth-form-signup');

    if (tabAuthLogin && tabAuthSignup) {
      tabAuthLogin.addEventListener('click', () => {
        tabAuthLogin.classList.add('active');
        tabAuthSignup.classList.remove('active');
        formLogin.style.display = 'flex';
        formSignup.style.display = 'none';
      });

      tabAuthSignup.addEventListener('click', () => {
        tabAuthSignup.classList.add('active');
        tabAuthLogin.classList.remove('active');
        formSignup.style.display = 'flex';
        formLogin.style.display = 'none';
      });
    }

    const btnSubmitEmailLogin = document.getElementById('btn-submit-email-login');
    if (btnSubmitEmailLogin) {
      btnSubmitEmailLogin.addEventListener('click', async () => {
        const email = document.getElementById('input-login-email').value;
        const password = document.getElementById('input-login-password').value;

        if (!email || !password) {
          alert('Please enter both Email Address and Password.');
          return;
        }

        const res = await WheeloAPI.loginUserEmail(email, password);
        if (res && res.success) {
          const user = res.user;
          const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'AS';
          
          const updatedUser = {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            initials: initials,
            isLoggedIn: true,
            memberTier: user.member_tier || 'Gold Rider'
          };

          WheeloStorage.saveUserProfile(updatedUser);
          updateUserProfileUI();
          document.getElementById('modal-login').classList.remove('active');
          WheeloAudio.playSuccessChord();
          alert(`Welcome back, ${user.name}! Logged in successfully.`);
        } else {
          alert(res ? res.message : 'Invalid Email or Password.');
        }
      });
    }

    const btnSubmitSignup = document.getElementById('btn-submit-signup');
    if (btnSubmitSignup) {
      btnSubmitSignup.addEventListener('click', async () => {
        const name = document.getElementById('input-signup-name').value;
        const phone = document.getElementById('input-signup-phone').value;
        const email = document.getElementById('input-signup-email').value;
        const password = document.getElementById('input-signup-password').value;

        if (!name || !email || !password) {
          alert('Please fill out Name, Email, and Password.');
          return;
        }

        const res = await WheeloAPI.registerUser({ name, phone: phone ? `+91 ${phone}` : '+91 9876543210', email, password });
        if (res && res.success) {
          const user = res.user;
          const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();

          const newUserProfile = {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            initials: initials,
            isLoggedIn: true,
            memberTier: 'Gold Rider'
          };

          WheeloStorage.saveUserProfile(newUserProfile);
          updateUserProfileUI();
          document.getElementById('modal-login').classList.remove('active');
          WheeloAudio.playSuccessChord();
          alert(`Congratulations ${user.name}! Your account has been created.`);
        } else {
          alert(res ? res.message : 'Account creation failed.');
        }
      });
    }

    const btnLogout = document.getElementById('btn-profile-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        WheeloStorage.logoutUser();
        updateUserProfileUI();
        document.getElementById('modal-profile').classList.remove('active');
        // Immediately redirect to login screen
        openLoginModal();
      });
    }
  }

  function bindDriverKYCOnboardingEvents() {
    const btnSubmitKyc = document.getElementById('btn-submit-kyc-docs');
    if (!btnSubmitKyc) return;

    btnSubmitKyc.addEventListener('click', async () => {
      const licenseNo = document.getElementById('input-kyc-license').value;
      const rcNo = document.getElementById('input-kyc-rc').value;
      const licenseFileInput = document.getElementById('input-kyc-doc-license');
      const rcFileInput = document.getElementById('input-kyc-doc-rc');

      let licenseDoc = 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200';
      let rcDoc = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=200';

      const readAsDataURL = (file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });

      if (licenseFileInput && licenseFileInput.files[0]) {
        licenseDoc = await readAsDataURL(licenseFileInput.files[0]);
      }
      if (rcFileInput && rcFileInput.files[0]) {
        rcDoc = await readAsDataURL(rcFileInput.files[0]);
      }

      const res = await WheeloAPI.submitDriverKYC({ licenseNo, rcNo, licenseDoc, rcDoc });
      if (res && res.success) {
        document.getElementById('kyc-submit-status-alert').style.display = 'block';
        WheeloAudio.playSuccessChord();
        alert('Driver KYC documents uploaded & submitted to Admin for verification!');
      }
    });
  }

  function updateUserProfileUI() {
    const user = WheeloStorage.getUserProfile();
    const avatarElem = document.getElementById('header-profile-avatar');

    if (!user || !user.isLoggedIn) {
      if (avatarElem) {
        avatarElem.innerHTML = '<i class="fas fa-user-lock"></i>';
        avatarElem.title = 'Click to Log In / Sign Up';
      }
    } else {
      if (avatarElem) {
        avatarElem.textContent = user.initials || 'AS';
        avatarElem.title = `${user.name} (${user.memberTier})`;
      }
      document.getElementById('profile-user-name').textContent = user.name;
      document.getElementById('profile-user-phone').textContent = user.phone;
      document.getElementById('profile-user-email').textContent = user.email;
      document.getElementById('profile-user-tier').textContent = user.memberTier.toUpperCase();
      document.getElementById('profile-modal-avatar').textContent = user.initials || 'AS';
    }
  }

  function openProfileModal() {
    updateUserProfileUI();
    document.getElementById('modal-profile').classList.add('active');
  }

  function openLoginModal() {
    document.getElementById('modal-login').classList.add('active');
  }

  function bindMapLayerSwitcher() {
    const btns = document.querySelectorAll('.layer-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', function () {
        btns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const layerName = this.dataset.layer;
        WheeloMap.switchMapLayer(layerName);
      });
    });
  }

  function bindRealPlaceSearch() {
    const pickupInput = document.getElementById('input-pickup');
    const stopInput = document.getElementById('input-stop');
    const dropInput = document.getElementById('input-drop');
    const resultsContainer = document.getElementById('autocomplete-results');

    [pickupInput, stopInput, dropInput].forEach(input => {
      if (!input) return;

      input.addEventListener('input', function () {
        const query = this.value;
        const inputType = this.id === 'input-drop' ? 'drop' : (this.id === 'input-stop' ? 'stop' : 'pickup');

        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

        if (!query || query.trim().length < 2) {
          if (resultsContainer) resultsContainer.style.display = 'none';
          return;
        }

        searchDebounceTimer = setTimeout(async () => {
          const results = await WheeloMap.searchRealPlaces(query);
          renderAutocompleteResults(results, input, inputType);
        }, 300);
      });

      input.addEventListener('keydown', async function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const inputType = this.id === 'input-drop' ? 'drop' : (this.id === 'input-stop' ? 'stop' : 'pickup');
          const match = await WheeloMap.geocodeAddress(this.value, inputType);
          if (match) {
            this.value = match.name;
            if (resultsContainer) resultsContainer.style.display = 'none';
            onLocationUpdated();
          }
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (resultsContainer && !e.target.closest('.location-box')) {
        resultsContainer.style.display = 'none';
      }
    });
  }

  function renderAutocompleteResults(results, targetInput, inputType) {
    const container = document.getElementById('autocomplete-results');
    if (!container) return;

    container.innerHTML = '';
    if (!results || results.length === 0) {
      container.style.display = 'none';
      return;
    }

    results.forEach(item => {
      const row = document.createElement('div');
      row.className = 'autocomplete-item';
      row.innerHTML = `
        <i class="fas fa-location-dot" style="color: var(--primary); font-size: 14px;"></i>
        <div style="flex: 1; overflow: hidden;">
          <div class="title">${item.name}</div>
          <div class="sub">${item.fullAddress}</div>
        </div>
      `;

      row.addEventListener('click', () => {
        targetInput.value = item.name;
        container.style.display = 'none';

        if (inputType === 'drop') {
          WheeloMap.setDropLocation(item.lat, item.lng, item.fullAddress);
        } else if (inputType === 'stop') {
          WheeloMap.setIntermediateStop(item.lat, item.lng, item.fullAddress);
        } else {
          WheeloMap.setPickupLocation(item.lat, item.lng, item.fullAddress);
        }

        onLocationUpdated();
      });

      container.appendChild(row);
    });

    container.style.display = 'flex';
  }

  function setMode(mode) {
    activeMode = mode;
    const btnRider = document.getElementById('btn-mode-rider');
    const btnCaptain = document.getElementById('btn-mode-captain');

    const panelRider = document.getElementById('panel-rider');
    const panelCaptain = document.getElementById('panel-captain');

    if (mode === 'rider') {
      btnRider.classList.add('active');
      btnCaptain.classList.remove('active');
      panelRider.classList.add('active');
      panelCaptain.classList.remove('active');
    } else {
      btnCaptain.classList.add('active');
      btnRider.classList.remove('active');
      panelCaptain.classList.add('active');
      panelRider.classList.remove('active');
      renderCaptainDashboard();
    }
  }

  function bindRiderPanelEvents() {
    const pickupInput = document.getElementById('input-pickup');
    const stopInput = document.getElementById('input-stop');
    const dropInput = document.getElementById('input-drop');

    pickupInput.addEventListener('focus', () => { mapSelectMode = 'pickup'; });
    if (stopInput) stopInput.addEventListener('focus', () => { mapSelectMode = 'stop'; });
    dropInput.addEventListener('focus', () => { mapSelectMode = 'drop'; });

    const btnGpsPickup = document.getElementById('btn-gps-pickup');
    if (btnGpsPickup) {
      btnGpsPickup.addEventListener('click', () => {
        WheeloMap.locateUserGPS(true);
      });
    }

    const btnAddStop = document.getElementById('btn-add-stop-toggle');
    const stopGroup = document.getElementById('stop-input-group');
    if (btnAddStop && stopGroup) {
      btnAddStop.addEventListener('click', () => {
        const isVisible = stopGroup.style.display !== 'none';
        if (isVisible) {
          stopGroup.style.display = 'none';
          WheeloMap.setIntermediateStop(null);
          WheeloPricing.setHasIntermediateStop(false);
          btnAddStop.innerHTML = '<i class="fas fa-plus"></i> Add Stop';
        } else {
          stopGroup.style.display = 'flex';
          WheeloPricing.setHasIntermediateStop(true);
          btnAddStop.innerHTML = '<i class="fas fa-minus"></i> Remove Stop';
        }
        updateCalculatedFares();
      });
    }

    document.getElementById('btn-apply-promo').addEventListener('click', applyPromoCode);
    
    const btnBook = document.getElementById('btn-book-now');
    if (btnBook) {
      btnBook.onclick = handleBookRide;
    }

    const btnSchedule = document.getElementById('btn-schedule-trigger');
    if (btnSchedule) {
      btnSchedule.addEventListener('click', () => {
        document.getElementById('modal-schedule').classList.add('active');
      });
    }

    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        WheeloSimulation.setSpeedMultiplier(this.dataset.speed);
      });
    });

    document.getElementById('btn-cancel-ride').addEventListener('click', () => {
      WheeloSimulation.cancelRide();
      showBookingPanel();
    });
  }

  function renderSavedPlacesChips() {
    const container = document.getElementById('saved-places-chips');
    if (!container) return;
    container.innerHTML = '';

    const places = WheeloStorage.getSavedPlaces();
    places.forEach(p => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `<i class="fas ${p.icon}"></i> ${p.name}`;
      chip.addEventListener('click', () => {
        if (mapSelectMode === 'stop') {
          WheeloMap.setIntermediateStop(p.lat, p.lng, p.address);
          document.getElementById('input-stop').value = p.address;
        } else if (mapSelectMode === 'drop') {
          WheeloMap.setDropLocation(p.lat, p.lng, p.address);
          document.getElementById('input-drop').value = p.address;
        } else {
          WheeloMap.setPickupLocation(p.lat, p.lng, p.address);
          document.getElementById('input-pickup').value = p.address;
        }
        onLocationUpdated();
      });
      container.appendChild(chip);
    });
  }

  function renderLandmarkChips() {
    const container = document.getElementById('landmark-chips-container');
    if (!container) return;

    container.innerHTML = '';
    WheeloMap.LANDMARKS.forEach(lm => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `<i class="fas fa-location-dot"></i> ${lm.name}`;
      chip.addEventListener('click', () => {
        if (mapSelectMode === 'stop') {
          WheeloMap.setIntermediateStop(lm.lat, lm.lng, lm.name);
          document.getElementById('input-stop').value = lm.name;
        } else if (mapSelectMode === 'drop') {
          WheeloMap.setDropLocation(lm.lat, lm.lng, lm.name);
          document.getElementById('input-drop').value = lm.name;
        } else {
          WheeloMap.setPickupLocation(lm.lat, lm.lng, lm.name);
          document.getElementById('input-pickup').value = lm.name;
        }
        onLocationUpdated();
      });
      container.appendChild(chip);
    });
  }

  function updateCalculatedFares() {
    let route = WheeloMap.calculateAndDrawRoute();
    const distanceKm = route ? route.distanceKm : 5.2;
    const durationMin = route ? route.durationMin : 15;

    const list = WheeloPricing.getVehicleTariffsList();
    currentCalculatedFares = {};

    list.forEach(v => {
      const fare = WheeloPricing.calculateFare(v.id, distanceKm, durationMin);
      currentCalculatedFares[v.id] = fare;

      const fareElem = document.getElementById(`fare-${v.id}`);
      const etaElem = document.getElementById(`eta-${v.id}`);
      if (fareElem) fareElem.textContent = `₹${fare.finalFare}`;
      if (etaElem) etaElem.textContent = `${fare.etaMin} mins away`;
    });

    const summaryElem = document.getElementById('route-summary-text');
    if (summaryElem) {
      const stopInfo = WheeloMap.getIntermediateStop() ? ' • 1 Intermediate Stop (+₹30)' : '';
      summaryElem.textContent = `${distanceKm.toFixed(1)} km • approx ${durationMin} mins${stopInfo}`;
    }
  }

  function applyPromoCode() {
    const codeInput = document.getElementById('input-promo-code');
    const res = WheeloPricing.applyCoupon(codeInput.value);
    const msgElem = document.getElementById('promo-status-msg');

    if (res.success) {
      msgElem.style.color = '#10B981';
      msgElem.textContent = `Applied ${res.code}! ${res.coupon.desc}`;
      updateCalculatedFares();
    } else {
      msgElem.style.color = '#EF4444';
      msgElem.textContent = res.message;
    }
  }

  async function handleBookRide() {
    try {
      const user = WheeloStorage.getUserProfile();
      if (user && !user.isLoggedIn) {
        alert('Please log in with your account before booking a ride.');
        openLoginModal();
        return;
      }

      let fare = currentCalculatedFares[selectedVehicle] || WheeloPricing.calculateFare(selectedVehicle, 5.2, 15);

      const bookingData = {
        vehicleId: selectedVehicle,
        pickup: WheeloMap.getPickupLocation(),
        intermediateStop: WheeloMap.getIntermediateStop(),
        drop: WheeloMap.getDropLocation(),
        fare: fare,
        paymentMethod: selectedPayment
      };

      if (typeof WheeloAPI !== 'undefined' && typeof WheeloAPI.bookRide === 'function') {
        WheeloAPI.bookRide(bookingData).catch(err => console.warn('Backend API record deferred:', err));
      }

      showActiveRidePanel();
      WheeloSimulation.startRideSimulation(bookingData);
      WheeloCaptain.createRideOffer(bookingData);
    } catch (e) {
      console.error('Book ride handler exception:', e);
      showActiveRidePanel();
    }
  }

  function showBookingPanel() {
    document.getElementById('booking-view-container').style.display = 'flex';
    document.getElementById('active-ride-container').style.display = 'none';
  }

  function showActiveRidePanel() {
    document.getElementById('booking-view-container').style.display = 'none';
    document.getElementById('active-ride-container').style.display = 'flex';
  }

  function updateRideUI(activeRide) {
    if (!activeRide) return;

    const statusTitle = document.getElementById('ride-status-title');
    const statusDesc = document.getElementById('ride-status-desc');
    const otpBox = document.getElementById('otp-box-display');
    const otpVal = document.getElementById('otp-code-val');

    const otpCode = activeRide.otp || activeRide.pin || '4892';
    if (otpVal) otpVal.textContent = otpCode;

    if (activeRide.stage === 'SEARCHING') {
      statusTitle.textContent = 'Searching Nearby Captains...';
      statusDesc.textContent = 'Connecting you to top-rated drivers nearby';
      if (otpBox) otpBox.style.display = 'block';
    } else if (activeRide.stage === 'ASSIGNED') {
      statusTitle.textContent = 'Captain Assigned & On the Way';
      statusDesc.textContent = 'Captain is moving to your pickup location';
      if (otpBox) otpBox.style.display = 'block';
    } else if (activeRide.stage === 'ARRIVED') {
      statusTitle.textContent = 'Captain Arrived at Pickup!';
      statusDesc.textContent = 'Please share your 4-digit PIN OTP with captain';
      if (otpBox) otpBox.style.display = 'block';
    } else if (activeRide.stage === 'IN_TRIP') {
      statusTitle.textContent = 'En Route to Destination';
      statusDesc.textContent = 'Google Maps live tracking active along polyline';
      if (otpBox) otpBox.style.display = 'none';
    }
  }

  function updateTripProgressUI(progress) {
    const bar = document.getElementById('trip-progress-bar');
    if (bar) bar.style.width = `${progress}%`;
  }

  function updateCaptainNavigationUI(instructionText) {
    const elem = document.getElementById('captain-turn-text');
    if (elem) elem.textContent = instructionText;
  }

  function bindCaptainPanelEvents() {
    const toggle = document.getElementById('captain-online-toggle');
    toggle.addEventListener('change', function () {
      const isOnline = WheeloCaptain.toggleOnlineStatus(this.checked);
      document.getElementById('captain-status-badge').textContent = isOnline ? 'ONLINE' : 'OFFLINE';
      document.getElementById('captain-status-badge').style.background = isOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
      document.getElementById('captain-status-badge').style.color = isOnline ? '#10B981' : '#EF4444';
    });

    document.getElementById('btn-captain-accept').addEventListener('click', () => {
      WheeloCaptain.acceptOffer();
      document.getElementById('incoming-offer-card').style.display = 'none';
      document.getElementById('captain-nav-card').style.display = 'flex';
    });

    document.getElementById('btn-captain-decline').addEventListener('click', () => {
      WheeloCaptain.declineOffer();
      document.getElementById('incoming-offer-card').style.display = 'none';
    });

    document.getElementById('btn-captain-verify-otp').addEventListener('click', () => {
      const inputOtp = document.getElementById('input-captain-otp').value;
      const res = WheeloSimulation.verifyOTPAndStartTrip(inputOtp);
      if (!res.success) {
        alert(res.message);
      } else {
        document.getElementById('captain-otp-step').style.display = 'none';
        document.getElementById('captain-enroute-step').style.display = 'flex';
      }
    });

    const btnGmaps = document.getElementById('btn-open-gmaps');
    if (btnGmaps) {
      btnGmaps.addEventListener('click', () => {
        WheeloMap.openInGoogleMapsApp();
      });
    }

    const tabOverview = document.getElementById('tab-captain-overview');
    const tabKyc = document.getElementById('tab-captain-kyc');

    if (tabOverview && tabKyc) {
      tabOverview.addEventListener('click', () => {
        tabOverview.classList.add('active');
        tabKyc.classList.remove('active');
        document.getElementById('captain-overview-content').style.display = 'flex';
        document.getElementById('captain-kyc-content').style.display = 'none';
      });

      tabKyc.addEventListener('click', () => {
        tabKyc.classList.add('active');
        tabOverview.classList.remove('active');
        document.getElementById('captain-overview-content').style.display = 'none';
        document.getElementById('captain-kyc-content').style.display = 'flex';
      });
    }
  }

  function renderCaptainDashboard() {
    const profile = WheeloCaptain.getCaptainProfile();
    document.getElementById('captain-earnings-val').textContent = `₹${profile.todayEarnings}`;
    document.getElementById('captain-trips-val').textContent = profile.tripsCompleted;

    const offer = WheeloCaptain.getActiveOffer();
    const offerCard = document.getElementById('incoming-offer-card');
    if (offer && WheeloCaptain.getOnlineStatus()) {
      offerCard.style.display = 'flex';
      document.getElementById('offer-pickup-text').textContent = offer.pickup;
      document.getElementById('offer-drop-text').textContent = offer.drop;
      document.getElementById('offer-earning-val').textContent = `₹${offer.driverEarnings}`;
    } else {
      offerCard.style.display = 'none';
    }
  }

  function bindModalEvents() {
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
      });
    });

    document.querySelectorAll('.amount-chip').forEach(chip => {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.amount-chip').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        document.getElementById('input-add-amount').value = this.dataset.amount;
      });
    });

    document.getElementById('btn-submit-topup').addEventListener('click', () => {
      const amt = document.getElementById('input-add-amount').value;
      if (WheeloPricing.addWalletFunds(amt)) {
        updateWalletDisplay();
        document.getElementById('modal-wallet').classList.remove('active');
        alert(`Successfully added ₹${amt} to your Wheelo Wallet!`);
      }
    });

    const btnUpiQr = document.getElementById('btn-trigger-upi-qr');
    if (btnUpiQr) {
      btnUpiQr.addEventListener('click', openUpiQrModal);
    }

    document.querySelectorAll('.tip-chip').forEach(chip => {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.tip-chip').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        const tipVal = parseInt(this.dataset.tip);
        WheeloPricing.setDriverTip(tipVal);
        alert(`Added ₹${tipVal} driver tip! Thank you for supporting your Captain.`);
      });
    });
  }

  function openWalletModal() {
    updateWalletDisplay();
    document.getElementById('modal-wallet').classList.add('active');
  }

  function openSOSModal() {
    WheeloAudio.playSiren();
    document.getElementById('modal-sos').classList.add('active');
  }

  function openUpiQrModal() {
    const modal = document.getElementById('modal-upi-qr');
    if (!modal) return;

    modal.classList.add('active');

    let timeRem = 180;
    const timerElem = document.getElementById('qr-timer-val');
    if (qrCountdownTimer) clearInterval(qrCountdownTimer);

    qrCountdownTimer = setInterval(() => {
      timeRem--;
      const mins = Math.floor(timeRem / 60);
      const secs = timeRem % 60;
      if (timerElem) timerElem.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

      if (timeRem <= 0) {
        clearInterval(qrCountdownTimer);
        modal.classList.remove('active');
      }
    }, 1000);

    const btnSimulateScan = document.getElementById('btn-simulate-qr-scan');
    if (btnSimulateScan) {
      btnSimulateScan.onclick = () => {
        clearInterval(qrCountdownTimer);
        const topupAmt = document.getElementById('input-add-amount').value || 250;
        WheeloPricing.addWalletFunds(topupAmt, 'UPI QR Scan');
        updateWalletDisplay();
        modal.classList.remove('active');
        alert(`Payment Verified! ₹${topupAmt} added to Wheelo Wallet.`);
      };
    }
  }

  function updateWalletDisplay() {
    const bal = WheeloPricing.getWalletBalance().toFixed(2);
    const headerBal = document.getElementById('header-wallet-bal');
    if (headerBal) headerBal.textContent = `₹${bal}`;
    const modalBal = document.getElementById('modal-wallet-bal');
    if (modalBal) modalBal.textContent = `₹${bal}`;

    const container = document.getElementById('wallet-txn-list');
    if (!container) return;
    container.innerHTML = '';

    WheeloPricing.getTransactions().forEach(t => {
      const item = document.createElement('div');
      item.className = 'receipt-row';
      item.style.padding = '8px 0';
      const color = t.type === 'Credit' ? '#10B981' : '#EF4444';
      item.innerHTML = `
        <div>
          <div style="font-weight: 700; color: #F8FAFC;">${t.title}</div>
          <div style="font-size: 11px; color: #64748B;">${t.date} • ${t.id}</div>
        </div>
        <div style="font-weight: 800; color: ${color}; font-size: 15px;">
          ${t.type === 'Credit' ? '+' : '-'}₹${t.amount}
        </div>
      `;
      container.appendChild(item);
    });
  }

  function onTripCompleted(rideData) {
    showBookingPanel();
    updateWalletDisplay();

    const receiptModal = document.getElementById('modal-receipt');
    if (receiptModal) {
      document.getElementById('receipt-veh-name').textContent = rideData.fare.vehicleName;
      document.getElementById('receipt-pickup-addr').textContent = rideData.pickup.address;
      document.getElementById('receipt-drop-addr').textContent = rideData.drop.address;
      document.getElementById('receipt-total-fare').textContent = `₹${rideData.fare.finalFare}`;
      receiptModal.classList.add('active');
    }
  }

  function onLocationUpdated() {
    updateCalculatedFares();
  }

  return {
    init,
    getMapSelectMode: () => mapSelectMode,
    onLocationUpdated,
    updateRideUI,
    updateTripProgressUI,
    updateCaptainNavigationUI,
    onTripCompleted
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  WheeloApp.init();
});
