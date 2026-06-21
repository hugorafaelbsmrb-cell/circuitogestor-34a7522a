-- Transforma a Colônia 2026 com tema Copa do Mundo ⚽🇧🇷
DO $$
DECLARE
  v_camp_id UUID;
BEGIN
  SELECT id INTO v_camp_id FROM public.vacation_camps WHERE slug = 'colonia-2026';
  
  IF v_camp_id IS NULL THEN
    RAISE NOTICE 'Campo "colonia-2026" não encontrado.';
    RETURN;
  END IF;

  UPDATE public.vacation_camps SET
    -- Hero
    hero_title = 'Copa do Mundo é na Colônia! ⚽🏆',
    hero_subtitle = 'Enquanto o Brasil joga nas telonas, a criançada joga no campinho! 2 semanas de futebol, diversão e clima de Copa que seu filho nunca vai esquecer 🇧🇷💚💛',
    
    -- Descrição
    description = '⚽🏆 O MUNDO PARA PRA VER A COPA. SEU FILHO PARA PRA VIVER A COPA!\n\n'
      'A Colônia de Férias 2026 chega com tudo no clima da Copa do Mundo! Aqui cada dia é uma partida de pura diversão, '
      'cada atividade é um gol de placa e cada criança é craque do seu próprio time.\n\n'
      'Teremos futebol de sabão, campeonato de vôlei, gincanas temáticas e até nosso próprio "estádio" '
      'de brincadeiras. As crianças vão vibrar, torcer e se divertir como nunca — tudo isso em um ambiente seguro, '
      'com monitores nota 10 e aquele astral de Copa que só a gente sabe fazer!\n\n'
      'Vista a camisa verde e amarela e vem fazer parte desse time! 🟢🟡',
    
    -- Tema verde Copa (verde bandeira)
    theme_color = '#009C3B',
    
    -- Highlights temáticos
    highlights = '[
      {"icon": "Trophy", "title": "Clima de Copa 2026", "description": "Brasil em campo e a gente na torcida! Decoração temática todo dia"},
      {"icon": "Gamepad2", "title": "Nossa Seleção", "description": "Cada criança é craque! Times, campeonatos e muita competição sadia"},
      {"icon": "Shield", "title": "100% Seguro", "description": "Monitores camisa 10 supervisionando tudo de perto"},
      {"icon": "Smile", "title": "Gol de Placa", "description": "Futebol, vôlei, queimada e brincadeiras que são pura alegria"}
    ]'::jsonb,
    
    -- FAQ
    faq = '[
      {
        "question": "⚽ Vai ter futebol de verdade?",
        "answer": "Claro! Futebol de sabão, futebol de campo, campeonato de vôlei e muitas partidas divertidas! E nos intervalos, a gente torce pro Brasil na Copa juntos! 🇧🇷"
      },
      {
        "question": "👶 Meu filho tem 3 anos, pode participar?",
        "answer": "Nossa colônia é pensada para crianças de 4 a 14 anos. Mas se seu pequeno tem 3 aninhos e já é craque, chama a gente no WhatsApp que avaliamos com carinho! 💙"
      },
      {
        "question": "🍎 Está incluso lanche?",
        "answer": "Sim! Lanchinho de craque todo dia: frutas, sucos, pipoca, algodão doce e muito mais. Nos dias de piquenique, a gente capricha no banquete de campeão! 🍉🥤"
      },
      {
        "question": "🕐 Qual o horário das atividades?",
        "answer": "A colônia funciona das 14h às 17h (exceto o passeio de sexta 10/07, das 8h às 11h30). Mas a diversão é tanta que seu craque vai querer prorrogação! ⏰"
      },
      {
        "question": "💳 Como funciona o pagamento?",
        "answer": "PIX ou cartão de crédito em até 3x sem juros. A vaga é confirmada na hora — rápido como um contra-ataque! ⚡"
      },
      {
        "question": "📱 Como acompanho meu filho durante a colônia?",
        "answer": "Grupo exclusivo no WhatsApp com fotos e vídeos dos gols, jogadas e sorrisos do seu craque durante o dia todo! 📸⚽"
      }
    ]'::jsonb,
    
    updated_at = now()
  WHERE id = v_camp_id;

  -- Atualiza pacotes com tema Copa
  UPDATE public.vacation_camp_packages SET
    description = 'Quer experimentar um dia de Copa? Seu craque vai jogar, brincar e se divertir — e no dia seguinte já vai estar pedindo pra voltar! ⚽🔥',
    includes = '[
      "⚽ 1 dia de pura diversão no clima da Copa",
      "🍎 Lanche de campeão incluso",
      "👕 Identificação personalizada",
      "📸 Fotos no grupo do WhatsApp",
      "🤗 Monitoria dedicada"
    ]'::jsonb,
    updated_at = now()
  WHERE camp_id = v_camp_id AND name = 'Pacote Day Use';

  UPDATE public.vacation_camp_packages SET
    description = 'Primeira semana da Copa é aqui! Pool Party, ciência, slime, esportes e passeio. Seu craque vai fazer gol todo dia! ⚽🏆',
    includes = '[
      "⚽ 5 dias de diversão na Semana 1 (06/07 a 10/07)",
      "🍎 Lanche de campeão todos os dias",
      "👕 Camiseta exclusiva verde e amarela",
      "📸 Fotos e vídeos diários no grupo",
      "🎒 Kit boas-vindas com squeeze",
      "🤗 Monitores nota 10"
    ]'::jsonb,
    updated_at = now()
  WHERE camp_id = v_camp_id AND name = 'Pacote Semana I';

  UPDATE public.vacation_camp_packages SET
    description = 'Semana 2 é pra fechar o campeonato! Torta na cara, massinha, origami, cinema e um encerramento de Copa do Mundo! 🎊🏆',
    includes = '[
      "⚽ 5 dias de diversão na Semana 2 (13/07 a 17/07)",
      "🍿 Pipoca e lanche especial todos os dias",
      "👕 Camiseta exclusiva verde e amarela",
      "📸 Fotos e vídeos diários no grupo",
      "🎒 Kit boas-vindas com squeeze",
      "🤗 Monitores nota 10"
    ]'::jsonb,
    updated_at = now()
  WHERE camp_id = v_camp_id AND name = 'Pacote Semana II';

  UPDATE public.vacation_camp_packages SET
    description = 'O pacote CAMPEÃO! Duas semanas completas no clima da Copa do Mundo. Seu craque vai viver a experiência completa com economia de craque! 🏆⚽💰',
    includes = '[
      "⚽ 10 dias de Copa e diversão (06/07 a 17/07)",
      "🍎🍿 Lanche premium + pipoca no cinema",
      "👕 Camiseta verde e amarela + squeeze personalizado",
      "📸 Fotos e vídeos diários no grupo exclusivo",
      "🎒 Super kit Copa (camiseta, squeeze, mochila)",
      "🏅 Medalha de craque no encerramento",
      "🤗 Monitores dedicados 100% do tempo",
      "💰 Economia de R$80 — um golaço!"
    ]'::jsonb,
    updated_at = now()
  WHERE camp_id = v_camp_id AND name = 'Pacote Completo';

  RAISE NOTICE '✅ Tema Copa do Mundo aplicado! ⚽🇧🇷';
END $$;
