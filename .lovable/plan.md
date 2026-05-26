# Email de entrega após pagamento confirmado

Quando o webhook do Abacate marca um pedido como `aprovado`, disparar um email transacional para o comprador com o link de acesso ao produto.

## Onde fica o link de acesso

A tabela `products` já tem o campo `delivery_url` — esse é o link que será enviado. O template do email é global (um único layout para todos os produtos), mas o **link enviado é o `delivery_url` do produto comprado**. Assim você cadastra o link uma vez por produto e o sistema escolhe automaticamente qual mandar.

Vou também adicionar um campo de texto opcional em **Configurações** para uma "mensagem de boas-vindas" global que aparece no corpo do email (ex: "Obrigado pela compra! Acesse seu produto abaixo.").

## O que vai ser feito

### 1. Configurar domínio de envio
- Abrir o diálogo de setup de domínio para você configurar `notify.seudominio.com`
- Provisionar a infraestrutura de email (fila, logs, supressão, unsubscribe)
- Gerar o template transacional `purchase-delivery`

### 2. Garantir que produtos tenham `delivery_url`
- O campo já existe na tabela. Verificar se a UI de cadastro/edição de produto em `app.produtos` permite editá-lo — se não, adicionar o input.

### 3. Campo opcional de mensagem global
- Adicionar coluna `delivery_email_message` em `profiles` (texto livre, mostrado no corpo do email)
- Adicionar um card em **Configurações** para editar essa mensagem

### 4. Template de email `purchase-delivery`
React Email component com:
- Saudação ao cliente pelo nome (`customer_name`)
- Nome do produto comprado
- Mensagem global (se configurada)
- Botão "Acessar produto" apontando para `delivery_url`
- Fallback se `delivery_url` estiver vazio: avisa que o vendedor entrará em contato

### 5. Disparo no webhook
Em `src/routes/api/public/abacate-webhook.ts`, no bloco `if (newStatus === "aprovado")`:
- Buscar `products.name` e `products.delivery_url` do pedido
- Chamar `sendTransactionalEmail` com `templateName: 'purchase-delivery'`, `recipientEmail: order.customer_email`, `idempotencyKey: 'delivery-' + order.id`, e `templateData: { customerName, productName, deliveryUrl, message }`
- Pular envio se `customer_email` estiver vazio (sem quebrar o webhook)

### 6. Página `/unsubscribe`
Página simples branded para o link de unsubscribe que o sistema injeta automaticamente no rodapé.

## Detalhes técnicos

- Rota de envio: `POST /lovable/email/transactional/send` (criada pela infra)
- Helper: `src/lib/email/send.ts` chamando a rota com service-role no contexto do webhook (não há JWT de usuário)
- Idempotência: `delivery-${order.id}` garante que mesmo se o webhook for reentregue, o email só sai uma vez
- Suppression: emails com bounce/complaint/unsubscribe são bloqueados automaticamente pela infra
- Logs em `email_send_log` — posso adicionar um painel depois se quiser monitorar

## Pré-requisitos do usuário

Após eu apertar "Implementar", aparece um diálogo pra você:
1. Informar o domínio (ex: `seudominio.com`) e o subdomínio de envio (ex: `notify`)
2. Adicionar os registros NS no seu provedor de DNS
3. Aguardar verificação (até 72h, normalmente minutos)

O resto funciona independente — você já pode cadastrar `delivery_url` nos produtos enquanto o DNS propaga.