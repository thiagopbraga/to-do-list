/**
 * Corpus dos fixtures. Em textos de corpo, `|` marca o ponto onde UMA palavra é desenhada em dois
 * `drawText` colados (sem gap); o texto esperado do agrupador não contém o `|`.
 */

export type Bloco =
  | { tipo: 'h1' | 'h2' | 'h3' | 'p'; texto: string }
  | { tipo: 'quebra' };

const h1 = (texto: string): Bloco => ({ tipo: 'h1', texto });
const h2 = (texto: string): Bloco => ({ tipo: 'h2', texto });
const h3 = (texto: string): Bloco => ({ tipo: 'h3', texto });
const p = (texto: string): Bloco => ({ tipo: 'p', texto });
const quebra: Bloco = { tipo: 'quebra' };

export const AULA_MEDICINA: Bloco[] = [
  h1('Fisiologia Cardiovascular: Fundamentos'),
  h2('Introdução ao Sistema Cardiovascular'),
  h3('Componentes e funções'),
  p(
    'O sistema cardio|vascular é formado pelo coração, pelos vasos sanguíneos e pelo sangue, e tem como funções principais transportar oxigênio e nutrientes aos tecidos, remover o gás carbônico e os produtos do metabolismo, distribuir hormônios e participar da regulação da temperatura corporal. O coração funciona como uma bomba muscular que gera o gradiente de pressão necessário para manter o fluxo contínuo de sangue.',
  ),
  p(
    'Os vasos são classificados em artérias, arteríolas, capilares, vênulas e veias. As arteríolas são os principais vasos de resistência, enquanto as veias, por sua grande complacência, armazenam cerca de 60% do volume sanguíneo total e são chamadas de vasos de capacitância.',
  ),
  h3('Circulação sistêmica e pulmonar'),
  p(
    'O coração direito recebe o sangue venoso das veias cavas e o bombeia para os pulmões pela artéria pulmonar, onde ocorre a hematose. O coração esquerdo recebe o sangue oxigenado das veias pulmonares e o ejeta pela aorta para a circulação sistêmica. As duas circulações estão dispostas em série, de modo que o débito do ventrículo direito e o do esquerdo precisam ser iguais em condições estacionárias.',
  ),
  p(
    'A circulação pulmonar é um sistema de baixa pressão e baixa resistência: a pressão média da artéria pulmonar é de aproximadamente 15 mmHg, contra cerca de 93 mmHg da pressão arterial média sistêmica.',
  ),
  quebra,
  h2('Ciclo Cardíaco'),
  h3('Sístole e diástole'),
  p(
    'O ciclo cardíaco compreende o conjunto de eventos mecânicos e elétricos que ocorrem entre o início de um batimento e o início do seguinte. Com frequência cardíaca de 75 bpm, cada ciclo dura cerca de 0,8 segundo, sendo a sístole ventri|cular responsável por aproximadamente 0,3 segundo e a diástole por 0,5 segundo. Quando a frequência aumenta, a diástole encurta proporcionalmente mais que a sístole.',
  ),
  h3('Fases do ciclo'),
  p(
    'O ciclo pode ser dividido em contração isovolumétrica, ejeção rápida e lenta, relaxamento isovolumétrico, enchimento rápido, diástase e sístole atrial. Durante a contração isovolumétrica todas as valvas estão fechadas e a pressão ventri|cular sobe sem variação de volume, até superar a pressão aórtica e abrir a valva aórtica.',
  ),
  p(
    'O volume diastólico final do ventrículo esquerdo é de cerca de 120 mL e o volume sistólico final de cerca de 50 mL. A diferença entre os dois, de aproximadamente 70 mL, é o volume sistólico, e a razão entre o volume sistólico e o diastólico final é a fração de ejeção, normalmente superior a 55%.',
  ),
  h3('Bulhas cardíacas'),
  p(
    'A primeira bulha (B1) corresponde ao fechamento das valvas mitral e tricúspide no início da sístole. A segunda bulha (B2) resulta do fechamento das valvas aórtica e pulmonar no início da diástole. A terceira bulha, quando audível em adultos, sugere sobrecarga de volume e disfunção ventricular, enquanto a quarta bulha está associada à contração atrial contra um ventrículo pouco complacente.',
  ),
  quebra,
  h2('Eletrofisiologia Cardíaca'),
  h3('Potencial de ação do miócito'),
  p(
    'O potencial de ação do miócito ventri|cular tem cinco fases. A fase 0 é a despolarização rápida, causada pela entrada de sódio. A fase 1 é uma repolarização inicial breve. A fase 2, o platô, depende da entrada de cálcio pelos canais do tipo L e é responsável pela longa duração do potencial, que impede o tétano cardíaco. A fase 3 é a repolarização pela saída de potássio, e a fase 4 corresponde ao potencial de repouso, de cerca de -90 mV.',
  ),
  h3('Sistema de condução'),
  p(
    'O nó sinoatrial é o marca-passo natural do coração, com automatismo próprio e fre|quência de 60 a 100 disparos por minuto. O impulso atravessa as vias internodais, chega ao nó atrioventricular, onde sofre um retardo de cerca de 0,1 segundo que permite o enchimento ventricular, e segue pelo feixe de His, pelos ramos direito e esquerdo e pelas fibras de Purkinje. Na falha do nó sinoatrial, o nó atrioventricular assume com 40 a 60 bpm, e as fibras de Purkinje com 20 a 40 bpm.',
  ),
  p(
    'O eletrocardiograma registra a atividade elétrica global: a onda P representa a despolarização atrial, o complexo QRS a despolarização ventricular e a onda T a repolarização ventricular. O intervalo PR normal vai de 0,12 a 0,20 segundo e reflete o retardo no nó atrioventricular.',
  ),
  quebra,
  h2('Débito Cardíaco'),
  h3('Determinantes'),
  p(
    'O débito cardíaco é o volume de sangue ejetado por minuto por cada ventrículo e é o produto da frequência cardíaca pelo volume sistólico. Em um adulto em repouso, com 70 bpm e 70 mL por batimento, o débito é de aproximadamente 5 L/min. O volume sistólico depende da pré-carga, da pós-carga e da contratilidade, enquanto a frequência cardíaca é modulada pelo sistema nervoso autônomo.',
  ),
  p(
    'Durante o exercício intenso, o débito cardíaco de um indivíduo treinado pode chegar a 25 L/min ou mais, graças ao aumento simultâneo da frequência cardíaca e do volume sistólico.',
  ),
  h3('Lei de Frank-Starling'),
  p(
    'A lei de Frank-Starling afirma que, dentro de limites fisiológicos, quanto maior o enchimento diastólico do coração, maior a força de contração e o volume sistólico ejetado. O mecanismo está ligado à sobreposição ótima entre os filamentos de actina e miosina e à maior sensibilidade ao cálcio. Esse mecanismo intrínseco garante que o ventrículo esquerdo ejete todo o sangue que recebe do retorno venoso, equilibrando os débitos dos dois lados do coração.',
  ),
  p(
    'Na insuficiência cardíaca, a curva de Frank-Starling se desloca para baixo e para a direita: para um mesmo enchimento, o volume sistólico é menor, e o aumento compensatório da pré-carga acaba por causar congestão pulmonar ou sistêmica.',
  ),
  quebra,
  h2('Regulação da Pressão Arterial'),
  h3('Controle neural de curto prazo'),
  p(
    'A pressão arterial é o produto do débito cardíaco pela resistência vascular periférica. O controle de curto prazo é feito pelo reflexo barorreceptor: receptores de estiramento no seio carotídeo e no arco aórtico enviam sinais pelos nervos glossofaríngeo e vago ao núcleo do trato solitário, no bulbo. Uma queda da pressão reduz a descarga dos barorreceptores, o que aumenta a atividade simpática, diminui a parassimpática e eleva a frequência cardíaca e a resistência periférica.',
  ),
  h3('Sistema renina-angiotensina-aldosterona'),
  p(
    'No controle de médio e longo prazo, a queda da pressão de perfusão renal estimula as células justaglomerulares a liberarem renina. A renina converte o angiotensinogênio, de origem hepática, em angiotensina I, que a enzima conversora de angiotensina (ECA) transforma em angiotensina II. A angiotensina II é um potente vasoconstritor, estimula a liberação de aldosterona pelo córtex da suprarrenal e a sede, e aumenta a reabsorção de sódio e água.',
  ),
  p(
    'A aldosterona age no túbulo distal e no ducto coletor, promovendo reabsorção de sódio e excreção de potássio. Os inibidores da ECA e os bloqueadores do receptor de angiotensina são usados no tratamento da hipertensão e da insuficiência cardíaca por interromperem esse eixo.',
  ),
  quebra,
  h2('Circulação Coronariana'),
  h3('Fluxo coronariano'),
  p(
    'As artérias coronárias direita e esquerda originam-se na raiz da aorta, logo acima da valva aórtica. O fluxo para o ventrículo esquerdo ocorre predominantemente na diástole, porque durante a sístole a contração do miocárdio comprime os vasos intramurais. Em repouso, o fluxo coronariano é de cerca de 250 mL/min, ou 5% do débito cardíaco.',
  ),
  p(
    'O miocárdio extrai cerca de 70% do oxigênio do sangue coronariano em repouso, de modo que o aumento da demanda de oxigênio só pode ser atendido por aumento do fluxo, mediado principalmente por vasodilatação metabólica, com participação da adenosina e do óxido nítrico.',
  ),
  h3('Isquemia miocárdica'),
  p(
    'A isquemia ocorre quando a oferta de oxigênio não atende à demanda do miocárdio, geralmente por obstrução aterosclerótica de uma artéria coronária. Se a isquemia é transitória, manifesta-se como angina; se é prolongada, leva à necrose das células miocárdicas, caracterizando o infarto agudo do miocárdio. A elevação de troponina no sangue é o marcador de necrose mais sensível e específico.',
  ),
];

export type ItemLei = { nivel: 'cap' | 'art' | 'par' | 'inc' | 'ali'; texto: string };

const L = (nivel: ItemLei['nivel'], texto: string): ItemLei => ({ nivel, texto });

export const LEI_SECA: ItemLei[] = [
  L('cap', 'TÍTULO I – DAS DISPOSIÇÕES GERAIS'),
  L('art', 'Art. 1º Este Código institui o sistema tributário do Município de Vila Nova e estabelece normas gerais de direito tributário aplicáveis às relações entre o fisco e os contribuintes.'),
  L('par', 'Parágrafo único. Aplicam-se subsidiariamente as normas gerais editadas pela União.'),
  L('art', 'Art. 2º Os tributos de competência do Município são:'),
  L('inc', 'I – impostos;'),
  L('inc', 'II – taxas, em razão do exercício do poder de polícia ou pela utilização de serviços públicos específicos e divisíveis;'),
  L('inc', 'III – contribuição de melhoria, decorrente de obras públicas.'),
  L('art', 'Art. 3º Tributo é toda prestação pecuniária compulsória, em moeda ou cujo valor nela se possa exprimir, que não constitua sanção de ato ilícito, instituída em lei e cobrada mediante atividade administrativa plenamente vinculada.'),
  L('art', 'Art. 4º A natureza jurídica específica do tributo é determinada pelo fato gerador da respectiva obrigação, sendo irrelevantes:'),
  L('inc', 'I – a denominação e demais características formais adotadas pela lei;'),
  L('inc', 'II – a destinação legal do produto da sua arrecadação.'),
  L('cap', 'TÍTULO II – DO IMPOSTO PREDIAL E TERRITORIAL URBANO'),
  L('art', 'Art. 5º O imposto sobre a propriedade predial e territorial urbana tem como fato gerador a propriedade, o domínio útil ou a posse de bem imóvel localizado na zona urbana do Município.'),
  L('par', '§ 1º Considera-se zona urbana a definida em lei municipal, observado o requisito mínimo da existência de melhoramentos construídos ou mantidos pelo Poder Público, em pelo menos dois dos seguintes incisos:'),
  L('inc', 'I – meio-fio ou calçamento, com canalização de águas pluviais;'),
  L('inc', 'II – abastecimento de água;'),
  L('inc', 'III – sistema de esgotos sanitários;'),
  L('inc', 'IV – rede de iluminação pública, com ou sem posteamento para distribuição domiciliar;'),
  L('inc', 'V – escola primária ou posto de saúde a uma distância máxima de três quilômetros do imóvel considerado.'),
  L('par', '§ 2º A lei municipal pode considerar urbanas as áreas urbanizáveis ou de expansão urbana, constantes de loteamentos aprovados pelos órgãos competentes.'),
  L('art', 'Art. 6º A base de cálculo do imposto é o valor venal do imóvel, apurado conforme planta genérica de valores atualizada a cada quatro anos.'),
  L('par', '§ 1º Na determinação da base de cálculo não se considera o valor dos bens móveis mantidos, em caráter permanente ou temporário, no imóvel, para efeito de sua utilização, exploração, aformoseamento ou comodidade.'),
  L('par', '§ 2º As alíquotas são de:'),
  L('inc', 'I – 0,8% (oito décimos por cento) para imóveis residenciais edificados;'),
  L('inc', 'II – 1,5% (um e meio por cento) para imóveis não residenciais;'),
  L('inc', 'III – 3% (três por cento) para terrenos não edificados.'),
  L('art', 'Art. 7º O contribuinte do imposto é o proprietário do imóvel, o titular do seu domínio útil ou o seu possuidor a qualquer título.'),
  L('art', 'Art. 8º O imposto será lançado anualmente, em nome do sujeito passivo, podendo ser pago à vista, com desconto de 10% (dez por cento), ou em até dez parcelas mensais e sucessivas.'),
  L('cap', 'TÍTULO III – DO IMPOSTO SOBRE SERVIÇOS'),
  L('art', 'Art. 9º O imposto sobre serviços de qualquer natureza tem como fato gerador a prestação de serviços constantes da lista anexa a este Código, ainda que não se constituam como atividade preponderante do prestador.'),
  L('par', '§ 1º O imposto não incide sobre:'),
  L('inc', 'I – as exportações de serviços para o exterior do País;'),
  L('inc', 'II – a prestação de serviços em relação de emprego, dos trabalhadores avulsos, dos diretores e membros de conselho consultivo ou de conselho fiscal de sociedades e fundações;'),
  L('inc', 'III – o valor intermediado no mercado de títulos e valores mobiliários.'),
  L('par', '§ 2º O serviço considera-se prestado, e o imposto devido, no local do estabelecimento prestador.'),
  L('art', 'Art. 10. A base de cálculo do imposto é o preço do serviço.'),
  L('par', '§ 1º Quando os serviços descritos forem prestados por sociedades uniprofissionais, o imposto será calculado por meio de valor fixo anual, em função do número de profissionais habilitados.'),
  L('par', '§ 2º A alíquota máxima do imposto é de 5% (cinco por cento) e a mínima de 2% (dois por cento).'),
  L('art', 'Art. 11. São responsáveis pelo imposto, na qualidade de substitutos tributários, os tomadores de serviços prestados por pessoas jurídicas não estabelecidas no Município.'),
  L('cap', 'TÍTULO IV – DAS TAXAS'),
  L('art', 'Art. 12. A taxa de licença de funcionamento tem como fato gerador o exercício regular do poder de polícia municipal sobre a localização, a instalação e o funcionamento de estabelecimentos.'),
  L('art', 'Art. 13. A taxa de coleta de lixo tem como fato gerador a utilização, efetiva ou potencial, do serviço público específico e divisível de coleta, remoção e destinação de resíduos sólidos domiciliares.'),
  L('par', 'Parágrafo único. É vedada a adoção de base de cálculo própria de imposto na instituição de taxas.'),
  L('art', 'Art. 14. Não se sujeitam ao pagamento de taxas:'),
  L('inc', 'I – os templos de qualquer culto;'),
  L('inc', 'II – as entidades beneficentes de assistência social que atendam aos requisitos legais;'),
  L('inc', 'III – as pessoas naturais com renda familiar inferior a dois salários mínimos, mediante requerimento.'),
  L('cap', 'TÍTULO V – DO CRÉDITO TRIBUTÁRIO'),
  L('art', 'Art. 15. O crédito tributário decorre da obrigação principal e tem a mesma natureza desta.'),
  L('art', 'Art. 16. O lançamento é o procedimento administrativo tendente a verificar a ocorrência do fato gerador, determinar a matéria tributável, calcular o montante do tributo devido, identificar o sujeito passivo e, sendo caso, propor a aplicação da penalidade cabível.'),
  L('par', 'Parágrafo único. A atividade administrativa de lançamento é vinculada e obrigatória, sob pena de responsabilidade funcional.'),
  L('art', 'Art. 17. Suspendem a exigibilidade do crédito tributário:'),
  L('inc', 'I – a moratória;'),
  L('inc', 'II – o depósito do seu montante integral;'),
  L('inc', 'III – as reclamações e os recursos administrativos;'),
  L('inc', 'IV – a concessão de medida liminar em mandado de segurança.'),
  L('art', 'Art. 18. Extinguem o crédito tributário:'),
  L('inc', 'I – o pagamento;'),
  L('inc', 'II – a compensação;'),
  L('inc', 'III – a transação;'),
  L('inc', 'IV – a remissão;'),
  L('inc', 'V – a prescrição e a decadência;'),
  L('inc', 'VI – a conversão de depósito em renda.'),
  L('art', 'Art. 19. O direito de a Fazenda Pública constituir o crédito tributário extingue-se após cinco anos, contados:'),
  L('inc', 'I – do primeiro dia do exercício seguinte àquele em que o lançamento poderia ter sido efetuado;'),
  L('inc', 'II – da data em que se tornar definitiva a decisão que houver anulado, por vício formal, o lançamento anteriormente efetuado.'),
  L('art', 'Art. 20. A ação para a cobrança do crédito tributário prescreve em cinco anos, contados da data da sua constituição definitiva.'),
  L('art', 'Art. 21. O contribuinte em débito poderá requerer parcelamento em até sessenta parcelas mensais, acrescidas de juros e correção monetária, vedado o parcelamento de valores inferiores a R$ 100,00.'),
  L('art', 'Art. 22. Esta Lei entra em vigor na data de sua publicação, revogadas as disposições em contrário.'),
];

export interface Slide {
  titulo: string;
  bullets: string[];
}

export const SLIDES: Slide[] = [
  {
    titulo: 'Anatomia do Coração',
    bullets: [
      'Quatro câmaras: dois átrios e dois ventrículos',
      'Valvas atrioventriculares: mitral e tricúspide',
      'Valvas semilunares: aórtica e pulmonar',
      'Parede ventricular esquerda mais espessa que a direita',
      'Pericárdio fibroso e seroso envolve o coração',
    ],
  },
  {
    titulo: 'Ciclo Cardíaco',
    bullets: [
      'Duração de 0,8 s com 75 bpm',
      'Sístole ventricular: contração isovolumétrica e ejeção',
      'Diástole: relaxamento isovolumétrico e enchimento',
      'B1: fechamento das valvas mitral e tricúspide',
      'B2: fechamento das valvas aórtica e pulmonar',
    ],
  },
  {
    titulo: 'Débito Cardíaco',
    bullets: [
      'DC = frequência cardíaca × volume sistólico',
      'Repouso: cerca de 5 L/min',
      'Pré-carga, pós-carga e contratilidade',
      'Lei de Frank-Starling',
    ],
  },
  {
    titulo: 'Eletrocardiograma Normal',
    bullets: [
      'Onda P: despolarização atrial',
      'Complexo QRS: despolarização ventricular',
      'Onda T: repolarização ventricular',
      'Intervalo PR de 0,12 a 0,20 s',
      'Frequência: 1500 dividido pelos quadradinhos entre dois R',
    ],
  },
  {
    titulo: 'Regulação da Pressão Arterial',
    bullets: [
      'PA = débito cardíaco × resistência periférica',
      'Reflexo barorreceptor: ação rápida',
      'Sistema renina-angiotensina-aldosterona: ação lenta',
      'Hormônio antidiurético e peptídeo natriurético atrial',
    ],
  },
];

export const TEXTO_COLADO = `A Constituição da República Federativa do Brasil de 1988 estabelece, logo em seu primeiro artigo, que o Brasil constitui-se em Estado Democrático de Direito e tem como fundamentos a soberania, a cidadania, a dignidade da pessoa humana, os valores sociais do trabalho e da livre iniciativa e o pluralismo político. O parágrafo único do mesmo artigo afirma que todo o poder emana do povo, que o exerce por meio de representantes eleitos ou diretamente, nos termos da Constituição.

São Poderes da União, independentes e harmônicos entre si, o Legislativo, o Executivo e o Judiciário, conforme o artigo 2º. A separação de poderes não é absoluta: cada Poder exerce, além de sua função típica, funções atípicas, e o sistema de freios e contrapesos impede que qualquer deles se sobreponha aos demais. O Congresso Nacional, por exemplo, exerce a função típica de legislar e fiscalizar, mas também administra seus serviços e julga o Presidente da República nos crimes de responsabilidade, por meio do Senado Federal.

Os objetivos fundamentais da República, previstos no artigo 3º, são construir uma sociedade livre, justa e solidária, garantir o desenvolvimento nacional, erradicar a pobreza e a marginalização, reduzir as desigualdades sociais e regionais e promover o bem de todos, sem preconceitos de origem, raça, sexo, cor, idade e quaisquer outras formas de discriminação. Já o artigo 4º enumera os princípios que regem as relações internacionais, entre eles a independência nacional, a prevalência dos direitos humanos, a autodeterminação dos povos, a não intervenção e a defesa da paz.

O Título II trata dos direitos e garantias fundamentais. O artigo 5º assegura a brasileiros e estrangeiros residentes no País a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade. Entre os incisos mais cobrados estão a legalidade, segundo a qual ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei, a presunção de inocência até o trânsito em julgado de sentença penal condenatória, o devido processo legal, o contraditório e a ampla defesa, e a vedação das provas obtidas por meios ilícitos. As normas definidoras dos direitos e garantias fundamentais têm aplicação imediata, nos termos do parágrafo primeiro.

Para proteger esses direitos, a Constituição previu remédios constitucionais. O habeas corpus tutela a liberdade de locomoção diante de ilegalidade ou abuso de poder. O mandado de segurança protege direito líquido e certo não amparado por habeas corpus ou habeas data. O habeas data garante o acesso e a retificação de informações pessoais constantes de registros públicos. O mandado de injunção é cabível quando a falta de norma regulamentadora torna inviável o exercício de direitos e liberdades constitucionais. Por fim, a ação popular permite a qualquer cidadão anular ato lesivo ao patrimônio público, à moralidade administrativa, ao meio ambiente e ao patrimônio histórico e cultural.

Quanto à organização do Estado, a República Federativa é formada pela união indissolúvel dos Estados, dos Municípios e do Distrito Federal, todos autônomos. A repartição de competências é uma das características centrais do federalismo brasileiro. A União possui competências privativas, listadas no artigo 22, como legislar sobre direito civil, penal, processual e do trabalho. Há ainda competências comuns, em que todos os entes administram em cooperação, e competências concorrentes, em que a União edita normas gerais e os Estados suplementam a legislação conforme suas peculiaridades.

A Administração Pública direta e indireta de qualquer dos Poderes obedecerá, segundo o artigo 37, aos princípios da legalidade, impessoalidade, moralidade, publicidade e eficiência. A investidura em cargo ou emprego público depende de aprovação prévia em concurso público de provas ou de provas e títulos, ressalvadas as nomeações para cargo em comissão, declarado em lei de livre nomeação e exoneração. O prazo de validade do concurso será de até dois anos, prorrogável uma vez por igual período, e a lei estabelecerá os casos de contratação por tempo determinado para atender a necessidade temporária de excepcional interesse público.

Os direitos sociais, previstos no artigo 6º, são a educação, a saúde, a alimentação, o trabalho, a moradia, o transporte, o lazer, a segurança, a previdência social, a proteção à maternidade e à infância e a assistência aos desamparados. O artigo 7º lista os direitos dos trabalhadores urbanos e rurais, como o salário mínimo, o décimo terceiro salário, as férias remuneradas acrescidas de um terço, a licença à gestante de cento e vinte dias e a duração do trabalho normal não superior a oito horas diárias e quarenta e quatro semanais.

O controle de constitucionalidade é exercido de duas formas principais. No controle difuso, qualquer juiz ou tribunal pode afastar, no caso concreto, a aplicação de lei incompatível com a Constituição, e a decisão tem, em regra, efeitos apenas entre as partes. No controle concentrado, o Supremo Tribunal Federal julga, em abstrato, a ação direta de inconstitucionalidade, a ação declaratória de constitucionalidade e a arguição de descumprimento de preceito fundamental, com eficácia contra todos e efeito vinculante. Os legitimados para propor essas ações estão listados no artigo 103 e incluem o Presidente da República, as Mesas do Senado e da Câmara, os governadores, o Procurador-Geral da República e partidos políticos com representação no Congresso Nacional.

A Constituição pode ser alterada por meio de emendas, desde que proposta por pelo menos um terço dos membros da Câmara dos Deputados ou do Senado Federal, pelo Presidente da República ou por mais da metade das Assembleias Legislativas. A proposta será discutida e votada em cada Casa do Congresso Nacional, em dois turnos, considerando-se aprovada se obtiver, em ambos, três quintos dos votos dos respectivos membros. Há, contudo, limites materiais ao poder de reforma: não será objeto de deliberação a proposta de emenda tendente a abolir a forma federativa de Estado, o voto direto, secreto, universal e periódico, a separação dos Poderes e os direitos e garantias individuais, as chamadas cláusulas pétreas do artigo 60, parágrafo quarto.
`;
