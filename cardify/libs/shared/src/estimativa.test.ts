import { estimarCards } from './estimativa';

describe('estimarCards', () => {
  it('arredonda parágrafos para cima e multiplica pela densidade', () => {
    expect(estimarCards({ caracteres: 600, densidade: 'enxuto' })).toBe(1);
    expect(estimarCards({ caracteres: 601, densidade: 'enxuto' })).toBe(2);
    expect(estimarCards({ caracteres: 1200, densidade: 'equilibrado' })).toBe(4);
    expect(estimarCards({ caracteres: 6000, densidade: 'exaustivo' })).toBe(40);
  });

  it('retorna no mínimo 1', () => {
    expect(estimarCards({ caracteres: 0, densidade: 'enxuto' })).toBe(1);
    expect(estimarCards({ caracteres: 1, densidade: 'enxuto' })).toBe(1);
  });

  it('estima PDF por página (1800 caracteres)', () => {
    expect(estimarCards({ caracteres: 10 * 1800, densidade: 'equilibrado' })).toBe(60);
  });
});
