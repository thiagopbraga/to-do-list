# RFC: StickyFlow - Aplicação Local-First de Post-its

**Status:** Rascunho / Em Revisão
**Autor:** Thiago + Gemini
**Data:** Junho de 2026

## 1. Contexto e Motivação

A maioria dos gerenciadores de tarefas exige criação de contas e dependência de serviços em nuvem. O StickyFlow propõe uma abordagem visual (quadro de post-its) e *local-first*, focada em privacidade, velocidade e portabilidade através da importação/exportação de arquivos. Precisamos definir a arquitetura técnica de frontend que suporte interações complexas de drag-and-drop sem comprometer a performance ou a integridade dos dados no armazenamento local.

## 2. Objetivos e Não-Objetivos

**Objetivos:**

* Arquitetura 100% Client-Side (Single Page Application).
* Persistência de estado assíncrona/não-bloqueante utilizando `localStorage`.
* Mecanismo seguro e validado de Importação/Exportação via arquivos `.json`.
* Interface responsiva, com suporte a drag-and-drop a 60fps usando DOM (HTML/CSS) e não Canvas.

**Não-Objetivos (Fora do escopo para esta RFC/MVP):**

* Sincronização em nuvem ou banco de dados externo.
* Autenticação de usuários (Login/Senha).
* Colaboração em tempo real (Multiplayer).
* Aplicativo nativo mobile (iOS/Android), focaremos em uma experiência web/PWA.

---

## 3. Arquitetura Proposta

A aplicação será um SPA (Single Page Application) moderno.

* **Core:** React (ou Vue.js). Recomendado React pela maturidade do ecossistema de Drag and Drop.
* **Gerenciamento de Estado:** Zustand (React) ou Pinia (Vue) - preferíveis por não necessitarem de boilerplate complexo e lidarem bem com reatividade fora de componentes, facilitando o salvamento.
* **Motor de Drag and Drop:** `@dnd-kit/core` (se React). Permite cálculos de colisão eficientes e suporte a acessibilidade nativo, manipulando transformações CSS (`transform: translate3d`) que não causam repaints caros no navegador.
* **Armazenamento:** `Web Storage API (localStorage)`.
* **Estilização:** Tailwind CSS (focado em utility classes para animações e cores).

---

## 4. Modelo de Dados (Schema)

Como os dados serão exportados para JSON e salvos no `localStorage`, precisamos de um schema estrito e versionado para garantir compatibilidade futura.

**Formato do Estado Global (JSON):**

```json
{
  "version": "1.0",
  "board": {
    "lastModified": "2026-06-02T14:30:00.000Z",
    "theme": "light"
  },
  "notes": [
    {
      "id": "uuid-v4",
      "text": "Comprar café",
      "color": "yellow",
      "position": {
        "x": 150,
        "y": 300
      },
      "zIndex": 10,
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-02T11:00:00.000Z",
      "groupId": null
    }
  ]
}

```

* **Nota sobre `zIndex`:** Essencial para garantir que o último post-it clicado/arrastado sobreponha os outros.
* **Nota sobre `version`:** Vital para a funcionalidade de Importação. Se no futuro adicionarmos novas chaves, a função de importação saberá como migrar um JSON `"version": "1.0"` para `"2.0"`.

---

## 5. Fluxos Principais de Engenharia

### 5.1. Mecanismo de Salvamento Automático

Para evitar gargalos de performance ("jank") enquanto o usuário arrasta um post-it:

1. O estado visual (posição na tela) é atualizado em tempo real via React/dnd-kit.
2. O salvamento no `localStorage` será envolvido em um **Debounce de 500ms a 1000ms**.
3. *Resultado:* O `localStorage` só é sobrescrito quando o usuário solta o post-it ou para de digitar, poupando ciclos de CPU.

### 5.2. Fluxo de Exportação (Backup)

1. O usuário clica em "Exportar".
2. O estado atual é serializado com `JSON.stringify()`.
3. É gerado um `Blob` com o MIME type `application/json`.
4. Uma tag `<a>` invisível é criada no DOM, o atributo `href` recebe `URL.createObjectURL(blob)` e o atributo `download` recebe `stickyflow-backup-YYYY-MM-DD.json`.
5. O clique é forçado via script e o download ocorre de forma nativa.

### 5.3. Fluxo de Importação (Restauração)

1. O usuário faz o upload de um arquivo `.json` via `<input type="file">`.
2. A aplicação lê o arquivo usando `FileReader` (API nativa do browser).
3. O conteúdo passa por um validador de Schema (ex: biblioteca `Zod` ou validação manual) para garantir que não contém código malicioso e tem as propriedades exigidas.
4. Se inválido: Exibe Toast de erro.
5. Se válido: Exibe Modal ("Isso apagará seu quadro atual. Deseja continuar?").
6. Após confirmação, o estado global é substituído e o React re-renderiza o quadro.

---

## 6. Alternativas Consideradas

* **IndexedDB vs LocalStorage:**
* *Considerado:* IndexedDB permite mais espaço (GBs) e estruturação de banco de dados real.
* *Decisão:* Rejeitado para o MVP. O `localStorage` suporta ~5MB. Um JSON com 1.000 post-its pesa menos de 500KB. A simplicidade de uso do `localStorage` (síncrono e chave-valor) compensa para o volume de dados esperado.


* **HTML/DOM vs Canvas/WebGL:**
* *Considerado:* Usar Canvas para desenhar as notas e garantir performance extrema.
* *Decisão:* Rejeitado. Canvas destrói a acessibilidade (leitores de tela), dificulta a edição de texto rica (seleção, copiar/colar) e impede o uso de CSS para animações fáceis. O DOM atual, usando `translate3d`, é performático o suficiente para centenas de nós na tela.



## 7. Preocupações de Segurança

* **Ataque XSS (Cross-Site Scripting):** Como permitiremos importação de JSON e renderização de texto, há risco de XSS se o arquivo importado contiver scripts.
* **Mitigação:** O campo `text` de cada nota deve ser tratado como texto puro (`textContent` ou similar no React), nunca renderizado via `dangerouslySetInnerHTML`.

---

### Próximos Passos (Para a fase de Specs)

Se esta RFC for aprovada, os próximos documentos (Specs) devem detalhar:

1. Contrato da interface dos componentes React (Props do Post-it, do Board).
2. Regras exatas de colisão para a feature "Empilhamento (Grouping)".
3. Lógica matemática do botão "Alinhamento Magnético" (cálculo de grid).