-- =====================================================
-- Colônia de Férias 2026 – Preenchimento completo
-- Tom divertido, alegre e cheio de energia!
-- =====================================================
DO $$
DECLARE
  v_camp_id UUID;
BEGIN
  SELECT id INTO v_camp_id FROM public.vacation_camps WHERE slug = 'colonia-2026';
  
  IF v_camp_id IS NULL THEN
    RAISE NOTICE 'Campo "colonia-2026" não encontrado.';
    RETURN;
  END IF;

  -- =============================================
  -- 1. ATUALIZA CAMP COM DADOS COMPLETOS
  -- =============================================
  UPDATE public.vacation_camps SET
    -- Hero
    hero_title = 'As Férias Mais Incríveis da Cidade! 🌟',
    hero_subtitle = '2 semanas de pura diversão, amizades e aventuras que seu filho vai guardar pra sempre no coração 💙',
    
    -- Datas e local
    start_date = '2026-07-06',
    end_date = '2026-07-17',
    location = 'Circuito Kids – Sede Principal',
    
    -- Idades
    age_min = 4,
    age_max = 14,
    
    -- Descrição (vibe alegre!)
    description = '🎉 BEM-VINDOS À MELHOR COLÔNIA DE FÉRIAS DO PEDAÇO!\n\n'
      'Aqui a diversão não tem hora pra acabar! São 10 dias de pura magia onde cada criança descobre um mundo de aventuras, '
      'faz amigos pra vida toda e volta pra casa com um sorriso que não cabe no rosto.\n\n'
      'Tem futebol de sabão, slime melequento, caça ao tesouro, cinema com pipoca, torta na cara, banho de mangueira '
      'e muito mais! Nossa equipe de monitores é sensacional e prepara cada atividade com muito carinho e segurança.\n\n'
      'Enquanto seu filho se diverte, você fica tranquilo(a) sabendo que ele está em um ambiente seguro, '
      'acolhedor e cheio de estímulos positivos. Vem viver essa experiência com a gente! 🚀',
    
    -- CTAs e contato
    cta_text = 'Quero Garantir a Vaga! 🎯',
    whatsapp_number = '5527997054789',
    
    -- Termos/rodapé
    terms_text = '🌸 Nosso compromisso é com a segurança e felicidade de cada criança.\n'
      'Monitores treinados, ambiente supervisionado e muita diversão garantida.\n'
      'Ao se inscrever, você receberá todas as orientações por WhatsApp.\n'
      'Qualquer dúvida, é só chamar a gente! 💬',
    
    -- Cor tema (laranja vibrante)
    theme_color = '#FF6B35',
    
    -- Highlights (4 cards na home)
    highlights = '[
      {"icon": "Sun", "title": "10 Dias de Aventura", "description": "Duas semanas completas de atividades incríveis"},
      {"icon": "Users", "title": "Novos Amigos", "description": "Turmas reduzidas para cada criança brilhar"},
      {"icon": "Shield", "title": "100% Seguro", "description": "Monitores treinados e ambiente supervisionado"},
      {"icon": "Smile", "title": "Muita Diversão", "description": "Brincadeiras, esportes, arte e ciência todo dia"}
    ]'::jsonb,
    
    -- FAQ (perguntas frequentes)
    faq = '[
      {
        "question": "🎒 O que meu filho precisa levar?",
        "answer": "Roupa confortável, tênis, chinelo, toalha, protetor solar, troca de roupa e MUITA vontade de se divertir! Nos dias de passeio, calça comprida e tênis são obrigatórios. O lanche é por nossa conta! 🍎"
      },
      {
        "question": "👶 Meu filho tem 3 anos, pode participar?",
        "answer": "Nossa colônia é pensada para crianças de 4 a 14 anos. Mas se seu pequeno tem 3 aninhos e é super independente, entra em contato com a gente pelo WhatsApp que avaliamos com carinho! 💙"
      },
      {
        "question": "🍎 Está incluso lanche?",
        "answer": "Sim! Todos os dias tem lanchinho especial: frutas, sucos, pipoca, algodão doce e muito mais. Nos dias de piquenique, caprichamos ainda mais! Seu filho não vai passar vontade de nada. 😋"
      },
      {
        "question": "🕐 Qual o horário das atividades?",
        "answer": "A colônia funciona das 8h às 17h, de segunda a sexta. Mas a diversão é tanta que seu filho vai pedir pra chegar mais cedo e sair mais tarde! ⏰"
      },
      {
        "question": "💳 Como funciona o pagamento?",
        "answer": "Você pode pagar via PIX ou cartão de crédito. No cartão, parcelamos em até 3x sem juros. A confirmação da vaga é imediata após o pagamento. Simples assim! ✨"
      },
      {
        "question": "📱 Como recebo informações durante a colônia?",
        "answer": "Criamos um grupo no WhatsApp para os pais com fotos e vídeos das atividades durante o dia. Você vai acompanhar cada sorriso do seu filho em tempo real! 📸"
      }
    ]'::jsonb,
    
    -- Gallery (comentado pois precisa de imagens reais)
    gallery = '[]'::jsonb,
    
    updated_at = now()
  WHERE id = v_camp_id;

  -- =============================================
  -- 2. ATUALIZA PACOTES COM DESCRIÇÕES DIVERTIDAS
  -- =============================================
  
  -- Atualiza o pacote existente "DAy uSe" (1 dia avulso)
  UPDATE public.vacation_camp_packages SET
    description = 'Ideal pra experimentar um dia de pura farra e ver se seu filho não vai querer voltar todos os dias (spoiler: vai sim! 😅)',
    includes = '[
      "🎯 1 dia inteiro de atividades iradas",
      "🍎 Lanche delicioso incluso",
      "👕 Identificação personalizada",
      "📸 Fotos no grupo do WhatsApp",
      "🤗 Monitoria dedicada e carinhosa"
    ]'::jsonb,
    updated_at = now()
  WHERE camp_id = v_camp_id AND name = 'DAy uSe';

  RAISE NOTICE '✅ Campos preenchidos com sucesso! Confira a página :)';
END $$;
