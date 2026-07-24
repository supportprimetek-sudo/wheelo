/* ==========================================================================
   WHEELO - Production HTTP REST API Server (Node.js & SQLite/Firebase Engine)
   ========================================================================== */

const http = require('http');
const url = require('url');
const fs = require('fs');
const pathModule = require('path');
const db = require('./database');

const PORT = process.env.PORT || 3000;

// Root Directory Resolution (Supports local Windows, Render, Vercel, Railway)
const ROOT_DIR = fs.existsSync(pathModule.join(__dirname, '..', 'index.html'))
  ? pathModule.join(__dirname, '..')
  : process.cwd();

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  function sendJSON(statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });

  req.on('end', () => {
    let payload = {};
    if (body) {
      try { payload = JSON.parse(body); } catch (e) {}
    }

    console.log(`[${new Date().toISOString()}] ${method} ${path}`);

    // GET /api/health
    if (method === 'GET' && path === '/api/health') {
      return sendJSON(200, {
        status: 'ONLINE',
        service: 'WHEELO Production Server',
        timestamp: new Date().toISOString(),
        rootDir: ROOT_DIR,
        database: db.getDatabaseStatus()
      });
    }

    // GET /api/admin/users
    if (method === 'GET' && path === '/api/admin/users') {
      return sendJSON(200, db.getAllUsers());
    }

    // POST /api/admin/users/delete
    if (method === 'POST' && path === '/api/admin/users/delete') {
      const { userId } = payload;
      const success = db.deleteUser(userId);
      return sendJSON(200, { success });
    }

    // POST /api/admin/users/toggle-block
    if (method === 'POST' && path === '/api/admin/users/toggle-block') {
      const { userId } = payload;
      const user = db.toggleBlockUser(userId);
      if (!user) return sendJSON(404, { error: 'User Not Found' });
      return sendJSON(200, { success: true, user });
    }

    // POST /api/users/register
    if (method === 'POST' && path === '/api/users/register') {
      const resData = db.registerUser(payload);
      if (!resData.success) return sendJSON(400, resData);
      return sendJSON(201, resData);
    }

    // POST /api/users/login-email
    if (method === 'POST' && path === '/api/users/login-email') {
      const { email, password } = payload;
      const resData = db.loginUserEmail(email, password);
      if (!resData.success) return sendJSON(401, resData);
      return sendJSON(200, resData);
    }

    // POST /api/captain/kyc/submit
    if (method === 'POST' && path === '/api/captain/kyc/submit') {
      const kyc = db.submitDriverKYC(payload);
      return sendJSON(200, { success: true, kyc });
    }

    // GET /api/admin/dashboard - 100% REAL TELEMETRY WITH FIREBASE BACKEND
    if (method === 'GET' && path === '/api/admin/dashboard') {
      const dbData = db.load();
      const allRides = dbData.rides || [];
      const allUsers = dbData.users || [];
      const kyc = dbData.driver_kyc || null;

      let grossRevenue = 0;
      allRides.forEach(r => {
        if (r.fare && r.fare.finalFare) grossRevenue += parseFloat(r.fare.finalFare);
      });

      const captainCount = allUsers.filter(u => u.role === 'captain').length;
      const isKYCPending = kyc && (kyc.verified === false || kyc.status === 'PENDING_VERIFICATION');

      return sendJSON(200, {
        success: true,
        stats: {
          grossRevenue: Math.round(grossRevenue),
          netCommission: Math.round(grossRevenue * 0.20),
          totalRides: allRides.length,
          onlineCaptains: captainCount,
          registeredUsers: allUsers.length,
          pendingKYC: isKYCPending ? 1 : 0,
          serverUptime: Math.floor(process.uptime()) + ' seconds',
          dbStatus: db.getDatabaseStatus()
        },
        recentRides: allRides.slice(0, 10),
        kycDetails: kyc,
        vehicles: db.getVehicles(),
        users: db.getAllUsers()
      });
    }

    // GET /api/vehicles
    if (method === 'GET' && path === '/api/vehicles') {
      return sendJSON(200, db.getVehicles());
    }

    // POST /api/admin/vehicles/update
    if (method === 'POST' && path === '/api/admin/vehicles/update') {
      const { id, vehicleData } = payload;
      const updated = db.updateVehicle(id, vehicleData);
      if (!updated) return sendJSON(404, { error: 'Vehicle Category Not Found' });
      return sendJSON(200, { success: true, vehicle: updated });
    }

    // POST /api/admin/vehicles/add
    if (method === 'POST' && path === '/api/admin/vehicles/add') {
      const newVeh = db.addVehicle(payload);
      return sendJSON(201, { success: true, vehicle: newVeh });
    }

    // POST /api/admin/vehicles/delete
    if (method === 'POST' && path === '/api/admin/vehicles/delete') {
      const { id } = payload;
      const success = db.deleteVehicle(id);
      return sendJSON(200, { success });
    }

    // POST /api/admin/kyc/update
    if (method === 'POST' && path === '/api/admin/kyc/update') {
      const { verified } = payload;
      const kyc = db.updateKYCStatus(verified);
      return sendJSON(200, { success: true, kyc });
    }

    // GET /api/users/:id
    if (method === 'GET' && path.startsWith('/api/users/')) {
      const userId = path.split('/')[3];
      const user = db.getUser(userId);
      if (!user) return sendJSON(404, { error: 'User Not Found' });
      return sendJSON(200, user);
    }

    // POST /api/users/login
    if (method === 'POST' && path === '/api/users/login') {
      const { phone } = payload;
      const user = db.saveUser({
        id: 'rider_' + (phone ? phone.slice(-4) : 'ananya'),
        name: 'Ananya Sharma',
        phone: phone ? `+91 ${phone}` : '+91 98765 43210',
        email: 'ananya.sharma@example.com',
        role: 'rider',
        wallet_balance: 650.00,
        member_tier: 'Gold Rider',
        blocked: false,
        created_at: new Date().toISOString()
      });
      return sendJSON(200, { success: true, user });
    }

    // GET /api/places
    if (method === 'GET' && path === '/api/places') {
      const places = db.getSavedPlaces(parsedUrl.query.userId || 'rider_ananya');
      return sendJSON(200, places);
    }

    // POST /api/places
    if (method === 'POST' && path === '/api/places') {
      const place = db.savePlace(payload);
      return sendJSON(201, { success: true, place });
    }

    // GET /api/coupons/validate
    if (method === 'GET' && path === '/api/coupons/validate') {
      const coupon = db.validateCoupon(parsedUrl.query.code);
      if (!coupon) return sendJSON(404, { success: false, message: 'Invalid or expired promo code' });
      return sendJSON(200, { success: true, coupon });
    }

    // GET /api/wallet/transactions
    if (method === 'GET' && path === '/api/wallet/transactions') {
      const txns = db.getTransactions(parsedUrl.query.userId || 'rider_ananya');
      return sendJSON(200, txns);
    }

    // POST /api/wallet/topup
    if (method === 'POST' && path === '/api/wallet/topup') {
      const { userId, amount, paymentMethod } = payload;
      if (!amount || amount <= 0) return sendJSON(400, { error: 'Invalid amount' });

      const res = db.updateWallet(userId || 'rider_ananya', parseFloat(amount), 'Credit', `Topup via ${paymentMethod || 'UPI'}`);
      return sendJSON(200, { success: true, wallet: res });
    }

    // POST /api/rides/book
    if (method === 'POST' && path === '/api/rides/book') {
      const ride = db.createRide(payload);
      return sendJSON(201, { success: true, ride });
    }

    // GET /api/rides/:id
    if (method === 'GET' && path.startsWith('/api/rides/')) {
      const rideId = path.split('/')[3];
      const ride = db.getRide(rideId);
      if (!ride) return sendJSON(404, { error: 'Ride Not Found' });
      return sendJSON(200, ride);
    }

    // POST /api/rides/:id/start
    if (method === 'POST' && path.includes('/start')) {
      const rideId = path.split('/')[3];
      const ride = db.updateRideStatus(rideId, 'IN_TRIP');
      if (!ride) return sendJSON(404, { error: 'Ride Not Found' });
      return sendJSON(200, { success: true, ride });
    }

    // POST /api/rides/:id/complete
    if (method === 'POST' && path.includes('/complete')) {
      const rideId = path.split('/')[3];
      const ride = db.updateRideStatus(rideId, 'COMPLETED');
      if (!ride) return sendJSON(404, { error: 'Ride Not Found' });
      return sendJSON(200, { success: true, ride });
    }

    // GET /api/captain/kyc
    if (method === 'GET' && path === '/api/captain/kyc') {
      const kyc = db.getKYC();
      return sendJSON(200, kyc);
    }

    // Bulletproof Static File & SPA Fallback Handler
    let relativePath = path === '/' ? 'index.html' : path.replace(/^\/+/, '');
    if (relativePath === 'admin') relativePath = 'admin.html';

    const candidatePaths = [
      pathModule.join(ROOT_DIR, relativePath),
      pathModule.join(__dirname, '..', relativePath),
      pathModule.join(process.cwd(), relativePath)
    ];

    let targetFile = candidatePaths.find(p => fs.existsSync(p) && fs.statSync(p).isFile());

    // SPA fallback if file not found and has no extension
    if (!targetFile && !pathModule.extname(relativePath)) {
      targetFile = candidatePaths.find(p => p.endsWith('index.html')) || pathModule.join(ROOT_DIR, 'index.html');
    }

    if (!targetFile || !fs.existsSync(targetFile)) {
      console.warn(`[404] File Not Found: ${path} (Searched: ${candidatePaths.join(', ')})`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = pathModule.extname(targetFile);
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };

    fs.readFile(targetFile, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` WHEELO Backend Server Listening on Port ${PORT} `);
  console.log(` Root Directory: ${ROOT_DIR} `);
  console.log(` Health Check: http://localhost:${PORT}/api/health `);
  console.log(` Admin Dashboard: http://localhost:${PORT}/api/admin/dashboard `);
  console.log(`==================================================`);
});
