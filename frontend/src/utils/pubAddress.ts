import type { PubCatalogItem } from '../services/api'

// Address parts are only useful when they are real strings — legacy data.json
// files store unresolved integer indices in these fields.
const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

export const pubStreet = (pub: PubCatalogItem): string | null => asText(pub.address?.street)

export const pubPostcode = (pub: PubCatalogItem): string | null => asText(pub.address?.postalCode)

// "Perry Road, BS1 5BG" — whichever parts exist
export const formatPubAddress = (pub: PubCatalogItem): string =>
  [pubStreet(pub), pubPostcode(pub)].filter(Boolean).join(', ')

// What a search over the catalogue should match against
export const pubSearchText = (pub: PubCatalogItem): string =>
  [pub.name, pubStreet(pub), pubPostcode(pub)].filter(Boolean).join(' ')
