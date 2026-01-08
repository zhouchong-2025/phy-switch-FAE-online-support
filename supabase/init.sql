-- Supabase 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 启用向量扩展
create extension if not exists vector;

-- 2. 创建文档表
create table if not exists documents (
  id bigserial primary key,
  content text not null,
  embedding vector(1024), -- bge-large-zh-v1.5 的向量维度是1024
  metadata jsonb,
  created_at timestamptz default now()
);

-- 3. 创建向量索引（提高搜索性能）
create index if not exists documents_embedding_idx
on documents using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- 4. 创建向量搜索函数
create or replace function match_documents (
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
returns table (
  content text,
  source text,
  page int,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.content,
    (documents.metadata->>'source')::text as source,
    (documents.metadata->>'page')::int as page,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 5. 创建索引加速元数据查询
create index if not exists documents_metadata_idx
on documents using gin (metadata);

-- 6. 添加注释
comment on table documents is 'PHY/Switch技术文档向量存储表';
comment on column documents.content is '文档文本内容';
comment on column documents.embedding is '文本向量嵌入（1024维）';
comment on column documents.metadata is '元数据（source, page, chunkIndex等）';

-- 完成
select 'Supabase数据库初始化完成！' as message;
