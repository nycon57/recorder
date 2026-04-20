import type {
  PostgrestBuilder,
  PostgrestFilterBuilder,
  PostgrestQueryBuilder,
  SupabaseClient,
} from '@supabase/supabase-js';

import type { Database } from '@/lib/types/database';

type AnySupabaseClient = SupabaseClient<any, any, any>;
type AnyPostgrestBuilder<TResult> = PostgrestBuilder<any, TResult>;
type AnyQueryBuilder = PostgrestQueryBuilder<any, any, any, any, any>;
type AnyFilterBuilder = PostgrestFilterBuilder<any, any, any, any, any, any, any>;

type QueryCount = 'exact' | 'planned' | 'estimated';
type TableName = Extract<keyof Database['public']['Tables'], string>;
type ViewName = Extract<keyof Database['public']['Views'], string>;
type FunctionName = Extract<keyof Database['public']['Functions'], string>;

type TableRow<TTable extends TableName> = Database['public']['Tables'][TTable]['Row'];
type TableInsert<TTable extends TableName> = Database['public']['Tables'][TTable]['Insert'];
type TableUpdate<TTable extends TableName> = Database['public']['Tables'][TTable]['Update'];
type ViewRow<TView extends ViewName> = Database['public']['Views'][TView]['Row'];
type FunctionArgs<TFunction extends FunctionName> =
  Database['public']['Functions'][TFunction]['Args'];

type GenericTableLike<
  TRow extends Record<string, unknown>,
  TInsert,
  TUpdate,
> = {
  Row: TRow;
  Insert: TInsert;
  Update: TUpdate;
  Relationships: [];
};

type GenericViewLike<TRow extends Record<string, unknown>> = {
  Row: TRow;
  Relationships: [];
};

type MutationOptions = {
  count?: QueryCount;
};

type SelectOptions = {
  head?: boolean;
  count?: QueryCount;
};

type InsertOptions = MutationOptions & {
  defaultToNull?: boolean;
};

type UpsertOptions = InsertOptions & {
  onConflict?: string;
  ignoreDuplicates?: boolean;
};

type RpcOptions = {
  head?: boolean;
  get?: boolean;
  count?: QueryCount;
};

interface FluentFilterChain<TSelf> {
  eq(column: string, value: unknown): TSelf;
  neq(column: string, value: unknown): TSelf;
  gt(column: string, value: unknown): TSelf;
  gte(column: string, value: unknown): TSelf;
  lt(column: string, value: unknown): TSelf;
  lte(column: string, value: unknown): TSelf;
  like(column: string, pattern: string): TSelf;
  ilike(column: string, pattern: string): TSelf;
  is(column: string, value: boolean | null | string): TSelf;
  in(column: string, values: readonly unknown[]): TSelf;
  contains(column: string, value: string | readonly unknown[] | Record<string, unknown>): TSelf;
  containedBy(
    column: string,
    value: string | readonly unknown[] | Record<string, unknown>
  ): TSelf;
  overlaps(column: string, value: string | readonly unknown[]): TSelf;
  textSearch(
    column: string,
    query: string,
    options?: {
      config?: string;
      type?: 'plain' | 'phrase' | 'websearch';
    }
  ): TSelf;
  match(query: Record<string, unknown>): TSelf;
  not(column: string, operator: string, value: unknown): TSelf;
  or(
    filters: string,
    options?: { referencedTable?: string; foreignTable?: string }
  ): TSelf;
  filter(column: string, operator: string, value: unknown): TSelf;
  order(
    column: string,
    options?: {
      ascending?: boolean;
      nullsFirst?: boolean;
      referencedTable?: string;
      foreignTable?: string;
    }
  ): TSelf;
  limit(
    count: number,
    options?: { referencedTable?: string; foreignTable?: string }
  ): TSelf;
  range(
    from: number,
    to: number,
    options?: { referencedTable?: string; foreignTable?: string }
  ): TSelf;
}

export interface LightweightSelectedRowsBuilder<TRow extends Record<string, unknown>>
  extends Omit<PostgrestFilterBuilder<any, any, TRow, TRow[], any, any, any>, 'single' | 'maybeSingle'>,
    FluentFilterChain<LightweightSelectedRowsBuilder<TRow>> {
  single(): AnyPostgrestBuilder<TRow>;
  maybeSingle(): AnyPostgrestBuilder<TRow | null>;
}

export interface LightweightMutationBuilder<TRow extends Record<string, unknown>>
  extends Omit<PostgrestFilterBuilder<any, any, TRow, null, any, any, any>, 'select'>,
    FluentFilterChain<LightweightMutationBuilder<TRow>> {
  select<TResult extends Record<string, unknown> = TRow>(
    columns?: string,
    options?: SelectOptions
  ): LightweightSelectedRowsBuilder<TResult>;
}

export interface LightweightReadQueryBuilder<
  TRow extends Record<string, unknown>,
  TInsert,
  TUpdate,
> extends Omit<
    PostgrestQueryBuilder<any, any, GenericTableLike<TRow, TInsert, TUpdate>, any, []>,
    'select' | 'insert' | 'upsert' | 'update'
  > {
  select<TResult extends Record<string, unknown> = TRow>(
    columns?: string,
    options?: SelectOptions
  ): LightweightSelectedRowsBuilder<TResult>;
}

export interface LightweightViewReadQueryBuilder<TRow extends Record<string, unknown>>
  extends Omit<PostgrestQueryBuilder<any, any, GenericViewLike<TRow>, any, []>, 'select'> {
  select<TResult extends Record<string, unknown> = TRow>(
    columns?: string,
    options?: SelectOptions
  ): LightweightSelectedRowsBuilder<TResult>;
}

export interface LightweightTableQueryBuilder<TTable extends TableName>
  extends LightweightReadQueryBuilder<
    TableRow<TTable>,
    TableInsert<TTable>,
    TableUpdate<TTable>
  > {
  insert<Row extends TableInsert<TTable>>(
    values: Row | Row[],
    options?: InsertOptions
  ): LightweightMutationBuilder<TableRow<TTable>>;
  upsert<Row extends TableInsert<TTable>>(
    values: Row | Row[],
    options?: UpsertOptions
  ): LightweightMutationBuilder<TableRow<TTable>>;
  update<Row extends TableUpdate<TTable>>(
    values: Row,
    options?: MutationOptions
  ): LightweightMutationBuilder<TableRow<TTable>>;
}

export interface LightweightViewQueryBuilder<TView extends ViewName>
  extends LightweightViewReadQueryBuilder<ViewRow<TView>> {}

export type LightweightSupabaseClient = Omit<AnySupabaseClient, 'from' | 'rpc'> & {
  from<TTable extends TableName>(relation: TTable): LightweightTableQueryBuilder<TTable>;
  from<TView extends ViewName>(relation: TView): LightweightViewQueryBuilder<TView>;
  from(relation: string): AnyQueryBuilder;
  rpc<TFunction extends FunctionName>(
    fn: TFunction,
    args?: FunctionArgs<TFunction>,
    options?: RpcOptions
  ): AnyFilterBuilder;
  rpc(fn: string, args?: Record<string, unknown>, options?: RpcOptions): AnyFilterBuilder;
};

export function asLightweightSupabaseClient(
  client: AnySupabaseClient
): LightweightSupabaseClient {
  return client as unknown as LightweightSupabaseClient;
}
