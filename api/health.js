module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      return res.status(200).end();
    }
  
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    return res.status(200).json({ status: 'ok' });
  };