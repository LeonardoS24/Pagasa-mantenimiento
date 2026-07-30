import Link from "next/link";

export function SectionCard({ name, href }: { name: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-primary hover:shadow-md"
    >
      <h3 className="font-medium text-primary">{name}</h3>
    </Link>
  );
}
