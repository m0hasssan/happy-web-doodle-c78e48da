REVOKE ALL ON FUNCTION public.process_section_workorder_return(uuid, uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_section_workorder_return(uuid, uuid, uuid, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_section_workorder_return(uuid, uuid, uuid, text, jsonb) TO authenticated;