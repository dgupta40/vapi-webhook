// api/test.js
export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Hello from Vercel!', 
    method: req.method,
    timestamp: new Date().toISOString()
  });
}