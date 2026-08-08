"use client";

import { NichoCardsCarousel } from "@/components/nichos/NichoCardsCarousel";
import type { Nicho } from "@/lib/types/database";

/** @deprecated use NichoCardsCarousel — mantido para imports antigos. */
export function NichoFotoCarouselSelect({
  value,
  onChange,
  className,
}: {
  value: Nicho | "";
  onChange: (nicho: Nicho) => void;
  className?: string;
}) {
  return (
    <NichoCardsCarousel
      value={value}
      onChange={onChange}
      className={className}
      title="Nichos"
      subtitle="Escolha o tipo de máquina da sua operação"
    />
  );
}
