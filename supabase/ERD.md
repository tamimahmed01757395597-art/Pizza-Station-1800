# Pizza Station database relationships

```mermaid
erDiagram
  PROFILES ||--o{ ADDRESSES : owns
  PROFILES ||--o{ STAFF_PERMISSIONS : receives
  PROFILES o|--o{ STAFF_PERMISSIONS : grants
  PROFILES o|--o{ ORDERS : places
  PROFILES ||--o{ REVIEWS : writes
  PROFILES ||--o{ CASH_PAYMENTS : receives
  PROFILES ||--o{ DELIVERY_ASSIGNMENTS : delivers
  PROFILES o|--o{ AUDIT_LOGS : acts

  CATEGORIES o|--o{ PRODUCTS : categorizes
  PRODUCTS ||--o{ PRODUCT_VARIANTS : offers
  PRODUCTS ||--o{ PRODUCT_OPTION_GROUPS : configures
  PRODUCT_OPTION_GROUPS ||--o{ PRODUCT_OPTIONS : contains
  PRODUCT_ADDONS o|--o| PRODUCT_OPTIONS : legacy_bridge

  ADDRESSES o|--o{ ORDERS : address_reference
  DELIVERY_ZONES o|--o{ ORDERS : serves
  COUPONS o|--o{ ORDERS : applies
  RESTAURANT_TABLES ||--o{ TABLE_SESSIONS : opens
  TABLE_SESSIONS o|--o{ ORDERS : dine_in_session
  ORDERS ||--|{ ORDER_ITEMS : contains
  PRODUCTS o|--o{ ORDER_ITEMS : current_product
  PRODUCT_VARIANTS o|--o{ ORDER_ITEMS : current_variant
  ORDER_ITEMS ||--o{ ORDER_ITEM_OPTIONS : snapshots
  PRODUCT_OPTIONS o|--o{ ORDER_ITEM_OPTIONS : current_option
  ORDERS ||--o{ ORDER_STATUS_HISTORY : records
  ORDERS ||--o{ CASH_PAYMENTS : payments
  ORDERS ||--o| COUPON_REDEMPTIONS : redemption
  COUPONS o|--o{ COUPON_REDEMPTIONS : redeemed
  PROFILES o|--o{ COUPON_REDEMPTIONS : customer
  ORDERS ||--o{ DELIVERY_ASSIGNMENTS : assigned
  PRODUCTS o|--o| INVENTORY_ITEMS : tracks
  INVENTORY_ITEMS o|--o{ STOCK_MOVEMENTS : moves
  PRODUCTS o|--o{ STOCK_MOVEMENTS : product_snapshot
  ORDERS o|--o{ STOCK_MOVEMENTS : order_deduction
  ORDERS ||--o{ REVIEWS : verified_order
  PRODUCTS o|--o{ REVIEWS : reviewed_product
```

## Relationship notes

- `profiles` is keyed to Supabase Auth users. A profile can own addresses and
  customer orders, or receive granular entries in `staff_permissions`.
- A product belongs to an optional category and can have variants and option
  groups. Each group owns its selectable options. `product_addons` is retained
  for compatibility with the current API; database triggers keep those rows
  synchronized with the normalized `product_options` catalog.
- An order has a nullable customer for guest checkout. It snapshots customer
  delivery details in `delivery_address_snapshot`, links an optional saved
  address, and references a delivery zone, coupon, and/or dine-in table session.
  Its `order_items` store product and variant snapshots; `order_item_options`
  store each selected option's name, group, price, and quantity snapshot.
- `order_status_history`, `cash_payments`, `coupon_redemptions`, and
  `delivery_assignments` record order lifecycle events separately from the
  current order status and payment status.
- A restaurant table stores its QR secret as the unique SHA-256
  `qr_token_hash`; raw QR tokens are never stored. A table can have historical
  sessions but at most one session without an `ended_at` timestamp. Each
  session's separate internal `token_hash` is also private. Public table reads
  are disabled; a security-definer validator returns only the table label after
  checking the QR, table activation, and current session.
- Inventory is one current `inventory_items` row per product, with immutable
  `stock_movements` recording quantity deltas and optional order references.
- `restaurant_settings` is keyed by setting name and marks each value public or
  private. `audit_logs` records selected administrative table changes.

The original `settings`, `payment_records`, `inventory_movements`,
`dining_tables`, and `product_addons` tables remain in place as compatibility
sources for the existing application. Migration 002 copies applicable rows and
bridges writes; it does not drop those legacy tables. Migration 003 adds
table-level QR hashes and synchronizes the legacy `dining_tables` rows needed
by the existing atomic order function.
