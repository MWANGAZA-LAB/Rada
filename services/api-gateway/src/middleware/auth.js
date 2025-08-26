const jwt = require('jsonwebtoken');

exports.authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

exports.authenticateMerchant = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'No API key provided' });
    }

    const merchant = await MerchantService.findByApiKey(apiKey);
    if (!merchant) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.merchant = merchant;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};
