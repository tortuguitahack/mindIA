// api/index.js - Backend para Vercel con Express
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Configurar Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// === ENDPOINTS PRINCIPALES ===

// 1. Crear sesión de checkout
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { items, metadata } = req.body;
    
    // Validar items
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No hay items en el carrito' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: {
        items: JSON.stringify(metadata.items),
        userId: metadata.userId || 'guest',
        timestamp: new Date().toISOString()
      },
      customer_email: metadata.customerEmail || undefined,
      automatic_tax: { enabled: true },
      invoice_creation: { enabled: true },
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'MX', 'ES', 'AR', 'CO', 'CL', 'PE', 'GB', 'DE', 'FR', 'IT']
      }
    });

    res.status(200).json({ sessionId: session.id });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 2. Verificar sesión (para página de éxito)
app.get('/api/verify-session', async (req, res) => {
  const { session_id } = req.query;
  
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status === 'paid') {
      // Aquí puedes actualizar tu base de datos
      // marcar productos como comprados, etc.
      
      res.status(200).json({
        success: true,
        session,
        purchasedItems: JSON.parse(session.metadata.items || '[]')
      });
    } else {
      res.status(400).json({ error: 'Pago no completado' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Webhook para eventos de Stripe (CRÍTICO)
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar diferentes eventos
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await handleSuccessfulPayment(session);
      break;
      
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful!', paymentIntent.id);
      break;
      
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      console.log('Invoice paid:', invoice.id);
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// 4. Descargar producto (protegido)
app.get('/api/download/:productId', async (req, res) => {
  const { productId } = req.params;
  const { userId, token } = req.query;

  // Verificar que el usuario ha comprado el producto
  const hasAccess = await verifyPurchaseAccess(userId, productId, token);
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'No tienes acceso a este producto' });
  }

  // Enviar archivo
  const filePath = `${process.cwd()}/workflows/${productId}.json`;
  res.download(filePath, `workflow-${productId}.json`);
});

// 5. Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    stripe: stripe ? 'connected' : 'disconnected'
  });
});

// === FUNCIONES AUXILIARES ===

async function handleSuccessfulPayment(session) {
  const items = JSON.parse(session.metadata.items || '[]');
  const userId = session.metadata.userId;
  
  console.log(`✅ Pago recibido: $${session.amount_total / 100} USD`);
  console.log(`📦 Productos: ${items.length}`);
  console.log(`👤 Usuario: ${userId}`);
  
  // 1. Guardar en base de datos (ejemplo con Supabase)
  // await supabase.from('purchases').insert({ userId, items, session });
  
  // 2. Enviar email de confirmación
  // await sendPurchaseEmail(session.customer_details.email, items);
  
  // 3. Generar tokens de descarga
  const downloadTokens = items.map(id => ({
    productId: id,
    token: generateSecureToken(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
  }));
  
  // 4. Guardar tokens
  // await saveDownloadTokens(downloadTokens);
  
  return downloadTokens;
}

function generateSecureToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

async function verifyPurchaseAccess(userId, productId, token) {
  // Verificar en tu base de datos
  // const { data } = await supabase
  //   .from('purchases')
  //   .select('*')
  //   .eq('userId', userId)
  //   .eq('productId', productId)
  //   .eq('token', token)
  //   .single();
  
  // return !!data;
  
  // Para demo:
  return true;
}

// Export para Vercel
module.exports = app;
