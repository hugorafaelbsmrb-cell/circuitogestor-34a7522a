
# Álbum de fotos da Colônia de Férias

Galeria pública por edição da colônia, com fotos hospedadas na API externa (`hospedagemcpanel.lovable.app`) que já usamos via `useExternalApiConfig` (x-api-key). Admin envia em lote, marca dia/atividade, escolhe por foto se aplica marca d'água ou moldura temática. Pais acessam por link público e baixam.

## 1. Configurações

**Configurações do Sistema (`Settings.tsx`)**
- Nova seção "Galeria de Fotos (API Externa)" reaproveitando `useExternalApiConfig`: URL base e x-api-key.
- Botão "Testar conexão" (já existe no hook).
- Campo opcional: pasta padrão na API (ex.: `colonia`).

**Configurações do Evento (`VacationCampEditor.tsx`)**
- Novo bloco "Álbum de Fotos":
  - Upload da **logo do evento** (PNG transparente, salva no bucket `system-branding` ou na API externa).
  - Campos: cor da moldura, título exibido no álbum, mensagem de boas-vindas.
  - Toggle "Álbum público ativo".

## 2. Banco de dados

Nova tabela `vacation_camp_photos`:

| coluna | tipo | obs |
|---|---|---|
| id | uuid PK | |
| camp_id | uuid FK → vacation_camps | |
| external_url | text | URL retornada pela API externa |
| external_name | text | nome/path do arquivo na API (para delete) |
| thumbnail_url | text nullable | |
| day_label | text | ex.: "Dia 1 - 06/07" |
| activity_tag | text nullable | ex.: "Piscina", "Oficina" |
| schedule_id | uuid nullable FK → vacation_camp_schedule | |
| has_watermark | boolean default false | |
| has_frame | boolean default false | |
| width / height | int nullable | |
| created_at / updated_at | timestamptz | |

Atualizar `vacation_camps`:
- `album_enabled boolean default true`
- `album_logo_url text`
- `album_frame_color text default '#FF6B00'`
- `album_title text`
- `album_welcome_message text`

RLS:
- `SELECT` público (anon + authenticated) quando `album_enabled = true` (via join com camp).
- `INSERT/UPDATE/DELETE` apenas admin.
- GRANTs explícitos para anon/authenticated/service_role.

## 3. Upload e processamento (frontend)

Nova página `src/pages/VacationCampPhotos.tsx` (rota `/colonia/admin/:slug/fotos`):
- Multi-upload (drag-and-drop, até N arquivos por vez).
- Para cada foto: preview, seletor de dia (puxado de `vacation_camp_schedule`), tag de atividade livre, e dois toggles: "Marca d'água" e "Moldura temática".
- Processamento client-side com `<canvas>`:
  - **Marca d'água**: logo do evento renderizada a 15% da largura, canto inferior direito, opacidade 0.7.
  - **Moldura temática**: borda de 4% com `album_frame_color`, faixa inferior com logo + texto do evento.
- Resultado convertido em dataURL e enviado para a API externa via `useExternalApi.uploadImage()` (pasta `colonia/{slug}`).
- Após sucesso, insere registro em `vacation_camp_photos` com `external_url`.

Reusa o padrão de `ImagesTab.tsx` para list/upload/delete.

## 4. Galeria pública

Nova rota pública `/colonia/:slug/album` (`src/pages/VacationCampAlbum.tsx`):
- Header temático com logo do evento e título configurável.
- Filtros: por dia e por atividade.
- Grid responsivo (masonry/grid), lazy-loading, lightbox ao clicar.
- Botão "Baixar foto" individual e "Baixar todas do dia" (zip via `jszip` client-side).
- Sem login. Sem busca por aluno (fotos abertas).
- Link compartilhável adicionado na landing da colônia (`VacationCampLanding.tsx`) como botão "📸 Álbum de Fotos".

## 5. Painel admin existente

Em `VacationCampAdmin.tsx` / `VacationCampEditor.tsx`:
- Card novo "Álbum de Fotos" com contagem total, atalho para gerenciar e link público copiável.

## Detalhes técnicos

- **API externa**: usar exatamente o mesmo `useExternalApi` (uploadImage, deleteImage, getImages). Pasta padrão `colonia/{camp-slug}`. Sem nova edge function — chamadas direto do frontend autenticado (admin) e leitura via tabela `vacation_camp_photos` (URLs já são públicas na CDN da API).
- **Marca d'água/moldura**: processamento 100% no navegador (canvas) antes do upload, então a API recebe a imagem final já tratada. Não há reprocessamento depois.
- **Logo do evento**: upload via bucket público `system-branding` (já existe), URL salva em `vacation_camps.album_logo_url`.
- **Download em lote**: `jszip` + `file-saver` (já comum no projeto; instalo se faltar).
- **Permissões**: tela admin protegida por `useAdminGuard`; rota pública sem guard.
- **Performance**: thumbnails opcionais — se a API externa não gerar, o canvas também produz um thumb 400px e faz segundo upload em `colonia/{slug}/thumbs`.

## Fora do escopo

- Reconhecimento facial ou marcação automática por aluno.
- Filtro por aluno (decisão: galeria geral aberta).
- Comentários/curtidas.
- App mobile nativo.
