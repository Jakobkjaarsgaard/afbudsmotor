import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Activity } from "lucide-react";
import { PublicJoinForm } from "@/components/public-join-form";
import { getClinicBySlug } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clinicSlug: string }>;
}): Promise<Metadata> {
  const { clinicSlug } = await params;
  const clinic = await getClinicBySlug(clinicSlug);
  return {
    title: clinic
      ? `Afbudsliste — ${clinic.name}`
      : "Afbudsliste — AfbudsMotor",
    description:
      "Tilmeld dig klinikkens afbudsliste og få SMS ved ledige tider. Uden CPR-nummer og med automatisk sletning efter 30 dage.",
  };
}

export default async function PublicJoinPage({
  params,
}: {
  params: Promise<{ clinicSlug: string }>;
}) {
  const { clinicSlug } = await params;
  const clinic = await getClinicBySlug(clinicSlug);

  if (!clinic) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f6e6e] text-white shadow-sm">
          <Activity className="h-6 w-6" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#0f6e6e]">
          {clinic.name}
        </p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900">
          Få besked ved afbudstider
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Tilmeld dig på 20 sekunder og få en SMS, når vi får en ledig tid. Først til mølle!
        </p>
      </div>

      <PublicJoinForm clinic={clinic} />
    </main>
  );
}
