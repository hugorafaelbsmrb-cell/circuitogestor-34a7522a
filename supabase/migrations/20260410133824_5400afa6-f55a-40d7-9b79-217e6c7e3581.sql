
-- Update clause 2 to reflect 8h30min duration for Maternal
UPDATE contract_clauses 
SET content = 'As aulas terão duração de 8h30min (oito horas e trinta minutos), no horário das 08:30 às 17:00, conforme o cronograma pedagógico da instituição.'
WHERE id = 'b433eab7-e851-4918-9f59-4490f43b4644';

-- Update Kaynan's contract content: fix clause 2 and schedule time
UPDATE contracts 
SET contract_content = jsonb_set(
  jsonb_set(
    jsonb_set(
      contract_content::jsonb,
      '{clauses,1,content}',
      '"As aulas terão duração de 8h30min (oito horas e trinta minutos), no horário das 08:30 às 17:00, conforme o cronograma pedagógico da instituição."'
    ),
    '{schedule}',
    '"Segunda-feira, Terça-feira, Quarta-feira, Quinta-feira, Sexta-feira • 08:30 às 17:00"'
  ),
  '{selectedDays}',
  '[{"day":"Segunda-feira","time":"08:30 às 17:00"},{"day":"Terça-feira","time":"08:30 às 17:00"},{"day":"Quarta-feira","time":"08:30 às 17:00"},{"day":"Quinta-feira","time":"08:30 às 17:00"},{"day":"Sexta-feira","time":"08:30 às 17:00"}]'::jsonb
)
WHERE id = '213885ec-3d36-4ee9-943c-4f54c210bd5d';
