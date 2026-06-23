export interface OficioTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  subject: string;
  body: string;
  recipientTitle?: string;
}

export const OFICIO_TEMPLATES: OficioTemplate[] = [
  {
    id: "solicitacao-evento",
    name: "Solicitação de Apoio para Evento",
    category: "Eventos",
    description: "Solicita autorização ou apoio para realização de novo evento.",
    recipientTitle: "Ao(À) Excelentíssimo(a) Senhor(a)",
    subject: "Solicitação de apoio para realização de evento institucional",
    body: `Prezado(a) Senhor(a),

Cumprimentando-o(a) cordialmente, vimos por meio deste ofício solicitar o apoio dessa respeitável instituição para a realização do evento [NOME DO EVENTO], a ser promovido por nossa instituição de ensino na data de [DATA DO EVENTO], no período das [HORA INÍCIO] às [HORA FIM], no local [LOCAL DO EVENTO].

O referido evento tem como objetivo [DESCREVER OBJETIVO DO EVENTO], beneficiando diretamente nossos alunos, familiares e a comunidade escolar como um todo. Estima-se a participação de aproximadamente [NÚMERO] pessoas, entre estudantes, responsáveis, professores e convidados.

Para sua plena realização, solicitamos respeitosamente o seguinte apoio: [LISTAR ITENS / RECURSOS / AUTORIZAÇÕES NECESSÁRIAS].

Colocamo-nos à inteira disposição para prestar quaisquer esclarecimentos adicionais e desde já agradecemos a costumeira atenção dispensada, certos de podermos contar com o valoroso apoio dessa instituição.

Atenciosamente,`,
  },
  {
    id: "convite-evento",
    name: "Convite Institucional para Evento",
    category: "Eventos",
    description: "Convida autoridades ou parceiros para evento da instituição.",
    recipientTitle: "Ao(À) Ilustríssimo(a) Senhor(a)",
    subject: "Convite para participação em evento institucional",
    body: `Prezado(a) Senhor(a),

Temos a honra de convidar Vossa Senhoria para prestigiar o evento [NOME DO EVENTO], a ser realizado por esta instituição de ensino no dia [DATA], às [HORÁRIO], no [LOCAL].

A presença de Vossa Senhoria muito nos honrará e contribuirá para o sucesso de mais esta iniciativa em prol da educação e do desenvolvimento de nossos alunos.

Solicitamos a gentileza de confirmar presença pelo contato [TELEFONE / E-MAIL].

Aproveitamos o ensejo para renovar nossos protestos de elevada estima e consideração.

Atenciosamente,`,
  },
  {
    id: "comunicado-responsaveis",
    name: "Comunicado aos Responsáveis",
    category: "Comunicação",
    description: "Comunica decisões ou informações importantes aos responsáveis.",
    recipientTitle: "Aos Senhores Responsáveis",
    subject: "Comunicado importante",
    body: `Prezados Responsáveis,

Vimos por meio deste comunicado informar que [DESCREVER ASSUNTO PRINCIPAL].

Informamos ainda que [DETALHES ADICIONAIS / ORIENTAÇÕES].

Em caso de dúvidas, a coordenação está à disposição pelos canais oficiais de atendimento.

Agradecemos a compreensão e o apoio de sempre.

Atenciosamente,`,
  },
  {
    id: "solicitacao-orgao-publico",
    name: "Solicitação a Órgão Público",
    category: "Institucional",
    description: "Encaminha requerimento formal a órgãos públicos.",
    recipientTitle: "Ao(À) Excelentíssimo(a) Senhor(a)",
    subject: "Requerimento institucional",
    body: `Excelentíssimo(a) Senhor(a),

Esta instituição de ensino, devidamente registrada e em pleno funcionamento, vem respeitosamente à presença de Vossa Excelência requerer [DESCREVER O QUE ESTÁ SENDO SOLICITADO].

Tal solicitação fundamenta-se em [JUSTIFICATIVA / BASE LEGAL / NECESSIDADE INSTITUCIONAL].

Diante do exposto, requeremos o deferimento do presente pedido, colocando-nos à disposição para prestar quaisquer informações complementares que se façam necessárias.

Nestes termos, pede deferimento.`,
  },
  {
    id: "agradecimento",
    name: "Ofício de Agradecimento",
    category: "Institucional",
    description: "Agradece formalmente apoio, parceria ou participação.",
    recipientTitle: "Ao(À) Ilustríssimo(a) Senhor(a)",
    subject: "Agradecimento institucional",
    body: `Prezado(a) Senhor(a),

É com grande satisfação que esta instituição de ensino vem, por meio deste ofício, expressar seus mais sinceros agradecimentos pelo [DESCREVER MOTIVO DO AGRADECIMENTO].

Reconhecemos que [DESCREVER IMPACTO POSITIVO / CONTRIBUIÇÃO], razão pela qual registramos nosso reconhecimento e gratidão.

Renovamos nossos votos de parceria contínua e nos colocamos à disposição para futuras colaborações.

Atenciosamente,`,
  },
  {
    id: "em-branco",
    name: "Ofício em Branco",
    category: "Outros",
    description: "Começar do zero, sem modelo pré-definido.",
    recipientTitle: "Ao(À) Senhor(a)",
    subject: "",
    body: "",
  },
];
