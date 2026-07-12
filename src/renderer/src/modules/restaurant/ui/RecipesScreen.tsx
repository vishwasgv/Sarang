import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Plus, Trash2, RefreshCw, ChevronDown, XCircle, Edit2, Search } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'

interface RecipeItem {
  id: string
  quantity: number
  ingredient: { id: string; productName: string; unit: string }
}

interface Recipe {
  id: string
  productId: string
  recipeName: string
  product: { productName: string }
  items: RecipeItem[]
}

interface Product { id: string; productName: string; unit: string }

interface IngredientRow {
  ingredientProductId: string
  ingredientName: string
  quantity: string
  query: string
  results: Product[]
}

function emptyIngredientRow(): IngredientRow {
  return { ingredientProductId: '', ingredientName: '', quantity: '', query: '', results: [] }
}

export function RecipesScreen() {
  const { error: toastError } = useNotificationStore()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state — menu product picker
  const [productId, setProductId] = useState('')
  const [productName, setProductName] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [recipeName, setRecipeName] = useState('')
  const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyIngredientRow()])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const recipesRes = await api.restaurant.listRecipes()
      if (recipesRes.success && recipesRes.data) {
        setRecipes(recipesRes.data as Recipe[])
      } else {
        toastError('Error', recipesRes.error?.message ?? 'Could not load recipes.')
      }
    } catch {
      toastError('Error', 'Could not load recipes.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  // Menu product search — a plain preloaded <select> silently capped at the
  // first 50 products (products.list's default page size) with no way to
  // reach the rest. Real product search (like Billing/Bulk Order already
  // use) has no such ceiling.
  useEffect(() => {
    if (!productQuery.trim()) { setProductResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await api.products.search(productQuery.trim())
        if (res.success && res.data) setProductResults(res.data as Product[])
        else toastError('Error', res.error?.message ?? 'Could not search products.')
      } catch {
        toastError('Error', 'Could not search products.')
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [productQuery, toastError])

  async function handleSave() {
    if (!productId) { setError('Select the menu product this recipe is for.'); return }
    if (!recipeName.trim()) { setError('Recipe name is required.'); return }
    const validIngredients = ingredients.filter(i => i.ingredientProductId && parseFloat(i.quantity) > 0)
    if (!validIngredients.length) { setError('Add at least one ingredient with a valid quantity.'); return }

    setSubmitting(true)
    setError(null)
    try {
      const res = await api.restaurant.upsertRecipe({
        productId,
        recipeName: recipeName.trim(),
        items: validIngredients.map(i => ({ ingredientProductId: i.ingredientProductId, quantity: parseFloat(i.quantity) }))
      })
      if (res.success) {
        setShowForm(false); resetForm(); load()
      } else {
        setError((res.error as { message?: string })?.message ?? 'Could not save recipe.')
      }
    } catch {
      setError('Could not save recipe.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(recipeId: string) {
    try {
      const res = await api.restaurant.deleteRecipe({ recipeId })
      if (!res.success) setError((res.error as { message?: string })?.message ?? 'Could not delete recipe.')
      else load()
    } catch {
      setError('Could not delete recipe.')
    }
  }

  function resetForm() {
    setProductId(''); setProductName(''); setProductQuery(''); setProductResults([])
    setRecipeName('')
    setIngredients([emptyIngredientRow()])
    setError(null); setEditingRecipeId(null)
  }

  function openEdit(recipe: Recipe) {
    setProductId(recipe.productId)
    setProductName(recipe.product.productName)
    setProductQuery(''); setProductResults([])
    setRecipeName(recipe.recipeName)
    setIngredients(recipe.items.map(i => ({
      ingredientProductId: i.ingredient.id,
      ingredientName: i.ingredient.productName,
      quantity: String(i.quantity),
      query: '', results: []
    })))
    setEditingRecipeId(recipe.id)
    setError(null)
    setShowForm(true)
  }

  function addIngredient() {
    setIngredients(prev => [...prev, emptyIngredientRow()])
  }

  function removeIngredient(idx: number) {
    setIngredients(prev => prev.filter((_, i) => i !== idx))
  }

  function setIngredientQuantity(idx: number, value: string) {
    setIngredients(prev => prev.map((item, i) => i === idx ? { ...item, quantity: value } : item))
  }

  function setIngredientQuery(idx: number, value: string) {
    setIngredients(prev => prev.map((item, i) => i === idx ? { ...item, query: value } : item))
  }

  function setIngredientResults(idx: number, results: Product[]) {
    setIngredients(prev => prev.map((item, i) => i === idx ? { ...item, results } : item))
  }

  function pickIngredient(idx: number, p: Product) {
    setIngredients(prev => prev.map((item, i) => i === idx
      ? { ...item, ingredientProductId: p.id, ingredientName: p.productName, query: '', results: [] }
      : item))
  }

  // Debounced per-row ingredient search
  useEffect(() => {
    const timers = ingredients.map((row, idx) => {
      if (!row.query.trim()) { if (row.results.length) setIngredientResults(idx, []); return undefined }
      return setTimeout(async () => {
        try {
          const res = await api.products.search(row.query.trim())
          if (res.success && res.data) setIngredientResults(idx, res.data as Product[])
          else toastError('Error', res.error?.message ?? 'Could not search products.')
        } catch {
          toastError('Error', 'Could not search products.')
        }
      }, 250)
    })
    return () => { timers.forEach(t => t && clearTimeout(t)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients.map(r => r.query).join('|')])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark dark:text-slate-100">Recipe Management</h2>
          <p className="text-sm text-slate-400">{recipes.length} recipe{recipes.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={() => { setShowForm(true); resetForm() }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors">
          <Plus size={14} /> Add Recipe
        </button>
      </div>

      {error && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-danger">
          <XCircle size={14} />{error}
        </div>
      )}

      {/* Add / Edit form */}
      <AnimatePresence>
        {showForm && (
          <motion.div key="form" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          <Card padding="lg" className="space-y-4">
            <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{editingRecipeId ? 'Edit Recipe' : 'New Recipe'}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Menu Product *</label>
                {editingRecipeId ? (
                  <div className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                    {productName}
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={productId ? productName : productQuery}
                      onChange={e => { setProductId(''); setProductName(''); setProductQuery(e.target.value) }}
                      placeholder="Search product by name or SKU…"
                      className="w-full pl-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-dark dark:text-slate-100 focus:outline-none focus:border-brand" />
                    {productResults.length > 0 && !productId && (
                      <div className="absolute z-10 mt-1 w-full border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-50 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-lg max-h-56 overflow-y-auto">
                        {productResults.map(p => (
                          <button key={p.id} type="button"
                            onClick={() => { setProductId(p.id); setProductName(p.productName); setProductQuery(''); setProductResults([]) }}
                            className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand/5 transition-colors">
                            <span className="text-dark dark:text-slate-100">{p.productName}</span>
                            <span className="text-xs text-slate-400">{p.unit}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Recipe Name *</label>
                <input value={recipeName} onChange={e => setRecipeName(e.target.value)}
                  placeholder="e.g. Masala Chai Recipe"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Ingredients *</label>
                <button onClick={addIngredient}
                  className="text-xs text-brand hover:underline flex items-center gap-1">
                  <Plus size={11} /> Add ingredient
                </button>
              </div>
              {ingredients.map((ing, idx) => {
                // An ingredient already picked in a different row would let
                // the same ingredient be added twice — deductIngredients()
                // deducts once per row, so a duplicate silently doubles the
                // stock deduction on every KOT completion. The backend now
                // rejects it outright; filtering results here catches the
                // mistake before the user even gets that far.
                const pickedElsewhere = new Set(ingredients.filter((_, i) => i !== idx).map(r => r.ingredientProductId).filter(Boolean))
                const visibleResults = ing.results.filter(p => !pickedElsewhere.has(p.id))
                return (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={ing.ingredientProductId ? ing.ingredientName : ing.query}
                        onChange={e => {
                          setIngredients(prev => prev.map((item, i) => i === idx
                            ? { ...item, ingredientProductId: '', ingredientName: '', query: e.target.value }
                            : item))
                        }}
                        placeholder="Search ingredient by name or SKU…"
                        className="w-full pl-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-dark dark:text-slate-100 focus:outline-none focus:border-brand" />
                      {visibleResults.length > 0 && !ing.ingredientProductId && (
                        <div className="absolute z-10 mt-1 w-full border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-50 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-lg max-h-56 overflow-y-auto">
                          {visibleResults.map(p => (
                            <button key={p.id} type="button" onClick={() => pickIngredient(idx, p)}
                              className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand/5 transition-colors">
                              <span className="text-dark dark:text-slate-100">{p.productName}</span>
                              <span className="text-xs text-slate-400">{p.unit}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input type="number" min="0.01" step="0.01" value={ing.quantity}
                      onChange={e => setIngredientQuantity(idx, e.target.value)}
                      placeholder="Qty"
                      className="w-24 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand" />
                    {ingredients.length > 1 && (
                      <button onClick={() => removeIngredient(idx)} className="text-slate-300 hover:text-danger transition-colors mt-2">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowForm(false); resetForm() }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                {submitting && <RefreshCw size={12} className="animate-spin" />} Save Recipe
              </button>
            </div>
          </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recipe list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw size={20} className="animate-spin text-brand" />
        </div>
      ) : recipes.length === 0 ? (
        <Card padding="none" className="p-12 text-center">
          <BookOpen size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No recipes yet</p>
          <p className="text-xs text-slate-400 mt-1">Add recipes to track ingredient usage when KOTs are fulfilled</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {recipes.map(recipe => (
            <Card key={recipe.id} padding="none" className="overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === recipe.id ? null : recipe.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-dark dark:text-slate-100">{recipe.recipeName}</p>
                  <p className="text-xs text-slate-400">For {recipe.product.productName} · {recipe.items.length} ingredient{recipe.items.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); openEdit(recipe) }}
                    className="p-1.5 text-slate-300 hover:text-brand transition-colors rounded-lg hover:bg-brand/5">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(recipe.id) }}
                    className="p-1.5 text-slate-300 hover:text-danger transition-colors rounded-lg hover:bg-danger/5">
                    <Trash2 size={13} />
                  </button>
                  <ChevronDown size={14} className={cn('text-slate-400 transition-transform', expanded === recipe.id && 'rotate-180')} />
                </div>
              </button>
              <AnimatePresence>
                {expanded === recipe.id && (
                  <motion.div key="items" initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="overflow-hidden border-t border-slate-100 dark:border-slate-800">
                    <div className="px-5 py-3 space-y-1.5">
                      {recipe.items.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-300">{item.ingredient.productName}</span>
                          <span className="font-medium text-dark dark:text-slate-100">{item.quantity} {item.ingredient.unit}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
