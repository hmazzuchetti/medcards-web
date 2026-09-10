// ============================================================
// Cards Service
// Responsible for fetching cards, categories, and subcategories
// from Supabase. No SM-2 logic here.
// ============================================================

import { createClient } from '@/lib/supabase/client';
import type { Card, Category, Subcategory } from '@/types';

/** PostgREST devolve no máximo 1000 linhas por requisição; buscamos em páginas até acabar. */
const PAGE_SIZE = 1000;

type PagedQuery<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;

async function fetchAllPages<T>(label: string, query: PagedQuery<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error(`${label} error:`, error);
      break;
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export interface CategoryWithCards {
  category: Category;
  cardIds: string[];
  totalCards: number;
}

export interface SubcategoryWithCards extends Subcategory {
  cardIds: string[];
  totalCards: number;
  categoryName: string;
}

// ─── Categories ───────────────────────────────────────────────────────────────

/**
 * Fetch all categories ordered by name.
 */
export async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');

  if (error) {
    console.error('fetchCategories error:', error);
    return [];
  }
  return (data as Category[]) ?? [];
}

/**
 * Fetch all subcategories with their category name and card count.
 */
export async function fetchSubcategoriesWithCards(): Promise<SubcategoryWithCards[]> {
  const supabase = createClient();

  const [catsResult, subcatsResult] = await Promise.all([
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('subcategories').select('*').order('name'),
  ]);

  if (catsResult.error || subcatsResult.error) {
    console.error('fetchSubcategoriesWithCards error:', catsResult.error, subcatsResult.error);
    return [];
  }

  const categories = catsResult.data ?? [];
  const subcategories = subcatsResult.data ?? [];

  if (subcategories.length === 0) return [];

  // Fetch all card IDs grouped by subcategory (paginated: can exceed 1000 rows)
  const subcatIds = subcategories.map(s => s.id as string);
  const cards = await fetchAllPages<{ id: string; subcategory_id: string }>(
    'fetchSubcategoriesWithCards cards',
    (from, to) =>
      supabase
        .from('cards')
        .select('id, subcategory_id')
        .in('subcategory_id', subcatIds)
        .eq('is_active', true)
        .order('id')
        .range(from, to)
  );

  const catMap: Record<string, string> = {};
  for (const cat of categories) {
    catMap[cat.id as string] = cat.name as string;
  }

  const cardsBySubcategory: Record<string, string[]> = {};
  for (const card of cards ?? []) {
    const subId = card.subcategory_id as string;
    if (!cardsBySubcategory[subId]) cardsBySubcategory[subId] = [];
    cardsBySubcategory[subId].push(card.id as string);
  }

  return subcategories.map(sub => ({
    id: sub.id as string,
    category_id: sub.category_id as string,
    name: sub.name as string,
    slug: sub.slug as string,
    categoryName: catMap[sub.category_id as string] ?? '',
    cardIds: cardsBySubcategory[sub.id as string] ?? [],
    totalCards: cardsBySubcategory[sub.id as string]?.length ?? 0,
  }));
}

/**
 * Fetch card IDs for a specific category (all its subcategories).
 */
export async function fetchCategoryCardIds(categoryId: string): Promise<string[]> {
  const supabase = createClient();

  // Get subcategory IDs for this category
  const { data: subcats, error: subcatsError } = await supabase
    .from('subcategories')
    .select('id')
    .eq('category_id', categoryId);

  if (subcatsError || !subcats?.length) return [];

  const subcatIds = subcats.map(s => s.id as string);

  const cards = await fetchAllPages<{ id: string }>('fetchCategoryCardIds', (from, to) =>
    supabase
      .from('cards')
      .select('id')
      .in('subcategory_id', subcatIds)
      .eq('is_active', true)
      .order('id')
      .range(from, to)
  );

  return cards.map(c => c.id);
}

/**
 * Fetch full card objects for a list of IDs.
 */
export async function fetchCardsByIds(cardIds: string[]): Promise<Card[]> {
  if (cardIds.length === 0) return [];

  const supabase = createClient();
  const batchSize = 100;
  const allCards: Card[] = [];

  for (let i = 0; i < cardIds.length; i += batchSize) {
    const batch = cardIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .in('id', batch)
      .eq('is_active', true);

    if (error) {
      console.error('fetchCardsByIds error:', error);
      continue;
    }
    if (data) allCards.push(...(data as Card[]));
  }

  return allCards;
}

/**
 * Fetch all cards for a category (full card objects).
 */
export async function fetchCardsByCategory(categoryId: string): Promise<Card[]> {
  const ids = await fetchCategoryCardIds(categoryId);
  return fetchCardsByIds(ids);
}

/**
 * Fetch all cards for enabled subcategories.
 */
export async function fetchEnabledCards(subcategoryIds: string[]): Promise<Card[]> {
  if (subcategoryIds.length === 0) return [];

  const supabase = createClient();
  const batchSize = 100;
  const allCards: Card[] = [];

  for (let i = 0; i < subcategoryIds.length; i += batchSize) {
    const batch = subcategoryIds.slice(i, i + batchSize);
    const rows = await fetchAllPages<Card>('fetchEnabledCards', (from, to) =>
      supabase
        .from('cards')
        .select('*')
        .in('subcategory_id', batch)
        .eq('is_active', true)
        .order('created_at')
        .order('id')
        .range(from, to)
    );
    allCards.push(...rows);
  }

  return allCards;
}
