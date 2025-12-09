const up = (pgm) => {
  pgm.addColumns('plans', {
    stripe_monthly_price_id: { type: 'text', notNull: false },
    stripe_yearly_price_id: { type: 'text', notNull: false },
  });
};

const down = (pgm) => {
  pgm.dropColumns('plans', ['stripe_monthly_price_id', 'stripe_yearly_price_id']);
};

module.exports = {
  up,
  down,
};
