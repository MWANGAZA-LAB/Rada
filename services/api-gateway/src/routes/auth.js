const jwt = require('jsonwebtoken');
const { Router } = require('express');
const router = Router();
const { authenticateUser } = require('../middleware/auth');
const UserService = require('../services/userService');

router.post('/register', async (req, res) => {
  try {
    const { phoneNumber, email } = req.body;
    const user = await UserService.createUser({ phoneNumber, email });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    res.json({ token, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const user = await UserService.findByPhone(phoneNumber);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    res.json({ token, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/me', authenticateUser, async (req, res) => {
  try {
    const user = await UserService.findById(req.user.userId);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
