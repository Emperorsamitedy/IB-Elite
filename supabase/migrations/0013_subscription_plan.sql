-- Record the purchased tier on the subscription row. Inferring it from the
-- price ID breaks whenever STRIPE_PRICE_* env vars move on or are unset
-- (a Max subscriber would silently read as Pro), so the checkout session
-- stamps the plan into Stripe metadata and the webhook persists it here.
alter table public.subscriptions
  add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro', 'max'));
