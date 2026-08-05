import type { Section } from "@prisma/client";
import { deleteSection, previewSectionDeleteImpact } from "@/actions/section-actions";
import { ConfirmDeleteWithPassword } from "./ConfirmDeleteWithPassword";
import { CreateSectionForm } from "./CreateSectionForm";
import { RenameSectionForm } from "./RenameSectionForm";

function buildChildrenMap(sections: Section[]) {
  const map = new Map<string | null, Section[]>();
  for (const section of sections) {
    const key = section.parentId;
    const list = map.get(key) ?? [];
    list.push(section);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.order - b.order);
  }
  return map;
}

function SectionNode({
  section,
  cityId,
  childrenMap,
  depth,
}: {
  section: Section;
  cityId: string;
  childrenMap: Map<string | null, Section[]>;
  depth: number;
}) {
  const children = childrenMap.get(section.id) ?? [];

  return (
    <div style={{ marginLeft: depth * 20 }} className="mt-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
        <RenameSectionForm sectionId={section.id} defaultName={section.name} />

        <ConfirmDeleteWithPassword
          key={section.id}
          nombre={section.name}
          tipo="apartado"
          action={deleteSection.bind(null, section.id)}
          cargarImpacto={previewSectionDeleteImpact.bind(null, section.id)}
          className="rounded-md border border-accent px-3 py-1 text-xs font-medium text-accent hover:bg-accent hover:text-white"
        >
          Eliminar
        </ConfirmDeleteWithPassword>
      </div>

      <div className="mt-2" style={{ marginLeft: 20 }}>
        <CreateSectionForm
          cityId={cityId}
          parentId={section.id}
          placeholder="Nuevo sub-apartado"
          buttonLabel="Agregar sub-apartado"
        />
      </div>

      {children.map((child) => (
        <SectionNode
          key={child.id}
          section={child}
          cityId={cityId}
          childrenMap={childrenMap}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function SectionTree({ cityId, sections }: { cityId: string; sections: Section[] }) {
  const childrenMap = buildChildrenMap(sections);
  const roots = childrenMap.get(null) ?? [];

  return (
    <div>
      <CreateSectionForm
        cityId={cityId}
        parentId={null}
        placeholder="Nuevo apartado"
        buttonLabel="Agregar apartado"
      />

      {roots.map((section) => (
        <SectionNode
          key={section.id}
          section={section}
          cityId={cityId}
          childrenMap={childrenMap}
          depth={0}
        />
      ))}
    </div>
  );
}
