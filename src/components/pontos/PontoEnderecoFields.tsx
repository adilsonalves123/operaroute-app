"use client";

import { useState } from "react";
import { FormInput } from "@/components/ui/FormInput";
import {
  buscarEnderecoPorCep,
  formatCepDisplay,
  normalizeCep,
  type EnderecoParsed,
} from "@/lib/endereco/brasil";

type Props = {
  value: EnderecoParsed;
  onChange: (next: EnderecoParsed) => void;
};

export function PontoEnderecoFields({ value, onChange }: Props) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepHint, setCepHint] = useState<string | null>(null);

  function patch(partial: Partial<EnderecoParsed>) {
    onChange({ ...value, ...partial });
  }

  async function handleCepBlur() {
    const digits = normalizeCep(value.cep);
    if (digits.length !== 8) {
      setCepHint(null);
      return;
    }

    setCepLoading(true);
    setCepHint(null);

    try {
      const data = await buscarEnderecoPorCep(digits);
      if (!data) {
        setCepHint("CEP não encontrado.");
        return;
      }

      onChange({
        ...value,
        cep: formatCepDisplay(digits),
        rua: data.logradouro?.trim() || value.rua,
        bairro: data.bairro?.trim() || value.bairro,
        cidade: data.localidade?.trim()
          ? data.uf
            ? `${data.localidade.trim()} - ${data.uf}`
            : data.localidade.trim()
          : value.cidade,
      });
      setCepHint("Endereço preenchido automaticamente.");
    } catch {
      setCepHint("Erro ao buscar CEP. Tente novamente.");
    } finally {
      setCepLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          label="CEP"
          inputMode="numeric"
          value={value.cep}
          onChange={(e) => patch({ cep: formatCepDisplay(e.target.value) })}
          onBlur={handleCepBlur}
          hint={cepLoading ? "Buscando endereço..." : cepHint ?? "Digite o CEP e saia do campo para preencher rua, bairro e cidade"}
        />
        <FormInput
          label="Número"
          value={value.numero}
          onChange={(e) => patch({ numero: e.target.value })}
          hint="Informe manualmente — o CEP não traz o número"
        />
      </div>
      <FormInput
        label="Rua / Logradouro"
        value={value.rua}
        onChange={(e) => patch({ rua: e.target.value })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          label="Bairro"
          value={value.bairro}
          onChange={(e) => patch({ bairro: e.target.value })}
        />
        <FormInput
          label="Cidade"
          value={value.cidade}
          onChange={(e) => patch({ cidade: e.target.value })}
        />
      </div>
    </div>
  );
}
