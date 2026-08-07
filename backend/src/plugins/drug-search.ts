import fp from 'fastify-plugin'
import type { DrugSearchResult } from '@pharmassist/shared'
import { buildDrugIndex, searchDrugIndex, type IndexedDrug } from '../modules/drugs/search'

declare module 'fastify' {
  interface FastifyInstance {
    drugSearch: {
      search(q: string, limit: number): DrugSearchResult[]
      rebuild(): Promise<void>
    }
  }
}

export default fp(
  async (app) => {
    let index: IndexedDrug[] = []

    const rebuild = async () => {
      const drugs = await app.prisma.drug.findMany({
        select: { id: true, label: true, name: true, strength: true, form: true },
      })
      index = buildDrugIndex(drugs)
      app.log.info(`drug-search index built: ${index.length} drugs`)
    }

    await rebuild()

    app.decorate('drugSearch', {
      search: (q: string, limit: number) => searchDrugIndex(index, q, limit),
      rebuild,
    })
  },
  { name: 'drug-search', dependencies: ['prisma'] },
)
