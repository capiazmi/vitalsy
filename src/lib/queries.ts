import { queryOptions } from '@tanstack/react-query'
import { listRecords, getRecord } from '#/server/records'
import { listUsers, getUser } from '#/server/users'
import { userDashboard, adminDashboard } from '#/server/dashboard'
import type { RecordsQuery } from '#/lib/validation'

export const queryKeys = {
  records: (params: RecordsQuery) => ['records', params] as const,
  record: (id: string) => ['record', id] as const,
  users: ['users'] as const,
  user: (id: string) => ['user', id] as const,
  userDashboard: ['dashboard', 'user'] as const,
  adminDashboard: ['dashboard', 'admin'] as const,
}

export const recordsQueryOptions = (params: RecordsQuery) =>
  queryOptions({
    queryKey: queryKeys.records(params),
    queryFn: () => listRecords({ data: params }),
  })

export const recordQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.record(id),
    queryFn: () => getRecord({ data: { id } }),
  })

export const usersQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.users,
    queryFn: () => listUsers(),
  })

export const userQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.user(id),
    queryFn: () => getUser({ data: { id } }),
  })

export const userDashboardQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.userDashboard,
    queryFn: () => userDashboard(),
  })

export const adminDashboardQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.adminDashboard,
    queryFn: () => adminDashboard(),
  })
