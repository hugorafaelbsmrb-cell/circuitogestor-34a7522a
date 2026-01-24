-- Normalizar telefones dos responsáveis para formato padrão W-API (551199999999)
-- Remove todos os caracteres não numéricos e adiciona 55 se não tiver

UPDATE public.guardians
SET phone = 
  CASE 
    -- Se já começa com 55 e tem 12-13 dígitos, apenas remove caracteres especiais
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55\d{10,11}$' THEN
      regexp_replace(phone, '\D', '', 'g')
    -- Se não começa com 55, adiciona 55 na frente
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^\d{10,11}$' THEN
      '55' || regexp_replace(phone, '\D', '', 'g')
    -- Fallback: apenas remove caracteres especiais
    ELSE
      regexp_replace(phone, '\D', '', 'g')
  END
WHERE phone IS NOT NULL 
  AND phone != ''
  -- Só atualiza se ainda não está no formato correto
  AND NOT (regexp_replace(phone, '\D', '', 'g') ~ '^55\d{10,11}$');

-- Normalizar telefones dos leads também
UPDATE public.leads
SET phone = 
  CASE 
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55\d{10,11}$' THEN
      regexp_replace(phone, '\D', '', 'g')
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^\d{10,11}$' THEN
      '55' || regexp_replace(phone, '\D', '', 'g')
    ELSE
      regexp_replace(phone, '\D', '', 'g')
  END
WHERE phone IS NOT NULL 
  AND phone != ''
  AND NOT (regexp_replace(phone, '\D', '', 'g') ~ '^55\d{10,11}$');