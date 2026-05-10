const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  content: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Testimonial', testimonialSchema);