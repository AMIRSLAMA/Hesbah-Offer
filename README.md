# HESBAH OFFER

**اطلبها. نجيبها.**  
منصة طلبات وتوصيل متعددة المتاجر مبنية كمنتج مستقل، وليست تعديلاً على Hesbah POS.

## Architecture
- Node.js / Express backend
- Persistent server-side data store
- JWT authentication + role permissions
- Customer marketplace
- Merchant operations
- Driver operations
- Admin Command Center
- Order lifecycle and dispatch
- Commission engine and financial ledger
- Merchant/driver statements and settlements
- Coupons and ratings
- Notifications
- Configurable payment methods
- Native Android application foundation
- Docker + systemd deployment

## Roles
customer · merchant · driver · admin

## Commission
Every order records:
- platform commission rate
- Hesbah commission amount
- merchant net amount
- delivery fee
- driver delivery earning
- financial ledger entry

Default platform commission is 10%, while a store can override it.

## Demo accounts
- admin / 123456
- merchant / 123456
- driver / 123456

Change demo credentials and JWT_SECRET before public launch.

## Local
```bash
npm install
npm start
```

Customer: /
Admin: /admin.html
Merchant: /merchant.html
Driver: /driver.html
Health: /health

## Production
See `README_DEPLOY.md`.

**Isolation rule:** production deployment for this repository uses `/home/amir/hesbah-offer` and `hesbah-offer.service`. It must not use or modify the existing `/home/amir/hesbah` application.
