// Simple in-memory storage for bookings
// In production, replace with database (MongoDB, PostgreSQL, etc.)
const bookings = new Map();

// Load existing bookings from environment or initialize empty
function getBookings() {
  // In production, this would query your database
  return bookings;
}

// Check if a time slot is available
function isTimeSlotAvailable(date, time, location) {
  const bookingsMap = getBookings();
  const slotKey = `${date}-${time}-${location}`;
  
  return !bookingsMap.has(slotKey);
}

// Reserve a time slot
function reserveTimeSlot(date, time, location, bookingId) {
  const bookingsMap = getBookings();
  const slotKey = `${date}-${time}-${location}`;
  
  bookingsMap.set(slotKey, {
    bookingId,
    date,
    time,
    location,
    reservedAt: new Date().toISOString()
  });
}

// Get booking by ID
function getBooking(bookingId) {
  const bookingsMap = getBookings();
  for (const [key, booking] of bookingsMap) {
    if (booking.bookingId === bookingId) {
      return booking;
    }
  }
  return null;
}

// Remove booking (for cancellation)
function removeBooking(bookingId) {
  const bookingsMap = getBookings();
  for (const [key, booking] of bookingsMap) {
    if (booking.bookingId === bookingId) {
      bookingsMap.delete(key);
      return true;
    }
  }
  return false;
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    
    const { date, time, location } = data;
    
    // Validate required fields
    if (!date || !time || !location) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missing: ['date', 'time', 'location'].filter(field => !data[field])
      });
    }
    
    // Check if time slot is available
    const available = isTimeSlotAvailable(date, time, location);
    
    return res.status(200).json({ 
      available,
      date,
      time,
      location,
      message: available ? 'Time slot is available' : 'Time slot is already booked'
    });
    
  } catch (err) {
    console.error('Availability check error:', err);
    return res.status(500).json({ 
      error: 'Failed to check availability',
      available: false
    });
  }
};

