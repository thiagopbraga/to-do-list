import type { Area, Densidade, ParametrosGeracao, TipoGeracao } from '@cardify/shared';

const OPCOES_DENSIDADE: { valor: Densidade; rotulo: string; dica: string }[] = [
  { valor: 'enxuto', rotulo: 'Enxuto', dica: 'Só o essencial' },
  { valor: 'equilibrado', rotulo: 'Equilibrado', dica: 'Cobertura média' },
  { valor: 'exaustivo', rotulo: 'Exaustivo', dica: 'Mais cards, mais detalhe' },
];

const OPCOES_TIPO: { valor: TipoGeracao; rotulo: string; dica: string }[] = [
  { valor: 'basico', rotulo: 'Básico', dica: 'Pergunta e resposta' },
  { valor: 'cloze', rotulo: 'Cloze', dica: 'Oclusão no texto' },
  { valor: 'misto', rotulo: 'Misto', dica: 'Os dois formatos' },
];

const OPCOES_AREA: { valor: Area; rotulo: string; dica: string }[] = [
  { valor: 'medicina', rotulo: 'Medicina', dica: 'Vocabulário clínico' },
  { valor: 'direito', rotulo: 'Direito', dica: 'Artigos e institutos' },
  { valor: 'exatas', rotulo: 'Exatas', dica: 'Fórmulas e definições' },
  { valor: 'geral', rotulo: 'Geral', dica: 'Qualquer disciplina' },
];

interface Props {
  valor: ParametrosGeracao;
  aoMudar: (valor: ParametrosGeracao) => void;
}

export function ControlesParametros({ valor, aoMudar }: Props) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <GrupoOpcoes
        legenda="Densidade"
        nome="densidade"
        opcoes={OPCOES_DENSIDADE}
        valor={valor.densidade}
        aoMudar={(densidade) => aoMudar({ ...valor, densidade })}
      />
      <GrupoOpcoes legenda="Tipo" nome="tipo" opcoes={OPCOES_TIPO} valor={valor.tipo} aoMudar={(tipo) => aoMudar({ ...valor, tipo })} />
      <GrupoOpcoes legenda="Área" nome="area" opcoes={OPCOES_AREA} valor={valor.area} aoMudar={(area) => aoMudar({ ...valor, area })} />
    </div>
  );
}

interface GrupoProps<T extends string> {
  legenda: string;
  nome: string;
  opcoes: { valor: T; rotulo: string; dica: string }[];
  valor: T;
  aoMudar: (valor: T) => void;
}

function GrupoOpcoes<T extends string>({ legenda, nome, opcoes, valor, aoMudar }: GrupoProps<T>) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium text-slate-700">{legenda}</legend>
      <div className="flex flex-col gap-2">
        {opcoes.map((opcao) => {
          const id = `${nome}-${opcao.valor}`;
          return (
            <label key={opcao.valor} htmlFor={id} className="cursor-pointer">
              <input
                id={id}
                type="radio"
                name={nome}
                value={opcao.valor}
                checked={valor === opcao.valor}
                onChange={() => aoMudar(opcao.valor)}
                className="peer sr-only"
              />
              <span className="flex items-baseline justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-checked:text-indigo-800 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600">
                <span className="font-medium">{opcao.rotulo}</span>
                <span className="text-xs text-slate-500">{opcao.dica}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
