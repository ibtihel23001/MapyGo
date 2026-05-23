export interface PaginationMeta {
  total: number;
  perPage: number;
  currentPage: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface PaginationParams {
  page?: number;
  perPage?: number;
}

export function getPagination(query: { page?: string; perPage?: string }, defaultPerPage = 15) {
  const page = Math.max(1, parseInt(query.page ?? '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(query.perPage ?? String(defaultPerPage), 10)));
  const skip = (page - 1) * perPage;
  return { page, perPage, skip };
}

export function buildMeta(total: number, page: number, perPage: number): PaginationMeta {
  const totalPages = Math.ceil(total / perPage);
  return {
    total,
    perPage,
    currentPage: page,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}

