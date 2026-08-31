import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getHouseholdId } from '../api/household'
import { listAccounts, createAccount, setAccountArchived } from '../api/accounts'
import { listCategories, createCategory, setCategoryArchived } from '../api/categories'
import {
  listTransactionsForMonth,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../api/transactions'
import type { TransactionInput } from '../types'

export const useHouseholdId = () =>
  useQuery({ queryKey: ['household'], queryFn: getHouseholdId, staleTime: Infinity })

export const useAccounts = () =>
  useQuery({ queryKey: ['accounts'], queryFn: listAccounts })

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: listCategories, staleTime: 5 * 60_000 })

export const useTransactions = (monthISO: string) =>
  useQuery({
    queryKey: ['transactions', monthISO],
    queryFn: () => listTransactionsForMonth(monthISO),
  })

/** Every money mutation invalidates the transactions domain root. */
function useInvalidate(keys: string[][]) {
  const qc = useQueryClient()
  return () => keys.forEach((k) => qc.invalidateQueries({ queryKey: k }))
}

export function useCreateTransaction() {
  const invalidate = useInvalidate([['transactions']])
  return useMutation({ mutationFn: createTransaction, onSuccess: invalidate })
}

export function useUpdateTransaction() {
  const invalidate = useInvalidate([['transactions']])
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TransactionInput> }) =>
      updateTransaction(id, patch),
    onSuccess: invalidate,
  })
}

export function useDeleteTransaction() {
  const invalidate = useInvalidate([['transactions']])
  return useMutation({ mutationFn: deleteTransaction, onSuccess: invalidate })
}

export function useCreateAccount() {
  const invalidate = useInvalidate([['accounts']])
  return useMutation({ mutationFn: createAccount, onSuccess: invalidate })
}

export function useSetAccountArchived() {
  const invalidate = useInvalidate([['accounts']])
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      setAccountArchived(id, archived),
    onSuccess: invalidate,
  })
}

export function useCreateCategory() {
  const invalidate = useInvalidate([['categories']])
  return useMutation({ mutationFn: createCategory, onSuccess: invalidate })
}

export function useSetCategoryArchived() {
  const invalidate = useInvalidate([['categories']])
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      setCategoryArchived(id, archived),
    onSuccess: invalidate,
  })
}
