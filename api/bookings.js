const nodemailer = require('nodemailer');

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
  const required = ['fullName', 'email', 'phone', 'serviceType', 'preferredDate', 'preferredTime', 'location'];
  const missing = required.filter(k => !body || !String(body[k] || '').trim());
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

  const {
    fullName, email, phone, serviceType, preferredDate, preferredTime, location,
    vehicleMake, vehicleModel, vehicleYear, vehicleColor, notes
  } = data;

  const html = `
    <h2>New Booking Request</h2>
    <p><strong>Name:</strong> ${fullName}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    <p><strong>Service:</strong> ${serviceType}</p>
    <p><strong>Date:</strong> ${preferredDate}</p>
    <p><strong>Time:</strong> ${preferredTime}</p>
    <p><strong>Location:</strong> ${location}</p>
    <hr />
    <p><strong>Vehicle:</strong> ${[vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(' ')}</p>
    <p><strong>Color:</strong> ${vehicleColor || '-'}</p>
    <p><strong>Notes:</strong> ${notes || '-'}</p>
  `;

  try {
    const transporter = createTransporter();
    const to = process.env.NOTIFY_TO || process.env.EMAIL_USER;

    await transporter.sendMail({
      from: `"The Car Bath" <${process.env.EMAIL_USER}>`,
      to,
      replyTo: email,
      subject: `New Booking – ${serviceType} – ${fullName}`,
      html
    });

    return res.status(200).json({ ok: true, message: 'Booking email sent' });
  } catch (err) {
    console.error('Email error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to send email' });
  }
};