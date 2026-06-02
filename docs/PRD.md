# PRD: Projeto StickyFlow - To-Do List Visual (Versão Local)

### 1. Visão Geral do Produto

O StickyFlow é um gerenciador de tarefas visual baseado no conceito de um quadro físico de post-its. O objetivo é resgatar a sensação tátil e intuitiva de organizar ideias através do "arrastar e soltar", operando de forma 100% local, privada e sem necessidade de cadastro.

### 2. Público-Alvo

Usuários que buscam uma ferramenta de organização espacial rápida, que valorizam a privacidade dos seus dados (sem armazenamento em nuvem de terceiros) e que precisam de portabilidade simples entre seus próprios dispositivos.

---

### 3. Funcionalidades Principais (O Essencial)

Estas são as regras de negócio básicas para o funcionamento do MVP:

* **Criação Rápida:** Adicionar um novo post-it com um clique duplo em qualquer lugar vazio do quadro.
* **Drag and Drop Fluido:** Capacidade de clicar, segurar e arrastar o post-it livremente pela tela ou travá-lo em colunas (Kanban).
* **Edição Direta:** Clicar no texto do post-it para editar o conteúdo em tempo real.
* **Categorização Visual:** Troca rápida da cor de fundo do post-it.
* **Persistência em localStorage:** Salvamento automático de qualquer alteração (texto, cor, posição X e Y). Se o usuário fechar a aba ou atualizar a página, o quadro reabre exatamente como foi deixado.
* **Exportação de Dados (Backup):** Um botão que gera e baixa instantaneamente um arquivo de texto (formato `.json`) contendo a estrutura completa do quadro atual.
* **Importação de Dados (Restaurar):** Uma área de upload onde o usuário pode carregar um arquivo `.json` previamente exportado. O sistema deve ler o arquivo, validar a estrutura e sobrescrever (ou mesclar) o `localStorage` para restaurar o estado do quadro.

---

### 4. Features Diferenciadas (O Fator Inovação)

* **Envelhecimento Visual (Decay):** Post-its sem modificações por muito tempo começam a desbotar levemente.
* **Lixeira Tátil (Amassar Papel):** Arrastar o post-it até a lixeira dispara uma animação de papel amassado.
* **Empilhamento (Grouping):** Soltar um post-it em cima de outro cria um "deck" (subtarefas).
* **Alinhamento Magnético:** Botão para organizar automaticamente as notas espalhadas em uma grade perfeita.

---

### 5. Requisitos Não Funcionais e Regras de Negócio de Dados

* **Tratamento de Erros na Importação:** Caso o usuário tente importar um arquivo corrompido ou com formato inválido, a aplicação deve exibir um alerta amigável ("Arquivo inválido") e impedir a quebra do layout.
* **Confirmação de Sobrescrita:** Ao importar um arquivo, o sistema deve exibir um aviso claro informando que os dados atuais do navegador serão substituídos pelos dados do arquivo importado.
* **Performance da Animação:** Movimentação a 60fps sem engasgos.
* **Capacidade Limite:** O `localStorage` possui um limite médio de 5MB por domínio. A aplicação deve ser otimizada para armazenar apenas textos leves e coordenadas, o que é mais do que suficiente para milhares de post-its.

---

### 6. Sugestão de Arquitetura Técnica

A stack foi simplificada para remover a dependência de servidores ou bancos de dados externos (BaaS):

| Componente | Tecnologia Sugerida | Motivo / Vantagem |
| --- | --- | --- |
| **Frontend** | React ou Vue.js | Componentização excelente para gerenciar múltiplos estados independentes (cada post-it). |
| **Drag & Drop** | dnd-kit (React) ou SortableJS | Bibliotecas modernas, leves e com suporte nativo para cálculo de colisão. |
| **Estilização** | Tailwind CSS | Agilidade para aplicar rotações sutis e sombras dinâmicas. |
| **Armazenamento** | **Web Storage API (`localStorage`)** | Persistência local imediata e sem custo de infraestrutura. |
| **Manipulação de Arquivos** | **File API nativa (JavaScript)** | Uso de `Blob` e `FileReader` no próprio navegador para gerar o download do JSON e fazer a leitura do upload sem intermédio de um backend. |