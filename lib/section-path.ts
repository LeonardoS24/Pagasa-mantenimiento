import { notFound } from "next/navigation";
import { prisma } from "./prisma";
import type { City, Section } from "@prisma/client";

export interface ResolvedSectionPath {
  city: City;
  chain: Section[];
  children: Section[];
}

export async function resolveSectionPath(
  citySlug: string,
  segments: string[]
): Promise<ResolvedSectionPath> {
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) notFound();

  const chain: Section[] = [];
  let parentId: string | null = null;

  for (const slug of segments) {
    const match: Section | null = await prisma.section.findFirst({
      where: { cityId: city.id, parentId, slug },
    });
    if (!match) notFound();
    chain.push(match);
    parentId = match.id;
  }

  const children = await prisma.section.findMany({
    where: { cityId: city.id, parentId },
    orderBy: { order: "asc" },
  });

  return { city, chain, children };
}
