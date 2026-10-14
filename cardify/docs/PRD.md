# PRD — Gerador de Flashcards com IA

**Codinome do projeto:** Cardify (nome provisório)
**Versão:** 1.0 — MVP
**Data:** 21/07/2026
**Status:** Rascunho para validação

---

## 1. Resumo executivo

Ferramenta web que transforma material de estudo bruto (PDF, texto colado, vídeo do YouTube) em flashcards e questões prontas para revisão espaçada, exportáveis para o Anki ou revisáveis dentro da própria plataforma.

O produto ataca uma dor específica e repetitiva: **criar flashcards é o trabalho mais chato e mais demorado do método que comprovadamente funciona.** Estudantes de medicina e concurseiros gastam de 3 a 6 horas por semana digitando cartões manualmente — tempo que não é estudo, é digitação.

**Referência de mercado:** o Ankigen4U opera nesse formato com R$ 15.957/mês de receita recorrente verificada e variação de 0% mês a mês. Os concorrentes diretos identificados estão em R$ 528 e R$ 69/mês. Ou seja: demanda comprovada, líder pequeno, nicho ainda não consolidado.

---

## 2. Problema

### 2.1. A dor

O método de repetição espaçada (Anki) é o padrão-ouro entre estudantes de medicina e candidatos a concurso no Brasil. O gargalo não é o método — é a produção do insumo.

| Etapa | Tempo médio | Valor percebido |
|---|---|---|
| Ler o material | 2h | Alto |
| **Transformar em flashcards** | **3h** | **Zero** |
| Revisar os cards | 1h/dia | Alto |

O usuário paga para eliminar a linha do meio.

### 2.2. Por que as soluções atuais não resolvem

- **Fazer na mão:** funciona, mas o custo de tempo faz a maioria desistir na segunda semana.
- **Decks prontos de terceiros:** genéricos, desalinhados com o edital ou com o professor específico, e frequentemente desatualizados.
- **ChatGPT direto:** gera cards razoáveis, mas o usuário precisa reprompter, formatar manualmente, lidar com limite de contexto em PDFs longos e converter para o formato do Anki na unha. É solução de quem tem paciência técnica — a maioria não tem.
- **Ferramentas gringas (Quizlet AI, etc.):** preço em dólar, sem Pix, e exportação para Anki ruim ou inexistente.

### 2.3. Hipótese central

> Se o usuário conseguir subir um PDF e receber, em menos de 2 minutos, um baralho `.apkg` com cards atômicos e bem formatados, ele paga entre R$ 20 e R$ 40 por mês para não voltar a fazer isso manualmente.

---

## 3. Objetivos e métricas de sucesso

### 3.1. Objetivos de negócio

| Marco | Prazo | Meta |
|---|---|---|
| MVP no ar | Semana 3 | Produto funcional com pagamento |
| Primeiros 10 pagantes | Semana 6 | Validação de disposição a pagar |
| R$ 3.000 MRR | Mês 4 | ~100 assinantes |
| R$ 15.000 MRR | Mês 12 | Paridade com o líder atual |

### 3.2. Métricas de produto (North Star e satélites)

- **North Star:** número de cards *exportados e efetivamente importados* no Anki por semana. Card gerado e não usado é vaidade.
- **Ativação:** % de usuários que exportam o primeiro baralho na primeira sessão. Meta: >40%.
- **Retenção:** % de assinantes ativos no mês 3. Meta: >55%.
- **Qualidade:** % de cards descartados na tela de revisão. Se passar de 25%, o prompt está errado.
- **Custo unitário:** custo de LLM por baralho gerado. Teto: R$ 0,60.

### 3.3. Anti-metas

Não perseguir: número de cadastros gratuitos, downloads totais, ou volume de cards gerados sem uso.

---

## 4. Público-alvo

### Persona primária — Marina, estudante de medicina (3º ano)

- 22 anos, usa Anki há 2 anos, tem 12.000 cards acumulados.
- Recebe PDFs de aula e resumos de veteranos toda semana.
- Já paga por outras ferramentas de estudo; sensibilidade a preço baixa.
- **Precisa de cloze (oclusão).** Card básico pergunta-e-resposta não serve para o volume de detalhe que ela decora.
- Gatilho de compra: véspera de prova, sob pressão de tempo.

### Persona secundária — Rafael, concurseiro

- 31 anos, estuda para concurso fiscal há 18 meses, dedicação integral.
- Material: PDFs de cursinho (muitos escaneados), leis secas, editais.
- Sensível a preço, mas horizonte de compra longo (anos de estudo) — melhor LTV do que parece.
- Quer questões no estilo da banca (Cebraspe certo/errado, FGV múltipla escolha), não só flashcards.

### Persona terciária — Vestibulando

Menor poder aquisitivo, sazonalidade forte, churn alto. Atender, mas não desenhar o produto para ele.

### Fora do público

Empresas, treinamento corporativo, professores criando material para turmas. São outro produto, outro ciclo de venda.

---

## 5. Escopo

### 5.1. MVP — obrigatório (v1.0)

| ID | Requisito |
|---|---|
| RF-01 | Upload de PDF (até 50 MB / 300 páginas) |
| RF-02 | Colagem de texto livre (até 50.000 caracteres) |
| RF-03 | Geração de flashcards básicos (frente/verso) via LLM |
| RF-04 | Geração de cloze (oclusão) — `{{c1::texto}}` |
| RF-05 | Tela de revisão: editar, excluir e reordenar cards antes de exportar |
| RF-06 | Exportação `.apkg` nativa do Anki |
| RF-07 | Exportação CSV/TSV (fallback e AnkiDroid) |
| RF-08 | Autenticação (Google + e-mail) |
| RF-09 | Cobrança recorrente com Pix e cartão |
| RF-10 | Controle de cota por plano |

### 5.2. Deveria ter (v1.1 — mês 2)

- RF-11: Importação de vídeo do YouTube via transcrição
- RF-12: OCR para PDFs escaneados (crítico para concurseiros)
- RF-13: Geração de questões de múltipla escolha e certo/errado
- RF-14: Seleção de intervalo de páginas antes de gerar
- RF-15: Histórico de baralhos gerados, com regeneração

### 5.3. Poderia ter (backlog)

- Revisão espaçada dentro do produto (algoritmo FSRS)
- Extensão de navegador para capturar trechos da web
- Upload de imagem/foto de caderno
- Oclusão de imagem (image occlusion) — alto valor para anatomia, alta complexidade
- Compartilhamento de baralhos entre usuários

### 5.4. Explicitamente fora do escopo

- App mobile nativo. O fluxo é "subir PDF no notebook, revisar no celular pelo AnkiDroid". Não competir com o Anki na revisão.
- Marketplace de decks. Muda o produto de ferramenta para plataforma; problema de oferta e demanda que o MVP não precisa.
- Integração com LMS institucional.

---

## 6. Requisitos funcionais detalhados

### RF-01/02 — Ingestão

- Formatos: PDF, TXT, DOCX, colagem direta.
- Extração com PyMuPDF; detectar PDF sem camada de texto e sinalizar ("este arquivo parece escaneado — o OCR está disponível no plano X").
- Limpeza obrigatória: remover cabeçalho/rodapé repetido, numeração de página, marca d'água de cursinho. Lixo no input vira card ruim no output.
- Chunking semântico por seção/título, não por número fixo de caracteres.

### RF-03/04 — Geração

O prompt deve impor o **princípio da informação mínima**: um card, um fato. Regras a codificar:

1. Cada card testa exatamente uma informação.
2. Proibido card com resposta de mais de duas linhas.
3. Proibido card cuja resposta é uma lista de mais de 3 itens — quebrar em cards separados ou virar cloze.
4. A pergunta precisa ser respondível fora de contexto (nada de "qual é a segunda característica citada?").
5. Preservar terminologia técnica exata do material original.
6. Cloze quando o fato é um detalhe dentro de uma frase estruturada; básico quando é conceito-definição.

Controles expostos ao usuário:
- Densidade: enxuto / equilibrado / exaustivo (≈1, 2 ou 4 cards por parágrafo relevante)
- Tipo: básico, cloze, ou misto
- Área: medicina / direito / exatas / geral (ajusta o prompt e o vocabulário)

### RF-05 — Revisão antes da exportação

Tela obrigatória, não pulável no MVP. É o que separa o produto de um wrapper de ChatGPT: o usuário vê, corrige e sente controle. Também é a principal fonte de dados de qualidade — todo descarte é sinal para melhorar o prompt.

- Edição inline de frente e verso
- Excluir card individual, selecionar múltiplos
- Marcar tags por seção do documento
- Botão "regenerar este card"

### RF-06 — Exportação `.apkg`

Requisito não negociável. Usar `genanki` (Python). Detalhes que quebram na prática:

- Modelo de nota estável com GUID fixo por baralho, para que reimportações atualizem em vez de duplicar.
- Nome do baralho derivado do arquivo de origem, com subdecks por seção quando houver estrutura.
- Tags automáticas: `cardify::<origem>::<secao>`.
- Suporte a cloze exige note type de cloze correto — cloze exportado como básico é bug crítico.

### RF-09/10 — Monetização

Cotas por ciclo mensal, medidas em **cards gerados**, não em uploads (protege a margem contra o PDF de 300 páginas).

---

## 7. Fluxo principal

```
Landing → "Colar texto ou subir PDF" (sem login)
   ↓
Geração de amostra: 10 cards grátis, visíveis na hora
   ↓
[Momento do valor percebido — antes de qualquer cadastro]
   ↓
"Gerar os 87 cards restantes" → login → paywall
   ↓
Tela de revisão → editar/excluir
   ↓
Exportar .apkg → importar no Anki
```

**Decisão de produto:** o valor é entregue antes do cadastro. O custo de LLM da amostra é de centavos e a conversão de um usuário que já viu seus próprios cards é ordens de grandeza maior do que a de quem só viu uma landing page.

---

## 8. Requisitos não funcionais

| Área | Requisito |
|---|---|
| Performance | Amostra de 10 cards em <15s. Baralho de 100 cards em <2min. |
| Processamento | Filas assíncronas para documentos grandes; progresso em tempo real. Nunca deixar a requisição HTTP pendurada. |
| Custo | Custo de LLM ≤ R$ 0,60 por baralho de 100 cards. Usar modelo barato para extração e modelo melhor só na formulação. |
| Confiabilidade | Se a geração falhar no meio, entregar o parcial e não cobrar a cota integral. |
| Privacidade | Material de estudo pode ser protegido por direito autoral. Não usar conteúdo do usuário para treino, não indexar, e permitir exclusão permanente. Deixar isso explícito nos termos. |
| Idioma | Português do Brasil como padrão, preservando termos técnicos em latim/inglês quando presentes no original. |

---

## 9. Stack sugerida

| Camada | Escolha | Motivo |
|---|---|---|
| Front | Next.js + Tailwind | Velocidade de entrega, SEO nas páginas de conteúdo |
| Back | Python (FastAPI) | `genanki` e `PyMuPDF` são Python; não vale reimplementar `.apkg` |
| Fila | Redis + worker | Documentos grandes não podem bloquear |
| Banco | Postgres | Padrão |
| LLM | Modelo econômico para extração, modelo forte para formulação | Controle de margem |
| OCR | Tesseract (v1.1) | Custo zero de licença |
| Pagamento | Asaas ou Stripe + Pix | Pix é obrigatório no Brasil; boleto para concurseiro |
| Infra | Qualquer PaaS com cobrança em real | Evitar exposição cambial no custo fixo |

---

## 10. Precificação

| Plano | Preço | Cota | Alvo |
|---|---|---|---|
| Grátis | R$ 0 | 30 cards/mês | Isca e prova de valor |
| Essencial | R$ 24,90/mês | 1.500 cards/mês | Persona primária |
| Ilimitado | R$ 44,90/mês | 10.000 cards/mês + OCR + questões | Concurseiro dedicado |
| Anual | R$ 249/ano | Equivale ao Essencial | **Instrumento anti-churn** |

**Racional do plano anual:** o risco número um deste negócio é o churn pós-prova. O usuário passa no concurso ou termina o semestre e cancela. O plano anual com desconto agressivo captura o LTV antecipadamente, no momento de maior motivação (início do ciclo de estudos, janeiro e agosto).

Margem estimada no Essencial: receita R$ 24,90 − custo de LLM (~R$ 4,50 em uso pesado) − taxa de pagamento (~R$ 1,50) ≈ **R$ 18,90 de margem bruta**, ou 76%.

---

## 11. Riscos e mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| **Churn sazonal pós-prova** | Alta | Plano anual, pacotes de crédito sem validade, expansão para o ciclo seguinte do usuário |
| Qualidade percebida baixa dos cards | Alta | Tela de revisão obrigatória, prompt com princípio da informação mínima, medir taxa de descarte |
| Custo de LLM estourar a margem | Média | Cota por card, cache de documentos idênticos, modelo de dois estágios |
| Commoditização (o próprio ChatGPT resolve) | Média | O fosso não é a IA — é a exportação `.apkg` correta, o parsing de PDF sujo e a UX de revisão. Investir aí, não no wrapper. |
| Direito autoral do material subido | Média | Termos claros, sem redistribuição, sem marketplace de decks no MVP |
| Distribuição (o gargalo real) | **Alta** | Ver seção 12 |

---

## 12. Distribuição

O produto é fácil de construir — logo, o produto não é a vantagem competitiva. O plano de aquisição faz parte do PRD por isso.

1. **SEO de cauda longa:** "como fazer flashcards de [disciplina]", "converter PDF em Anki", "melhor jeito de estudar [matéria]". Baixo custo, retorno lento mas composto.
2. **Comunidades:** subreddits e grupos de Anki, fóruns de concurseiros, Discords de medicina. Presença como usuário útil, não como anúncio.
3. **Decks públicos gratuitos** de alto valor (leis secas, resumos de disciplinas populares) com marca d'água discreta e link. Distribuição pelo próprio artefato.
4. **Parceria com criadores** de conteúdo de estudo — programa de afiliados com comissão recorrente.

---

## 13. Faseamento

| Fase | Duração | Entrega |
|---|---|---|
| **F0 — Validação** | 3 dias | Landing com proposta de valor e captura de e-mail. Rodar 30 gerações manualmente para 30 usuários e medir se eles voltam pedindo mais. |
| **F1 — MVP** | 2-3 semanas | RF-01 a RF-10. Pagamento no ar desde o primeiro dia. |
| **F2 — Diferenciação** | 4 semanas | OCR, YouTube, questões de banca. É aqui que se separa do concorrente de R$ 528. |
| **F3 — Retenção** | 6 semanas | Histórico, regeneração, plano anual, e-mails de reengajamento por ciclo de estudo. |

---

## 14. Critérios de aceite do MVP

O MVP está pronto quando um usuário consegue, sem ajuda:

1. Subir um PDF de 40 páginas de conteúdo denso.
2. Receber 80+ cards em menos de 2 minutos.
3. Descartar menos de 25% deles na revisão.
4. Exportar um `.apkg` que importa no Anki desktop e no AnkiDroid **sem erro e sem duplicata**.
5. Pagar com Pix em menos de 1 minuto.

Se o item 4 falhar, nada mais importa.

---

## 15. Questões em aberto

- Vale competir por cloze de imagem (anatomia) já na v1.1? Alto valor, alta complexidade técnica.
- Cobrar por card gerado ou por documento processado? Card protege a margem, documento é mais fácil de entender.
- O nicho inicial deve ser medicina (maior disposição a pagar, mais exigente) ou concursos (mercado maior, mais sensível a preço)? Recomendação: **começar por um só** e escrever toda a copy para ele.
