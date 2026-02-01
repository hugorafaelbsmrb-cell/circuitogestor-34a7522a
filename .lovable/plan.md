
# Plano: Página Mobile Dedicada para Atendimento aos Pais

## Problema Identificado

A página atual de "Atendimento aos Pais" (`/atendimento-pais`) foi projetada para desktop com um layout Kanban de 5 colunas, tornando-a difícil de usar em dispositivos móveis:
- Colunas muito estreitas em telas pequenas
- Muita informação visual competindo por espaço
- Navegação complexa com dropdowns e modais pesados
- Interface não otimizada para toque

## Solução Proposta

Criar uma **nova rota pública** `/suporte-mobile` exclusiva para atendimento via celular, com design fluido e limpo inspirado em apps de mensagens modernos como WhatsApp.

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│                    PÁGINA MOBILE: /suporte-mobile               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  HEADER FIXO                                             │   │
│  │  [Logo] Atendimento    [Pesquisar] [Filtro] [Sync]      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  FILTROS HORIZONTAIS (pills scrolláveis)                │   │
│  │  [Todos] [Não Lidos] [Reforço] [Robótica] [Soroban]...  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  LISTA DE CONVERSAS (scroll infinito)                   │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ [Avatar] Maria Silva              14:32  [●2]   │   │   │
│  │  │          Alunos: João, Ana                       │   │   │
│  │  │          "Olá, gostaria de saber..."            │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ [Avatar] Carlos Souza             12:15         │   │   │
│  │  │          Aluno: Pedro                           │   │   │
│  │  │          "Tudo certo, obrigado!"                │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  TELA DE CHAT (fullscreen ao selecionar)                │   │
│  │                                                         │   │
│  │  [← Voltar] Maria Silva                    [📞] [⋮]    │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │                                                         │   │
│  │  ┌────────────────┐                                    │   │
│  │  │ Mensagem...    │                                    │   │
│  │  └────────────────┘                                    │   │
│  │                        ┌────────────────┐              │   │
│  │                        │ Resposta...    │              │   │
│  │                        └────────────────┘              │   │
│  │                                                         │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  [+] [📷] [Input: Digite sua mensagem...     ] [Enviar] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Características do Design Mobile

### 1. Layout de Lista de Conversas
- Tela inicial com lista estilo WhatsApp/Telegram
- Cards grandes e tocáveis (min 64px de altura)
- Preview da última mensagem
- Badge de mensagens não lidas
- Horário da última interação
- Nome do(s) aluno(s) visível

### 2. Filtros Inteligentes
- Pills horizontais com scroll touch
- Filtro por categoria (curso)
- Filtro rápido "Não Lidos" 
- Busca por nome/telefone

### 3. Chat Fullscreen
- Ao tocar em um contato, abre chat em tela cheia
- Botão de voltar claro no topo
- Área de mensagens com scroll suave
- Input fixo no rodapé
- Suporte a respostas rápidas (templates)
- Botões de ação: ligar, WhatsApp externo

### 4. Gestos e Micro-interações
- Pull-to-refresh para atualizar lista
- Animações suaves nas transições
- Feedback tátil nos botões

---

## Componentes a Criar

| Componente | Descrição |
|------------|-----------|
| `src/pages/GuardianSupportMobile.tsx` | Página principal mobile |
| `src/components/support/MobileConversationList.tsx` | Lista de conversas estilo mensageiro |
| `src/components/support/MobileConversationItem.tsx` | Card individual de conversa |
| `src/components/support/MobileChatView.tsx` | Tela de chat fullscreen |
| `src/components/support/MobileFilterPills.tsx` | Filtros horizontais scrolláveis |
| `src/components/support/MobileQuickReplies.tsx` | Respostas rápidas otimizadas |

---

## Fluxo de Navegação

```text
/suporte-mobile
     │
     ├──> Lista de Conversas (view padrão)
     │         │
     │         ├──> Filtrar por categoria
     │         ├──> Buscar contato
     │         └──> Tap em conversa
     │                   │
     │                   └──> Chat Fullscreen
     │                             │
     │                             ├──> Enviar mensagem
     │                             ├──> Respostas rápidas
     │                             ├──> Abrir WhatsApp
     │                             └──> Voltar para lista
     │
     └──> Pull-to-refresh (sincroniza mensagens)
```

---

## Detalhes Técnicos

### Estado e Dados
- Reutiliza a mesma lógica de dados do `GuardianSupport.tsx`
- Combina guardians cadastrados + contatos desconhecidos em lista unificada
- Ordena por: não lidos primeiro, depois por última mensagem
- Cache local com React Query

### Autenticação
- Página protegida (requer login)
- Herda o mesmo sistema de autenticação do sistema principal

### Performance Mobile
- Virtualização de lista para grandes volumes
- Lazy loading de avatares
- Debounce na busca
- Otimização de re-renders

---

## Alterações em Arquivos Existentes

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Adicionar rota `/suporte-mobile` protegida |
| `src/components/layout/Sidebar.tsx` | Opcional: link para versão mobile |

---

## Interface Visual (Estilo)

### Paleta
- Background: `bg-background` (claro/escuro conforme tema)
- Cards: `bg-card` com borda sutil
- Destaque não lidos: `bg-primary/5` com borda `border-primary/30`
- Badges: vermelho para não lidos

### Tipografia
- Nome: `text-base font-semibold`
- Alunos: `text-sm text-muted-foreground`
- Preview: `text-sm text-muted-foreground line-clamp-1`
- Horário: `text-xs text-muted-foreground`

### Espaçamento
- Padding lateral: `px-4`
- Gap entre cards: `gap-1`
- Altura mínima do card: `py-3`

---

## Benefícios da Nova Página

1. **Experiência nativa mobile** - Parece um app de mensagens
2. **Foco na tarefa** - Uma conversa por vez, sem distrações
3. **Velocidade** - Carregamento rápido e transições suaves
4. **Acessibilidade** - Áreas de toque grandes, contrastes adequados
5. **Offline-friendly** - Cache de dados para uso com conexão instável

---

## Resumo de Entregáveis

1. Nova página `src/pages/GuardianSupportMobile.tsx`
2. Componente de lista `MobileConversationList.tsx`
3. Componente de chat fullscreen `MobileChatView.tsx`
4. Componente de filtros `MobileFilterPills.tsx`
5. Integração de rota em `App.tsx`
6. Estilos otimizados para touch e mobile

