-- Allow authenticated clients to create tickets via PostgREST RPC
GRANT EXECUTE ON FUNCTION public.create_ticket_with_id(
  text,
  text,
  text[],
  text,
  uuid,
  text,
  date,
  text,
  uuid,
  uuid[]
) TO authenticated;
