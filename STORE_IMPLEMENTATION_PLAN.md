# PrintBhejo Store implementation plan

## Safety rules
- Store is an isolated module; do not alter the WebRTC transfer flow, PIN/QR behavior, Received Files, converters, existing authentication, or existing admin permissions.
- Work on `feature/store-foundation`; production changes happen only after review and verification.
- Reuse Supabase Auth identities. Existing `profiles.role = 'admin'` is the Store owner/super-admin; Store staff roles and overrides are separate from existing profile permissions.
- Every Store table exposed through the Data API must have RLS enabled. Authorization must be enforced in PostgreSQL, not only by hiding UI controls.
- Never expose service-role keys in browser code.

## Phases
1. **RBAC foundation:** Store roles, permission catalogue, role assignments, user overrides, staff activation and audit-log foundation.
2. **Catalogue:** Login-only product browsing, search, categories, filters, stock-aware product cards and a separate Store page.
3. **Inventory:** Products, suppliers, stock receipts/adjustments, low-stock alerts and movement history.
4. **Orders:** Cart, address book, checkout, COD and online payment integration, order status, cancellation and refunds.
5. **Admin UI:** Staff/role manager, permission matrix, inventory/order/accounting workspaces and audit viewer.
6. **Verification:** Build checks, RLS tests for anonymous/customer/staff/owner users, concurrency tests for stock, and regression checks for existing PrintBhejo flows.

## Initial role templates
- Inventory Manager: inventory read/write, stock receipts and adjustments; purchase cost only with explicit permission.
- Order Manager: order handling and customer delivery details; no staff administration or supplier-cost access by default.
- Dispatch/Delivery Staff: assigned orders only and permitted delivery status transitions.
- Accounts/Payment Manager: payment reconciliation and approved refund workflow.
- Owner: existing PrintBhejo admin account; full Store control.

Custom overrides are per-user and explicit deny wins over role-derived allow. Audit events should capture actor, action, resource, timestamp and minimal before/after data. Secrets and payment credentials must never be logged.
