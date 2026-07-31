import Link from "next/link";
import { SectionIcon } from "@/components/layout/SectionIcon";

export function SectionCard({ name, href, slug }: { name: string; href: string; slug: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
    >
      <SectionIcon slug={slug} />
      <h3 className="font-medium text-primary">{name}</h3>
    </Link>
  );
}
