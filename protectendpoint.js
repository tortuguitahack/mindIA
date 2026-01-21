// Middleware de autenticación
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'No autorizado' });
  }
}

// Aplica a rutas sensibles
app.get('/api/download/:id', requireAuth, async (req, res) => {
  // Tu lógica de descarga
});
