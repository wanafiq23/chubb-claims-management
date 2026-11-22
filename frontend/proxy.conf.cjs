// Relative browser requests stay on the same origin. The default API remains port 5080.
const target = `http://localhost:${process.env.CHUBB_API_PORT || '5080'}`;
module.exports = {
  '/api/**': { target, secure: false, changeOrigin: true },
  '/health': { target, secure: false, changeOrigin: true }
};
