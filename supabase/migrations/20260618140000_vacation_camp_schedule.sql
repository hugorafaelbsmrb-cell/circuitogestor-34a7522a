-- =====================================================
-- Programação da Colônia de Férias 2026 (2 semanas)
-- =====================================================
DO $$
DECLARE
  v_camp_id UUID;
BEGIN
  -- Busca o camp_id pelo slug
  SELECT id INTO v_camp_id FROM public.vacation_camps WHERE slug = 'colonia-2026';
  
  IF v_camp_id IS NULL THEN
    RAISE NOTICE 'Campo "colonia-2026" não encontrado. Nenhum registro inserido.';
    RETURN;
  END IF;

  -- Remove programação existente para reinserir
  DELETE FROM public.vacation_camp_schedule WHERE camp_id = v_camp_id;

  -- ============ SEMANA 1 ============

  INSERT INTO public.vacation_camp_schedule (camp_id, day_label, time_label, title, description, icon, sort_order) VALUES
  (
    v_camp_id, 'Segunda-feira 06/07', 'Dia inteiro',
    'Abertura – Festa Pool Party 🎉',
    'Futebol de sabão • Gincanas com balão de água • Banho de mangueira • Algodão doce',
    'PartyPopper', 1
  ),
  (
    v_camp_id, 'Terça-feira 07/07', 'Dia inteiro',
    'Oficina Científica 🔬',
    'Experiências e dinâmicas divertidas que despertam a curiosidade científica',
    'Flask', 2
  ),
  (
    v_camp_id, 'Quarta-feira 08/07', 'Dia inteiro',
    'Oficina de Slime 🧪',
    'Jogos em grupo • Dinâmicas criativas • Muita diversão com slime',
    'Sparkles', 3
  ),
  (
    v_camp_id, 'Quinta-feira 09/07', 'Dia inteiro',
    'Meu Time do ❤️',
    'Queimada • Bandeirinha • Vôlei • Futebol – um dia inteiro de esportes!',
    'Trophy', 4
  ),
  (
    v_camp_id, 'Sexta-feira 10/07', 'Dia inteiro',
    'Passeio Cultural 🌳',
    'Passeio ao Parque Municipal João Anselmo (usar calça comprida e tênis) • Piquenique coletivo',
    'Tree', 5
  );

  -- ============ SEMANA 2 ============

  INSERT INTO public.vacation_camp_schedule (camp_id, day_label, time_label, title, description, icon, sort_order) VALUES
  (
    v_camp_id, 'Segunda-feira 13/07', 'Dia inteiro',
    'Passa ou Repassa (Torta na Cara) 🥧',
    'Jogos e competições em grupo • Banho de mangueira',
    'Gamepad2', 6
  ),
  (
    v_camp_id, 'Terça-feira 14/07', 'Dia inteiro',
    'Oficina de Massinha & Slime 🎨',
    'Dinâmicas criativas • Jogos em grupo • Slime e massinha',
    'Palette', 7
  ),
  (
    v_camp_id, 'Quarta-feira 15/07', 'Dia inteiro',
    'Oficina Científica & Origami 🧪📄',
    'Experiências científicas • Dobraduras criativas • Caça ao tesouro',
    'Search', 8
  ),
  (
    v_camp_id, 'Quinta-feira 16/07', 'Dia inteiro',
    'Cine Pipoca 🍿',
    'Passeio ao Cinema do Shopping Verdes Mares',
    'Film', 9
  ),
  (
    v_camp_id, 'Sexta-feira 17/07', 'Dia inteiro',
    'Encerramento 🎊',
    'Futebol de Sabão • Competição de futebol e vôlei • Banho de mangueira • Banho de piscina (pequenos) • Piquenique coletivo • Algodão doce',
    'PartyPopper', 10
  );

  RAISE NOTICE 'Programação inserida: 10 dias (2 semanas)';
END $$;
