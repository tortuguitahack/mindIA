// En lugar de line_items con price IDs
line_items: CART.map(item => ({
  price_data: {
    currency: 'usd',
    product_data: {
      name: item.title,
      description: item.description,
      metadata: { uid: item.uid }
    },
    unit_amount: Math.round(item.price * 100) // Convertir a centavos
  },
  quantity: 1
}))
