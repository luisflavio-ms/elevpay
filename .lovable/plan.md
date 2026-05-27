## Situação atual

- Tabela `order_bumps` já existe (id, user_id, title, description, price) com RLS owner-all e leitura pública via checkout ativo.
- O servidor (`createPixPayment` em `src/lib/abacate.functions.ts`) **já recalcula o total** buscando `checkouts.order_bump_id` + `order_bumps.price` direto do banco. O cliente só envia `bumpOn: boolean` — preço enviado pelo cliente é ignorado. Essa parte já está segura contra adulteração.
- Em `app.checkouts.$id.tsx` o usuário só consegue **selecionar** um bump existente num `<Select>`, mas não há tela para criar/editar/excluir bumps. Hoje não dá pra cadastrar um sem ir no banco.
- No checkout público (`checkout.$publicId.tsx`) o bump já aparece como checkbox "OFERTA ESPECIAL" e soma no total exibido.

## O que vou fazer

### 1. CRUD de Order Bumps na área logada
- Criar rota `src/routes/app.order-bumps.index.tsx` listando os bumps do usuário (título, descrição, preço, # de checkouts vinculados) com botões Editar / Excluir.
- Modal de criar/editar com validação Zod (title 1–120 chars, description ≤ 500, price > 0 e ≤ 100.000).
- Excluir com `AlertDialog` de confirmação. Antes de excluir, contar checkouts vinculados e:
  - se houver vínculos, desvincular (set `order_bump_id = null` nos checkouts do mesmo dono) e então apagar — tudo numa única transação client-side com tratamento de erro.
- Adicionar item "Order bumps" no `AppLayout` (ícone `Gift` do lucide) entre Checkouts e Vendas.

### 2. Atalho no editor do checkout
- Em `app.checkouts.$id.tsx`, na seção "Order bump", adicionar botões "Novo bump" e "Editar selecionado" que abrem o mesmo modal de criação/edição (componente reaproveitado), e ao salvar invalida o query `["order_bumps"]` e auto-seleciona o recém criado.

### 3. Endurecer o servidor (camada de segurança)
Já está bom, mas reforço em `createPixPayment`:
- Validar que o `order_bumps` retornado pertence ao mesmo `user_id` do checkout (defesa em profundidade caso alguém troque IDs no banco).
- Rejeitar se `price <= 0` ou ausente quando `bumpOn = true`.
- Manter o cálculo `total = basePrice + bumpPrice` 100% no servidor (já é assim) e gravar `metadata.bump = { id, price }` no pedido para auditoria.

### 4. Garantias contra ataque (resumo do modelo de segurança)
- **Preço nunca vem do cliente** — o cliente só manda boolean `bumpOn`. Servidor lê preço da tabela `order_bumps` via `supabaseAdmin`.
- **RLS** continua: dono só vê/edita os próprios bumps; leitura pública só via checkout ativo.
- **Bump vinculado ≠ dono do checkout** é bloqueado (nova checagem `user_id`).
- **Idempotência** já existente: anti-flood de 30s por CPF+checkout impede ataques de criar N pedidos.
- **Webhook AbacatePay** continua autoritativo para mudar status para "aprovado" — bump não muda esse fluxo.

## Detalhes técnicos

- Mutations usando `useMutation` + `supabase.from("order_bumps")` direto (RLS já garante owner-only), invalidando `["order_bumps"]`.
- Schema Zod compartilhado entre modal e validação:
  ```ts
  z.object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).default(""),
    price: z.number().positive().max(100000),
  })
  ```
- Endurecimento server-side em `createPixPayment`:
  ```ts
  if (data.bumpOn) {
    if (!bRow) throw new Error("Order bump indisponível");
    if (bRow.user_id !== ckRow.user_id) throw new Error("Order bump inválido");
    if (Number(bRow.price) <= 0) throw new Error("Preço de order bump inválido");
  }
  ```
  (adicionar `user_id` ao select do bump).
- `metadata` do pedido passa a guardar `{ bump: { id, title, price } | null }` para auditoria.

## Fora do escopo
- Múltiplos bumps por checkout (hoje é 1 — manter).
- Upsell pós-pagamento.
- A/B test de bumps.