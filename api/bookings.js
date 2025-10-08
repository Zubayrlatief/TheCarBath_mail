const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

// Simple in-memory storage for bookings (same as check-availability.js)
// In production, replace with database
const bookings = new Map();

function getBookings() {
  return bookings;
}

function isTimeSlotAvailable(date, time, location) {
  const bookingsMap = getBookings();
  const slotKey = `${date}-${time}-${location}`;
  return !bookingsMap.has(slotKey);
}

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

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

function validate(body) {
  const required = [
    'service', 'businessPark', 'firstName', 'lastName',
    'email', 'phone', 'vehicleMake', 'preferredDate', 'preferredTime'
  ];
  const missing = required.filter(k => !body || !String(body[k] || '').trim());

  // Conditional: when businessPark is 'other', customBusinessPark is required
  if ((body?.businessPark || '').trim().toLowerCase() === 'other' && !String(body?.customBusinessPark || '').trim()) {
    missing.push('customBusinessPark');
  }

  // Conditional: when businessPark is 'private', customBusinessPark is required (custom location)
  if ((body?.businessPark || '').trim().toLowerCase() === 'private' && !String(body?.customBusinessPark || '').trim()) {
    missing.push('customBusinessPark');
  }

  return { ok: missing.length === 0, missing };
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let data = {};
  try {
    data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const v = validate(data);
  if (!v.ok) return res.status(400).json({ error: 'Missing required fields', missing: v.missing });

  // Check time slot availability before proceeding
  const businessParkDisplay = (data.businessPark || '').toLowerCase() === 'other' || (data.businessPark || '').toLowerCase() === 'private'
    ? (data.customBusinessPark || 'Custom Location')
    : data.businessPark;

  if (!isTimeSlotAvailable(data.preferredDate, data.preferredTime, businessParkDisplay)) {
    return res.status(409).json({ 
      error: 'Time slot is already booked',
      message: 'This time slot is already booked. Please choose another time.',
      date: data.preferredDate,
      time: data.preferredTime,
      location: businessParkDisplay
    });
  }

  const {
    service,
    businessPark,
    customBusinessPark,
    firstName,
    lastName,
    email,
    phone,
    vehicleMake,
    vehicleModel,
    vehicleYear,
    vehicleColor,
    preferredDate,
    preferredTime,
    notes,
    agreedToTerms
  } = data;

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  
  // Generate unique booking ID
  const bookingId = uuidv4();

  const html = `
    <h2>New Booking Request</h2>
    <p><strong>Name:</strong> ${fullName}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    <p><strong>Service:</strong> ${service}</p>
    <p><strong>Location:</strong> ${businessParkDisplay}</p>
    <p><strong>Booking ID:</strong> ${bookingId}</p>
    <p><strong>Date:</strong> ${preferredDate}</p>
    <p><strong>Time:</strong> ${preferredTime}</p>
    <hr />
    <p><strong>Vehicle Make:</strong> ${vehicleMake}</p>
    ${vehicleModel ? `<p><strong>Vehicle Model:</strong> ${vehicleModel}</p>` : ''}
    ${vehicleYear ? `<p><strong>Vehicle Year:</strong> ${vehicleYear}</p>` : ''}
    ${vehicleColor ? `<p><strong>Vehicle Color:</strong> ${vehicleColor}</p>` : ''}
    ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
    <p><strong>Agreed To Terms:</strong> ${agreedToTerms ? 'Yes' : 'No'}</p>
  `;

  try {
    // Reserve the time slot before sending email
    reserveTimeSlot(preferredDate, preferredTime, businessParkDisplay, bookingId);
    
    const transporter = createTransporter();
    const to = process.env.NOTIFY_TO || process.env.EMAIL_USER;

    await transporter.sendMail({
      from: `"The Car Bath Website" <${process.env.EMAIL_USER}>`,
      to,
      replyTo: email,
      subject: `New Booking – ${service} – ${fullName}`,
      html
    });

    return res.status(200).json({ 
      ok: true, 
      message: 'Booking email sent',
      bookingId,
      date: preferredDate,
      time: preferredTime,
      location: businessParkDisplay
    });
  } catch (err) {
    console.error('Email error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to send email' });
  }
};