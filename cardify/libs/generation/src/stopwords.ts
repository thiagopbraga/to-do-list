/** Stopwords do português já sem acento. Sem negações (nao, nem, nunca, sem, nenhum): mudam o sentido do card. */
export const STOPWORDS_PT: Set<string> = new Set(
  `
  a o as os um uma uns umas
  de da do das dos em na nos nas num numa nuns numas
  ao aos pelo pela pelos pelas por para pra com entre sobre sob ate desde apos contra
  e ou mas que se porque pois como quando onde quem qual quais quanto quanta quantos quantas
  tambem ainda assim entao aqui ali
  ele ela eles elas isso isto aquilo
  este esta esse essa estes estas esses essas aquele aquela aqueles aquelas
  seu sua seus suas meu minha teu tua nosso nossa
  lhe lhes me te voce voces
  ser sao foi foram era eram sendo sido seja sejam
  estar estao estava estavam
  ha havia tem ter
  `
    .trim()
    .split(/\s+/),
);
