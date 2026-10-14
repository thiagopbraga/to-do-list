/** Soma meses em UTC preservando o dia quando possível (31/jan + 1 mês = último dia de fev). */
export function somarMeses(data: Date, meses: number): Date {
  const alvo = new Date(
    Date.UTC(
      data.getUTCFullYear(),
      data.getUTCMonth() + meses,
      1,
      data.getUTCHours(),
      data.getUTCMinutes(),
      data.getUTCSeconds(),
      data.getUTCMilliseconds(),
    ),
  );
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(data.getUTCDate(), ultimoDia));
  return alvo;
}

const FORMATO_DATA_SP = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** YYYY-MM-DD no fuso de São Paulo. */
export function dataSaoPaulo(data: Date): string {
  return FORMATO_DATA_SP.format(data);
}
