const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authConfig = require('../config/auth');

const usersController = {
  async getAllUsers(req, res) {
    try {
      const users = await User.findAll();
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getUserById(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.status(200).json(user);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async createUser(req, res) {
    try {
      const { name, email, password } = req.body;
      
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        status: false,
        is_guest: false
      });

      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        isGuest: user.is_guest,
        createdAt: user.created_at
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async deleteUser(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      await User.delete(req.params.id);
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async updateUserStatus(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const { status } = req.body;
      const updatedUser = await User.updateStatus(req.params.id, status);

      res.status(200).json({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        status: updatedUser.status,
        isGuest: updatedUser.is_guest,
        createdAt: updatedUser.created_at
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        authConfig.jwtSecret,
        { expiresIn: authConfig.jwtExpiresIn, algorithm: authConfig.jwtAlgorithm }
      );

      const updatedUser = await User.updateStatus(user.id, true);

      res.status(200).json({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        status: updatedUser.status,
        token
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async guestLogin(req, res) {
    try {
 
      const user = await User.create({
        name: req.body.name || `Guest_${Date.now()}`,
        email: null,
        password: null,
        status: true,
        is_guest: true
      });

      const token = jwt.sign(
        { userId: user.id, isGuest: true },
        authConfig.jwtSecret,
        { expiresIn: authConfig.jwtExpiresIn, algorithm: authConfig.jwtAlgorithm }
      );

      res.status(200).json({
        id: user.id,
        name: user.name,
        status: user.status,
        isGuest: user.is_guest,
        createdAt: user.created_at,
        token
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = usersController;
