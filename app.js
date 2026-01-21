const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const app = express();

const stripe = Stripe('sk_live_your_secret_key');

app.use(cors());
app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items, metadata } = req.body;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items,
      mode: 'payment',
      success_url: 'https://yourdomain.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://yourdomain.com/cancel',
      metadata: {
        items: metadata.items,
        userId: metadata.userId
      },
      automatic_tax: { enabled: true },
      invoice_creation: { enabled: true }
    });
    
    res.json({ sessionId: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook para confirmación
app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = 'whsec_your_webhook_secret';
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Manejar eventos
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      handlePurchase(session);
      break;
    // ... otros eventos
  }
  
  res.json({ received: true });
});

app.listen(4242, () => console.log('Server running on port 4242'));
