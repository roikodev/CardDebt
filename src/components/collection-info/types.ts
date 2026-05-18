export type CollectionBase = {
  id: string
  game_title: string | null
  card_no: string | null
  name: string | null
  image_cloud_path: string | null
}

export type BuyEntry = {
  id: string
  purchase_date: string
  price_hkd: number
  quantity: number
  graded: boolean
  collection_item_id: string
}

export type UserCollectionRow = {
  id: string
  graded: boolean
  collection_item_id: string
  entry_price?: number | null
  collection_base: CollectionBase | null
}

export type MiscCostLine = {
  id: string
  date: string
  price: number
  type: string
  description: string | null
}

export type DerivedRecordRow = {
  id: string
  from_user_collection_id: string
  to_user_collection_id: string
  created_at: string
  from_user_collection: UserCollectionRow | null
  to_user_collection: UserCollectionRow | null
  costLines: MiscCostLine[]
  costTotal: number
}

export type GradingRecordRow = {
  id: string
  user_collection_id: string
  sent_at: string
  created_at: string
  executed?: boolean
  costLines: MiscCostLine[]
  costTotal: number
}

export type OverviewCollectionRow = {
  id: string
  derived: boolean
  grading: boolean
  created_at: string
}
