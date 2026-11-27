# Security Specification — Delícia da Esther

## 1. Data Invariants
- Public visitors can read (`get`, `list`) documents in `/produtos/{produtoId}` so the storefront renders the catalog in real time, and cannot read `/admins/{adminId}` or `/pedidos/{pedidoId}` (strict PII isolation).
- Only verified admins (`isAdmin()`) can `create`, `update`, or `delete` documents in `/produtos/{produtoId}`.
- Every `Produto` document must validate strict keys (`hasAll` + `hasOnly`), string length bounds (`nome` 2..120, `descricao` 2..600, `imagemUrl` <= 450000 for compressed Base64 JPEG or URL), positive numeric `preco` (`> 0` and `<= 100000`), `createdBy == request.auth.uid`, and server timestamps (`createdAt == request.time`, `updatedAt == request.time`).
- Storefront customers (including unauthenticated guests) can `create` a `Pedido` in `/pedidos/{pedidoId}` with strict schema validation, forced initial `status == 'novo'`, no `autoPrintedAt` field, bounded `itens` list (1..50), and server timestamps (`createdAt == request.time`, `updatedAt == request.time`).
- Only `isAdmin()` can `get`, `list`, `update`, or `delete` `/pedidos/{pedidoId}` (containing customer PII: `clienteNome`, `clienteWhatsapp`, `endereco`). On `update`, only `status` (`'novo'`, `'em_preparo'`, `'concluido'`), `autoPrintedAt` (when unset, set to `request.time`), and `updatedAt == request.time` may change.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated `create` on `/produtos/test-1`.
2. Signed-in non-admin user `create` on `/produtos/test-2`.
3. Spoofed admin email (`deusproveraalx@gmail.com`) with `email_verified: false` attempting `create`.
4. Admin `create` with missing required field (`preco` omitted).
5. Admin `create` with shadow ghost field (`isVerified: true` or `role: 'superadmin'`).
6. Admin `create` with negative or zero price (`preco: -10` or `preco: 0`).
7. Unauthenticated or non-admin user attempting `get` or `list` on `/pedidos` (customer PII leak).
8. Customer attempting to `create` a `Pedido` with forged `status: 'concluido'` instead of `'novo'`.
9. Customer attempting to `create` a `Pedido` with empty `itens: []` or > 50 items, or shadow field (`descontoAdmin: 100`).
10. Non-admin attempting `update` on `/pedidos/{id}` to mark an order as `'concluido'`.
11. Poisoned document ID (`../etc/passwd` or 200-char string) failing `isValidId(id)`.
12. Non-admin `get` or `list` on `/admins` trying to enumerate admin emails (PII leak).
