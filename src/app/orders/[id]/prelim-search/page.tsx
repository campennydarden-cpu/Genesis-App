import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DerivationSection } from '@/components/prelim-search/DerivationSection'
import { SecurityInstrumentsSection } from '@/components/prelim-search/SecurityInstrumentsSection'
import { RelatedDocumentsSection } from '@/components/prelim-search/RelatedDocumentsSection'
import { LiensSection } from '@/components/prelim-search/LiensSection'
import { ExceptionMattersSection } from '@/components/prelim-search/ExceptionMattersSection'

export default async function PrelimSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('id, property_county').eq('id', id).single()
  if (!order) {
    notFound()
  }

  const { data: property } = await supabase
    .from('property_details')
    .select('county')
    .eq('order_id', id)
    .maybeSingle()

  const { data: prelimSearch } = await supabase
    .from('prelim_search')
    .select('*')
    .eq('order_id', id)
    .maybeSingle()

  const { data: granteePrincipals } = prelimSearch
    ? await supabase
        .from('derivation_principals')
        .select('*')
        .eq('prelim_search_id', prelimSearch.id)
        .eq('side', 'grantee')
        .order('created_at', { ascending: true })
    : { data: [] }

  const { data: grantorPrincipals } = prelimSearch
    ? await supabase
        .from('derivation_principals')
        .select('*')
        .eq('prelim_search_id', prelimSearch.id)
        .eq('side', 'grantor')
        .order('created_at', { ascending: true })
    : { data: [] }

  const { data: securityInstruments } = prelimSearch
    ? await supabase
        .from('security_instruments')
        .select('*')
        .eq('prelim_search_id', prelimSearch.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  const instrumentIds = (securityInstruments ?? []).map((i) => i.id)
  const { data: relatedDocs } = instrumentIds.length
    ? await supabase
        .from('security_instrument_related_docs')
        .select('*')
        .in('security_instrument_id', instrumentIds)
        .order('created_at', { ascending: true })
    : { data: [] }

  const { data: liens } = prelimSearch
    ? await supabase.from('liens').select('*').eq('prelim_search_id', prelimSearch.id).order('created_at', { ascending: true })
    : { data: [] }

  const { data: exceptionMatters } = prelimSearch
    ? await supabase.from('exception_matters').select('*').eq('prelim_search_id', prelimSearch.id).order('created_at', { ascending: true })
    : { data: [] }

  // A Server Component can't pass a plain function prop across the RSC boundary into
  // a Client Component — only serializable data/JSX can cross. Pre-render each
  // instrument's Related Documents block here and pass the resulting elements down
  // as a lookup instead of a `(instrumentId) => ReactNode` callback.
  const relatedDocsSlots = Object.fromEntries(
    (securityInstruments ?? []).map((instrument) => [
      instrument.id,
      <RelatedDocumentsSection
        key={instrument.id}
        orderId={id}
        securityInstrumentId={instrument.id}
        docs={(relatedDocs ?? []).filter((d) => d.security_instrument_id === instrument.id)}
      />,
    ])
  )

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <nav
        className="sticky top-0 z-10 mb-6 flex gap-4 border-b bg-white/95 py-2 text-sm backdrop-blur"
        data-testid="prelim-search-anchor-nav"
      >
        <a href="#derivation" className="text-slate-600 hover:text-slate-900 hover:underline">
          Derivation
        </a>
        <a href="#security-instruments" className="text-slate-600 hover:text-slate-900 hover:underline">
          Security Instruments
        </a>
        <a href="#liens" className="text-slate-600 hover:text-slate-900 hover:underline">
          Liens
        </a>
        <a href="#exception-matters" className="text-slate-600 hover:text-slate-900 hover:underline">
          Exception Matters
        </a>
      </nav>

      <div className="space-y-10">
        <DerivationSection
          orderId={id}
          prelimSearch={prelimSearch ?? null}
          granteePrincipals={granteePrincipals ?? []}
          grantorPrincipals={grantorPrincipals ?? []}
          county={property?.county ?? order.property_county ?? null}
        />
        {prelimSearch && (
          <SecurityInstrumentsSection
            orderId={id}
            prelimSearchId={prelimSearch.id}
            instruments={securityInstruments ?? []}
            relatedDocsSlots={relatedDocsSlots}
          />
        )}
        {prelimSearch && (
          <LiensSection orderId={id} prelimSearchId={prelimSearch.id} liens={liens ?? []} />
        )}
        {prelimSearch && (
          <ExceptionMattersSection orderId={id} prelimSearchId={prelimSearch.id} matters={exceptionMatters ?? []} />
        )}
      </div>
    </div>
  )
}
